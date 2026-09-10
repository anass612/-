-- ============================================================================
-- سجل التدقيق (Audit Log) — P0-3 من تقرير التدقيق
-- ما فيه أي أثر لمن غيّر حالة الجهاز ومتى. جدول append-only + trigger عام
-- على كل الجداول التشغيلية، يقرأ auth.uid() كممثل، واسم الـ RPC (لو الكتابة
-- صارت عبر دالة) من إعداد جلسة مؤقت app.rpc_name تحطه كل دالة كتابة.
-- ============================================================================

create table audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references profiles(id),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_row jsonb,
  new_row jsonb,
  rpc_name text
);

create index idx_audit_log_table_row on audit_log(table_name, row_id);
create index idx_audit_log_actor on audit_log(actor_id);
create index idx_audit_log_occurred_at on audit_log(occurred_at desc);

alter table audit_log enable row level security;
create policy "admin_read_audit" on audit_log for select using (fn_is_admin());
-- ما فيه insert/update/delete policies لأي دور — الكتابة تصير فقط عبر fn_audit() (security definer)
revoke all on audit_log from public, anon;
grant select on audit_log to authenticated;

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row_id uuid;
begin
  v_row_id := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into audit_log (actor_id, table_name, row_id, action, old_row, new_row, rpc_name)
  values (
    auth.uid(),
    tg_table_name,
    v_row_id,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    nullif(current_setting('app.rpc_name', true), '')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function fn_audit() from public, anon, authenticated;

create trigger trg_audit_assets after insert or update or delete on assets for each row execute function fn_audit();
create trigger trg_audit_deployments after insert or update or delete on deployments for each row execute function fn_audit();
create trigger trg_audit_tasks after insert or update or delete on tasks for each row execute function fn_audit();
create trigger trg_audit_components after insert or update or delete on components for each row execute function fn_audit();
create trigger trg_audit_consumables after insert or update or delete on consumables for each row execute function fn_audit();
create trigger trg_audit_clients after insert or update or delete on clients for each row execute function fn_audit();
create trigger trg_audit_profiles after insert or update or delete on profiles for each row execute function fn_audit();
create trigger trg_audit_maintenance_logs after insert or update or delete on maintenance_logs for each row execute function fn_audit();
create trigger trg_audit_purchase_invoices after insert or update or delete on purchase_invoices for each row execute function fn_audit();

-- ============================================================================
-- كل دالة كتابة تحط app.rpc_name أول شي عشان سجل التدقيق يعرف مصدر التغيير
-- (create or replace بنفس التوقيع بالضبط — ما نغيّر أي منطق، سطر واحد إضافي)
-- ============================================================================

create or replace function fn_deploy_asset(
  p_asset_id uuid,
  p_client_id uuid,
  p_deployed_by uuid,
  p_contract_reference text default null,
  p_expected_return_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_deployment_id uuid;
  v_status text;
begin
  perform set_config('app.rpc_name', 'fn_deploy_asset', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  select current_status into v_status from assets where id = p_asset_id for update;
  if v_status is null then
    raise exception 'asset_not_found';
  end if;
  if v_status <> 'in_warehouse' then
    raise exception 'invalid_transition: asset must be in_warehouse (currently %)', v_status;
  end if;

  insert into deployments (asset_id, client_id, contract_reference, expected_return_date, deployed_by)
  values (p_asset_id, p_client_id, p_contract_reference, p_expected_return_date, p_deployed_by)
  returning id into v_deployment_id;

  update assets set current_status = 'deployed', current_client_id = p_client_id, current_location_id = null
  where id = p_asset_id;

  return v_deployment_id;
end;
$$;

create or replace function fn_assemble_device(
  p_product_id uuid,
  p_assembled_by uuid,
  p_new_serial_number text,
  p_manufacturer_asset_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_asset_id uuid;
  v_component record;
  v_total_cost numeric(12,2) := 0;
  v_assembly_id uuid;
begin
  perform set_config('app.rpc_name', 'fn_assemble_device', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  insert into assets (serial_number, asset_type, current_status)
  values (p_new_serial_number, 'main_device', 'in_warehouse')
  returning id into v_new_asset_id;

  if array_length(p_manufacturer_asset_ids, 1) > 0 then
    update assets set parent_asset_id = v_new_asset_id, current_status = 'in_warehouse'
    where id = any(p_manufacturer_asset_ids);
  end if;

  insert into assembly_events (product_id, assembled_by, resulting_asset_id)
  values (p_product_id, p_assembled_by, v_new_asset_id)
  returning id into v_assembly_id;

  for v_component in
    select c.id, c.unit_cost, b.quantity_required
    from product_bom_items b join components c on c.id = b.component_id
    where b.product_id = p_product_id
  loop
    if v_component.quantity_required > (select quantity_on_hand from components where id = v_component.id) then
      raise exception 'insufficient_stock: component % has less than % on hand', v_component.id, v_component.quantity_required;
    end if;

    update components set quantity_on_hand = quantity_on_hand - v_component.quantity_required
    where id = v_component.id;

    insert into assembly_event_components (assembly_event_id, component_id, quantity, unit_cost_at_time)
    values (v_assembly_id, v_component.id, v_component.quantity_required, v_component.unit_cost);

    v_total_cost := v_total_cost + (v_component.unit_cost * v_component.quantity_required);
  end loop;

  update assembly_events set total_component_cost = v_total_cost where id = v_assembly_id;

  return v_new_asset_id;
end;
$$;

create or replace function fn_disassemble_device(
  p_asset_id uuid,
  p_disassembled_by uuid,
  p_returned_components jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_event_id uuid;
  v_item jsonb;
begin
  perform set_config('app.rpc_name', 'fn_disassemble_device', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  insert into disassembly_events (asset_id, disassembled_by)
  values (p_asset_id, p_disassembled_by)
  returning id into v_event_id;

  for v_item in select * from jsonb_array_elements(p_returned_components)
  loop
    insert into disassembly_event_components (disassembly_event_id, component_id, quantity, condition)
    values (
      v_event_id,
      (v_item->>'component_id')::uuid,
      (v_item->>'quantity')::int,
      v_item->>'condition'
    );

    if v_item->>'condition' = 'good' then
      update components set quantity_on_hand = quantity_on_hand + (v_item->>'quantity')::int
      where id = (v_item->>'component_id')::uuid;
    end if;
  end loop;

  update assets set current_status = 'disassembled', current_client_id = null, current_location_id = null
  where id = p_asset_id;

  return v_event_id;
end;
$$;

create or replace function fn_complete_task(
  p_task_id uuid,
  p_completion_notes text default null,
  p_client_id uuid default null,
  p_expected_return_date date default null,
  p_maintenance_result text default null,
  p_maintenance_cost numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task record;
  v_new_asset_id uuid;
begin
  perform set_config('app.rpc_name', 'fn_complete_task', true);
  select * into v_task from tasks where id = p_task_id;
  if v_task is null then
    raise exception 'task_not_found';
  end if;
  if v_task.assigned_to <> auth.uid() and not fn_is_staff() then
    raise exception 'insufficient_privilege: not your task';
  end if;
  if v_task.status = 'completed' then
    raise exception 'task_already_completed';
  end if;

  if v_task.task_type = 'installation' then
    if v_task.related_asset_id is null or p_client_id is null then
      raise exception 'installation_requires_related_asset_and_client';
    end if;
    perform fn_deploy_asset(v_task.related_asset_id, p_client_id, v_task.assigned_to, null, p_expected_return_date);

  elsif v_task.task_type = 'retrieval' then
    if v_task.related_asset_id is null then
      raise exception 'retrieval_requires_related_asset';
    end if;
    update deployments set actual_return_date = now(), returned_by = v_task.assigned_to,
      return_condition = coalesce(p_maintenance_result, 'good')
      where asset_id = v_task.related_asset_id and actual_return_date is null;
    update assets set current_status = 'in_maintenance', current_client_id = null where id = v_task.related_asset_id;

  elsif v_task.task_type in ('maintenance', 'inspection') then
    if v_task.related_asset_id is null then
      raise exception 'maintenance_requires_related_asset';
    end if;
    insert into maintenance_logs (asset_id, maintenance_type, performed_by, cost, notes, result)
    values (v_task.related_asset_id, v_task.task_type, v_task.assigned_to, coalesce(p_maintenance_cost, 0), p_completion_notes, p_maintenance_result);
    if p_maintenance_result = 'passed' then
      update assets set current_status = 'in_warehouse' where id = v_task.related_asset_id;
    elsif p_maintenance_result = 'failed' then
      update assets set current_status = 'retired' where id = v_task.related_asset_id;
    end if;

  elsif v_task.task_type = 'battery_replacement' then
    if v_task.related_asset_id is null then
      raise exception 'battery_replacement_requires_related_asset';
    end if;
    insert into maintenance_logs (asset_id, maintenance_type, performed_by, cost, notes, result)
    values (v_task.related_asset_id, 'battery_replacement', v_task.assigned_to, coalesce(p_maintenance_cost, 0), p_completion_notes, 'passed');
    update assets set battery_installed_at = current_date, battery_last_replaced_at = current_date
      where id = v_task.related_asset_id;
  end if;

  update tasks set status = 'completed', completion_notes = p_completion_notes, completed_at = now()
  where id = p_task_id;
end;
$$;

create or replace function fn_save_purchase_invoice(
  p_supplier_name text,
  p_invoice_number text,
  p_invoice_date date,
  p_shipping_cost numeric,
  p_created_by uuid,
  p_line_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_line jsonb;
  v_line_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_new_serial text;
begin
  perform set_config('app.rpc_name', 'fn_save_purchase_invoice', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  for v_line in select * from jsonb_array_elements(p_line_items) loop
    v_total := v_total + ((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric);
  end loop;
  v_total := v_total + p_shipping_cost;

  insert into purchase_invoices (supplier_name, invoice_number, invoice_date, shipping_cost, total_cost, created_by)
  values (p_supplier_name, p_invoice_number, p_invoice_date, p_shipping_cost, v_total, p_created_by)
  returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_line_items) loop
    v_line_total := (v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric;

    if v_line->>'type' = 'component' then
      insert into purchase_invoice_line_items (invoice_id, component_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, (v_line->>'quantity')::int, (v_line->>'unit_price')::numeric);
      update components set quantity_on_hand = quantity_on_hand + (v_line->>'quantity')::int, unit_cost = (v_line->>'unit_price')::numeric
      where id = (v_line->>'ref_id')::uuid;

    elsif v_line->>'type' = 'consumable' then
      insert into purchase_invoice_line_items (invoice_id, consumable_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, (v_line->>'quantity')::int, (v_line->>'unit_price')::numeric);
      update consumables set quantity_on_hand = quantity_on_hand + (v_line->>'quantity')::int, unit_cost = (v_line->>'unit_price')::numeric
      where id = (v_line->>'ref_id')::uuid;

    elsif v_line->>'type' = 'asset_model' then
      insert into purchase_invoice_line_items (invoice_id, asset_model_id, quantity, unit_cost)
      values (v_invoice_id, (v_line->>'ref_id')::uuid, 1, (v_line->>'unit_price')::numeric);

      v_new_serial := 'SN-' || replace(gen_random_uuid()::text, '-', '');
      insert into assets (serial_number, manufacturer_serial_number, asset_model_id, asset_type, purchase_date, purchase_cost, current_status)
      values (
        substr(v_new_serial, 1, 12),
        nullif(v_line->>'manufacturer_serial_number', ''),
        (v_line->>'ref_id')::uuid,
        coalesce(v_line->>'asset_type', 'component'),
        p_invoice_date,
        (v_line->>'unit_price')::numeric,
        'in_warehouse'
      );
    end if;
  end loop;

  return v_invoice_id;
end;
$$;

create or replace function fn_deploy_assets_bulk(
  p_asset_ids uuid[],
  p_client_id uuid,
  p_deployed_by uuid,
  p_contract_reference text default null,
  p_expected_return_date date default null,
  p_consumables jsonb default '[]'
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
  perform set_config('app.rpc_name', 'fn_deploy_assets_bulk', true);
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

create or replace function fn_retrieve_asset(
  p_deployment_id uuid,
  p_returned_by uuid,
  p_return_condition text,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_asset_id uuid;
  v_source_component_id uuid;
begin
  perform set_config('app.rpc_name', 'fn_retrieve_asset', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;

  select asset_id into v_asset_id from deployments where id = p_deployment_id and actual_return_date is null for update;
  if v_asset_id is null then
    raise exception 'deployment_not_found_or_already_returned';
  end if;

  update deployments
  set actual_return_date = now(), returned_by = p_returned_by, return_condition = p_return_condition, notes = coalesce(p_notes, notes)
  where id = p_deployment_id;

  select source_component_id into v_source_component_id from assets where id = v_asset_id;

  update assets
  set current_status = case
      when p_return_condition in ('damaged','missing') then 'lost_damaged'
      when v_source_component_id is not null then 'retired'
      else 'in_maintenance'
    end,
    current_client_id = null
  where id = v_asset_id;

  if v_source_component_id is not null and p_return_condition = 'good' then
    update components set quantity_on_hand = quantity_on_hand + 1 where id = v_source_component_id;
  end if;
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
  v_source_component_id uuid;
begin
  perform set_config('app.rpc_name', 'fn_retrieve_assets_bulk', true);
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

    select source_component_id into v_source_component_id from assets where id = v_asset_id;

    update assets
    set current_status = case
        when p_return_condition in ('damaged','missing') then 'lost_damaged'
        when v_source_component_id is not null then 'retired'
        else 'in_maintenance'
      end,
      current_client_id = null
    where id = v_asset_id;

    if v_source_component_id is not null and p_return_condition = 'good' then
      update components set quantity_on_hand = quantity_on_hand + 1 where id = v_source_component_id;
    end if;
  end loop;
end;
$$;

create or replace function fn_install_sensors(
  p_client_id uuid,
  p_component_id uuid,
  p_quantity int,
  p_installed_by uuid,
  p_has_battery boolean default true,
  p_battery_level_pct int default null,
  p_battery_expected_life_days int default null,
  p_notes text default null
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_component record;
  v_asset_id uuid;
  v_serial text;
  v_ids uuid[] := '{}';
  i int;
begin
  perform set_config('app.rpc_name', 'fn_install_sensors', true);
  if not fn_is_staff() then
    raise exception 'insufficient_privilege: staff only';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 500 then
    raise exception 'invalid_quantity: %', p_quantity;
  end if;
  if p_battery_level_pct is not null and (p_battery_level_pct < 0 or p_battery_level_pct > 100) then
    raise exception 'invalid_battery_level: %', p_battery_level_pct;
  end if;
  if not exists (select 1 from clients where id = p_client_id) then
    raise exception 'client_not_found: %', p_client_id;
  end if;

  select id, component_name, unit_cost, quantity_on_hand into v_component
  from components where id = p_component_id for update;
  if v_component.id is null then
    raise exception 'component_not_found: %', p_component_id;
  end if;
  if v_component.quantity_on_hand < p_quantity then
    raise exception 'insufficient_stock: % available, % requested', v_component.quantity_on_hand, p_quantity;
  end if;

  update components set quantity_on_hand = quantity_on_hand - p_quantity where id = p_component_id;

  insert into sensor_installations (component_id, client_id, quantity, unit_cost_at_time, installed_by, notes)
  values (p_component_id, p_client_id, p_quantity, v_component.unit_cost, p_installed_by, p_notes);

  for i in 1..p_quantity loop
    v_serial := 'SENS-' || upper(regexp_replace(left(v_component.component_name, 4), '[^a-zA-Z0-9]', '', 'g')) || '-'
      || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);

    insert into assets (
      serial_number, asset_type, sensor_subtype, source_component_id, current_status, current_client_id, condition_grade,
      has_battery, battery_installed_at, battery_expected_life_days, battery_level_pct, battery_level_checked_at
    ) values (
      v_serial, 'sensor', v_component.component_name, p_component_id, 'deployed', p_client_id, 'new',
      p_has_battery,
      case when p_has_battery then current_date else null end,
      case when p_has_battery then p_battery_expected_life_days else null end,
      case when p_has_battery then p_battery_level_pct else null end,
      case when p_has_battery and p_battery_level_pct is not null then current_date else null end
    ) returning id into v_asset_id;

    insert into deployments (asset_id, client_id, deployed_by, notes)
    values (v_asset_id, p_client_id, p_installed_by, p_notes);

    v_ids := array_append(v_ids, v_asset_id);
  end loop;

  return v_ids;
end;
$$;
