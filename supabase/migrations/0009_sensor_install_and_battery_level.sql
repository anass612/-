-- ============================================================================
-- تركيب حساسات في الفروع + مستوى شحن البطارية (طلب إضافي بعد استيراد Airtable)
-- قسم 2.8.7 كان فيه فقط "متبقي من العمر الافتراضي" (battery_installed_at + expected_life_days).
-- هذا يضيف قراءة فعلية لمستوى الشحن %، ودالة لتسجيل حساسات جديدة في فرع دفعة واحدة.
-- ============================================================================

alter table assets
  add column battery_level_pct smallint check (battery_level_pct between 0 and 100),
  add column battery_level_checked_at date;

comment on column assets.battery_level_pct is
  'آخر قراءة معروفة لمستوى شحن البطارية % — تُدخل يدوياً من الفني وقت الزيارة، منفصلة عن حساب العمر الافتراضي';
comment on column assets.battery_level_checked_at is
  'تاريخ آخر قراءة لمستوى البطارية';

-- تركيب دفعة حساسات في فرع: كل حساس يصير Asset مستقل بسريال داخلي مولّد تلقائياً
-- + سطر Deployment يربطه بالفرع مباشرة (الحساسات ما تمر على المستودع أول)
create or replace function fn_install_sensors(
  p_client_id uuid,
  p_sensor_subtype text,
  p_quantity int,
  p_installed_by uuid,
  p_has_battery boolean default true,
  p_battery_level_pct int default null,
  p_battery_expected_life_days int default null,
  p_notes text default null
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
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
  if p_sensor_subtype is null or length(trim(p_sensor_subtype)) = 0 then
    raise exception 'invalid_sensor_subtype';
  end if;
  if p_battery_level_pct is not null and (p_battery_level_pct < 0 or p_battery_level_pct > 100) then
    raise exception 'invalid_battery_level: %', p_battery_level_pct;
  end if;
  if not exists (select 1 from clients where id = p_client_id) then
    raise exception 'client_not_found: %', p_client_id;
  end if;

  for i in 1..p_quantity loop
    v_serial := 'SENS-' || upper(regexp_replace(left(p_sensor_subtype, 4), '[^a-zA-Z0-9]', '', 'g')) || '-'
      || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);

    insert into assets (
      serial_number, asset_type, sensor_subtype, current_status, current_client_id, condition_grade,
      has_battery, battery_installed_at, battery_expected_life_days, battery_level_pct, battery_level_checked_at
    ) values (
      v_serial, 'sensor', p_sensor_subtype, 'deployed', p_client_id, 'new',
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

revoke execute on function fn_install_sensors(uuid, text, int, uuid, boolean, int, int, text) from public, anon;
grant execute on function fn_install_sensors(uuid, text, int, uuid, boolean, int, int, text) to authenticated;
