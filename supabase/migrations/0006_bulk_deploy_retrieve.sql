-- ============================================================================
-- نشر/استرجاع جماعي (Bulk) — قسم 9.5 بالمواصفة الأصلية + شاشة 5 بتصميم RIME
-- كل جهاز ياخذ سطر Deployment منفصل، والمستهلكات تُخصم مرة لكل وحدة منشورة
-- ============================================================================

create or replace function fn_deploy_assets_bulk(
  p_asset_ids uuid[],
  p_client_id uuid,
  p_deployed_by uuid,
  p_contract_reference text default null,
  p_expected_return_date date default null,
  p_consumables jsonb default '[]' -- [{"consumable_id": "...", "quantity_per_unit": 1}, ...]
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_asset_id uuid;
  v_deployment_id uuid;
  v_deployment_ids uuid[] := '{}';
  v_status text;
  v_item jsonb;
  v_consumable record;
begin
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  foreach v_asset_id in array p_asset_ids loop
    select current_status into v_status from assets where id = v_asset_id for update;
    if v_status is null then
      raise exception 'asset_not_found: %', v_asset_id;
    end if;
    if v_status <> 'in_warehouse' then
      raise exception 'invalid_transition: asset % must be in_warehouse (currently %)', v_asset_id, v_status;
    end if;

    insert into deployments (asset_id, client_id, contract_reference, expected_return_date, deployed_by)
    values (v_asset_id, p_client_id, p_contract_reference, p_expected_return_date, p_deployed_by)
    returning id into v_deployment_id;

    update assets set current_status = 'deployed', current_client_id = p_client_id, current_location_id = null
    where id = v_asset_id;

    for v_item in select * from jsonb_array_elements(p_consumables)
    loop
      select id, unit_cost, quantity_on_hand into v_consumable
      from consumables where id = (v_item->>'consumable_id')::uuid;

      if v_consumable.id is null then
        raise exception 'consumable_not_found: %', v_item->>'consumable_id';
      end if;

      insert into deployment_consumables (deployment_id, consumable_id, quantity_used, cost_at_time)
      values (v_deployment_id, v_consumable.id, (v_item->>'quantity_per_unit')::int, v_consumable.unit_cost);

      update consumables set quantity_on_hand = quantity_on_hand - (v_item->>'quantity_per_unit')::int
      where id = v_consumable.id;
    end loop;

    v_deployment_ids := array_append(v_deployment_ids, v_deployment_id);
  end loop;

  return v_deployment_ids;
end;
$$;

create or replace function fn_retrieve_assets_bulk(
  p_deployment_ids uuid[],
  p_returned_by uuid,
  p_return_condition text,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_deployment_id uuid;
  v_asset_id uuid;
begin
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  foreach v_deployment_id in array p_deployment_ids loop
    select asset_id into v_asset_id from deployments where id = v_deployment_id and actual_return_date is null for update;
    if v_asset_id is null then
      raise exception 'deployment_not_found_or_already_returned: %', v_deployment_id;
    end if;

    update deployments
    set actual_return_date = now(), returned_by = p_returned_by, return_condition = p_return_condition, notes = coalesce(p_notes, notes)
    where id = v_deployment_id;

    update assets
    set current_status = case when p_return_condition in ('damaged','missing') then 'lost_damaged' else 'in_maintenance' end,
        current_client_id = null
    where id = v_asset_id;
  end loop;
end;
$$;

revoke execute on function fn_deploy_assets_bulk(uuid[], uuid, uuid, text, date, jsonb) from public, anon;
revoke execute on function fn_retrieve_assets_bulk(uuid[], uuid, text, text) from public, anon;
grant execute on function fn_deploy_assets_bulk(uuid[], uuid, uuid, text, date, jsonb) to authenticated;
grant execute on function fn_retrieve_assets_bulk(uuid[], uuid, text, text) to authenticated;
