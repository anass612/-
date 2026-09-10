-- ============================================================================
-- تشديد الصلاحيات (RLS) على كل الجداول المتبقية + دوال تشغيلية إضافية
-- إضافي فوق 0001_init_schema، قسم "17. RLS" بالمواصفة كان جزئي (assets/deployments/tasks فقط)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- دالة مساعدة: هل المستخدم الحالي admin أو warehouse_staff؟
-- ----------------------------------------------------------------------------
create or replace function fn_is_staff() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'warehouse_staff') and is_active
  );
$$;

create or replace function fn_is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ----------------------------------------------------------------------------
-- تفعيل RLS على كل الجداول المتبقية
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table locations enable row level security;
alter table clients enable row level security;
alter table asset_models enable row level security;
alter table components enable row level security;
alter table consumables enable row level security;
alter table product_definitions enable row level security;
alter table product_bom_items enable row level security;
alter table product_required_asset_models enable row level security;
alter table assembly_events enable row level security;
alter table assembly_event_components enable row level security;
alter table disassembly_events enable row level security;
alter table disassembly_event_components enable row level security;
alter table deployment_consumables enable row level security;
alter table maintenance_logs enable row level security;
alter table purchase_invoices enable row level security;
alter table purchase_invoice_line_items enable row level security;
alter table installation_cost_sheets enable row level security;

-- profiles: كل مستخدم يشوف بروفايله، الـ staff يشوف الكل
create policy "read_own_profile" on profiles for select using (id = auth.uid());
create policy "staff_read_all_profiles" on profiles for select using (fn_is_staff());
create policy "admin_manage_profiles" on profiles for all using (fn_is_admin()) with check (fn_is_admin());

-- الجداول المرجعية/التشغيلية: قراءة وكتابة لـ admin/warehouse_staff فقط (الفني ما يحتاجها مباشرة)
create policy "staff_full_locations" on locations for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_asset_models" on asset_models for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_components" on components for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_consumables" on consumables for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_product_definitions" on product_definitions for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_product_bom_items" on product_bom_items for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_product_required_asset_models" on product_required_asset_models for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_assembly_events" on assembly_events for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_assembly_event_components" on assembly_event_components for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_disassembly_events" on disassembly_events for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_disassembly_event_components" on disassembly_event_components for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_deployment_consumables" on deployment_consumables for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_purchase_invoices" on purchase_invoices for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_purchase_invoice_line_items" on purchase_invoice_line_items for all using (fn_is_staff()) with check (fn_is_staff());
create policy "staff_full_installation_cost_sheets" on installation_cost_sheets for all using (fn_is_staff()) with check (fn_is_staff());

-- clients: staff يدير الكل، الفني يقرأ بس فروع مهامه (يحتاجها بشاشة تفاصيل المهمة)
create policy "staff_full_clients" on clients for all using (fn_is_staff()) with check (fn_is_staff());
create policy "technician_read_assigned_branches" on clients for select using (
  exists (select 1 from tasks where tasks.branch_id = clients.id and tasks.assigned_to = auth.uid())
);

-- maintenance_logs: staff كل شي، الفني يقدر يسجل صيانة لمهامه (عبر fn_complete_task فقط عملياً، لكن نسمح select لتاريخه)
create policy "staff_full_maintenance_logs" on maintenance_logs for all using (fn_is_staff()) with check (fn_is_staff());
create policy "technician_read_own_maintenance" on maintenance_logs for select using (performed_by = auth.uid());

-- ----------------------------------------------------------------------------
-- تحديث تعريف الدوال الحرجة (assemble/disassemble) — إضافة فحص صلاحية داخلي
-- لأن الدوال security definer تتجاوز RLS، لازم تتحقق يدوياً من الدور
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- fn_deploy_asset / fn_retrieve_asset — انتقال حالة بسيط مع أثر تدقيقي (قسم 3)
-- ----------------------------------------------------------------------------
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

create or replace function fn_retrieve_asset(
  p_deployment_id uuid,
  p_returned_by uuid,
  p_return_condition text,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_asset_id uuid;
begin
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

  update assets
  set current_status = case when p_return_condition in ('damaged','missing') then 'lost_damaged' else 'in_maintenance' end,
      current_client_id = null
  where id = v_asset_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_complete_task — قسم 2.9.1: زر "إنهاء المهمة" ينشئ تلقائياً السجل المناسب
-- ----------------------------------------------------------------------------
create or replace function fn_complete_task(
  p_task_id uuid,
  p_completion_notes text default null,
  p_client_id uuid default null,          -- لو installation: العميل المستلم
  p_expected_return_date date default null,
  p_maintenance_result text default null, -- لو maintenance/inspection
  p_maintenance_cost numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task record;
  v_new_asset_id uuid;
begin
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

grant execute on function fn_assemble_device(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function fn_disassemble_device(uuid, uuid, jsonb) to authenticated;
grant execute on function fn_deploy_asset(uuid, uuid, uuid, text, date) to authenticated;
grant execute on function fn_retrieve_asset(uuid, uuid, text, text) to authenticated;
grant execute on function fn_complete_task(uuid, text, uuid, date, text, numeric) to authenticated;
