-- ============================================================================
-- ربط تركيب الحساسات بالمخزون الحقيقي (نفس المسميات + خصم/إرجاع الكمية)
-- بدل تسمية حرة (sensor_subtype) كان يختارها المستخدم، الحساس الآن لازم
-- يكون بند فعلي بجدول components (نفس منطق BOM/التجميع)، وتركيبه يخصم من
-- quantity_on_hand، وإزالته برجّعها (لو الحالة سليمة) — بالضبط زي التفكيك.
-- ============================================================================

-- تصنيف بنود الحساسات الموجودة فعلياً بالكتالوج تحت فئة 'sensor' عشان تظهر
-- بقائمة اختيار الحساس وقت التركيب. category عمود نصي حر أصلاً، ما نغيّر بنيته.
update components set category = 'sensor'
where component_name in (
  '3-Phase Energy Monitor (120A CT)',
  'Air Quality Monitor',
  'CO2 Air Quality Sensor',
  'Gas Leak Detector Plug',
  'Gas Smart Sensor',
  'Human Presence Sensor',
  'Light Sensor Outdoor',
  'Motion Sensor',
  'Smart BBQ Thermometer',
  'Smart Home Door Window Sensor',
  'Smart Home Temperature & Humidity Monitoring',
  'Smart TDS',
  'Smart Thermometer With Probe sonoff',
  'Smoke Sensor',
  'Tuya Bidirectional Energy Meter – 120A CT, 2 Clamps',
  'Water Leak Detector',
  'Water Tank Level Sensor',
  'Zigbee Light Sensor'
);

-- كل Asset حساس يتولد من fn_install_sensors يرتبط بالبند اللي طُلع منه بالمخزون
alter table assets add column source_component_id uuid references components(id);
create index idx_assets_source_component on assets(source_component_id) where source_component_id is not null;

-- أثر تدقيقي لكل دفعة تركيب حساسات — بنفس روح assembly_event_components
create table sensor_installations (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references components(id),
  client_id uuid not null references clients(id),
  quantity int not null,
  unit_cost_at_time numeric(12,2) not null,
  installed_by uuid not null references profiles(id),
  installed_at timestamptz not null default now(),
  notes text
);

alter table sensor_installations enable row level security;
create policy "staff_full_sensor_installations" on sensor_installations for all using (fn_is_staff()) with check (fn_is_staff());
revoke all on sensor_installations from public, anon;
grant select, insert, update, delete on sensor_installations to authenticated;

-- fn_install_sensors: كان ياخذ p_sensor_subtype نص حر، الآن ياخذ p_component_id
-- من كتالوج المخزون — يتحقق من الكمية المتوفرة، يخصمها، ويسجّل سطر تدقيق
drop function if exists fn_install_sensors(uuid, text, int, uuid, boolean, int, int, text);

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

revoke execute on function fn_install_sensors(uuid, uuid, int, uuid, boolean, int, int, text) from public, anon;
grant execute on function fn_install_sensors(uuid, uuid, int, uuid, boolean, int, int, text) to authenticated;

-- fn_retrieve_asset / fn_retrieve_assets_bulk: لو الأصل المرتجع مصدره بند
-- مخزون (حساس)، نرجّع الكمية للمخزون لو رجع بحالة سليمة، ونقاعده retired
-- بدل in_maintenance (ما نعيد استخدام نفس الوحدة الفردية — المخزون فقط
-- اللي يُعاد استخدامه، بنفس منطق fn_disassemble_device مع القطع bulk)
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
