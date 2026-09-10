-- ============================================================================
-- نظام إدارة أصول RES — Schema كامل لـ Supabase/Postgres
-- يطابق المواصفة: RIME-Asset-Management-Spec.md
-- ============================================================================
-- ملاحظة تصميم مهمة: استخدمنا TEXT + CHECK constraint بدل ENUM الأصلي بـ Postgres
-- في كل مكان تقريباً. السبب: تعديل قيم ENUM لاحقاً (إضافة/حذف) معقّد ويحتاج
-- migration خاص، بينما تعديل CHECK constraint عملية بسيطة. هذا يخدم بالضبط
-- "البناء المستقبلي" اللي تبيه.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. المستخدمون والأدوار (Users & Roles) — قسم 2.6
-- ============================================================================
-- Supabase Auth يدير جدول auth.users تلقائياً. هذا الجدول يضيف الدور فقط.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'warehouse_staff', 'technician')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table profiles is 'قسم 2.6 — الأدوار: admin (صلاحية كاملة) / warehouse_staff (عمليات المستودع) / technician (يشوف مهامه بس)';

-- ============================================================================
-- 2. المواقع (Location) — قسم 2.5
-- ============================================================================
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'warehouse' check (type in ('warehouse', 'staging_area', 'repair_bench')),
  created_at timestamptz not null default now()
);

comment on table locations is 'قسم 2.5 — مساحة واحدة مفتوحة حالياً. الحقل type جاهز للتوسع لاحقاً بدون تعديل هيكلي.';

-- ============================================================================
-- 3. العملاء والفروع (Client / Branch) — قسم 2.2
-- ============================================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  branch_name text not null,
  branch_address text,
  contact_person text,
  contact_phone text,
  client_sector text, -- مطاعم / تجزئة / إلخ — يُعبّى من القائمة اللي بتزوّدنا فيها
  external_crm_id text, -- يُربط بـ RIME CRM لاحقاً، فارغ حالياً
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_external_crm_id on clients(external_crm_id) where external_crm_id is not null;
create index idx_clients_sector on clients(client_sector);

-- ============================================================================
-- 4. كتالوج الموديلات (Asset Model / Catalog) — قسم 2.7
-- ============================================================================
create table asset_models (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  category text not null, -- camera / NVR / IoT-sensor / gateway / main_device / ...
  preferred_supplier text,
  supplier_contact text,
  unit_cost numeric(12,2),
  lead_time_days int,
  reorder_threshold int not null default 0,
  reorder_quantity int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. القطع الخام (Component) — قسم 2.8.1
-- ============================================================================
create table components (
  id uuid primary key default gen_random_uuid(),
  component_name text not null,
  category text,
  unit_cost numeric(12,2) not null default 0,
  quantity_on_hand int not null default 0,
  reorder_threshold int not null default 0,
  reorder_quantity int not null default 0,
  preferred_supplier text,
  -- true لو هذي القطعة تحتاج تتبع فردي (زي O-NA و SSD) بدل bulk
  requires_individual_tracking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column components.requires_individual_tracking is
  'قسم 2.8.1 — لو true، هذي القطعة تُسجَّل كـ Asset فردي (O-NA, SSD) مو Component bulk. الجدول يبقى موجود للأرشفة/التصنيف بس.';

-- ============================================================================
-- 6. المستهلكات (Consumables) — قسم 2.8.5
-- ============================================================================
create table consumables (
  id uuid primary key default gen_random_uuid(),
  consumable_name text not null, -- CAT7 Ethernet Cable, Power Cable UK plug, ...
  unit_cost numeric(12,2) not null default 0,
  quantity_on_hand int not null default 0,
  reorder_threshold int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 7. تعريف المنتج / BOM (Product Definition) — قسم 2.8.2
-- ============================================================================
create table product_definitions (
  id uuid primary key default gen_random_uuid(),
  product_name text not null, -- "الجهاز الرئيسي RES", "تركيب حساس حرارة", ...
  product_type text not null check (product_type in ('main_device', 'sensor_install')),
  -- عمر البطارية الافتراضي لهذا النوع (لو حساس ببطارية) — nullable لين يتوفر الرقم، قسم 2.8.7
  default_battery_life_days int,
  notes text,
  created_at timestamptz not null default now()
);

-- سطور الـ BOM: كل منتج له عدة مكونات bulk مطلوبة
create table product_bom_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references product_definitions(id) on delete cascade,
  component_id uuid not null references components(id),
  quantity_required int not null default 1,
  unique (product_id, component_id)
);

-- لو المنتج يحتاج قطعة فردية إلزامية (زي O-NA أو SSD)، تُسجَّل هنا بدل product_bom_items
create table product_required_asset_models (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references product_definitions(id) on delete cascade,
  asset_model_id uuid not null references asset_models(id),
  role_label text, -- مثلاً "O-NA" أو "SSD" — يوضح دور القطعة داخل المنتج
  unique (product_id, asset_model_id)
);

-- ============================================================================
-- 8. الأصل (Asset) — قسم 2.1، الجدول الأهم بالنظام كامل
-- ============================================================================
create table assets (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique, -- الرقم الداخلي بعد التجميع/التسجيل
  manufacturer_serial_number text unique, -- رقم الشركة الأم — ثابت للأبد، أساس الضمان (قسم 2.1)
  parent_asset_id uuid references assets(id), -- لو هذا أصل فردي مركّب داخل جهاز أكبر (O-NA/SSD داخل الجهاز النهائي)
  asset_model_id uuid references asset_models(id),
  asset_type text not null, -- camera / NVR / IoT-sensor / gateway / main_device / main_board / ssd / sensor
  sensor_subtype text, -- temperature / door / ... لو asset_type = sensor
  model text,
  manufacturer text,
  purchase_date date,
  purchase_cost numeric(12,2),
  warranty_expiry date, -- مرتبط منطقياً بـ manufacturer_serial_number
  current_status text not null default 'in_warehouse'
    check (current_status in ('in_warehouse','deployed','in_maintenance','in_transit','disassembled','retired','lost_damaged')),
  current_location_id uuid references locations(id),
  current_client_id uuid references clients(id),
  condition_grade text not null default 'new' check (condition_grade in ('new','good','needs_repair','damaged')),

  -- تتبع البطارية — قسم 2.8.7، تنطبق فقط لو asset_type = sensor و has_battery = true
  has_battery boolean not null default false,
  battery_installed_at date,
  battery_expected_life_days int, -- nullable — يُعبّى لاحقاً وقت توفر الرقم
  battery_last_replaced_at date,
  battery_level_pct smallint check (battery_level_pct between 0 and 100), -- آخر قراءة فعلية لمستوى الشحن %، مضافة 0009
  battery_level_checked_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assets_serial on assets(serial_number);
create index idx_assets_manufacturer_serial on assets(manufacturer_serial_number) where manufacturer_serial_number is not null;
create index idx_assets_status on assets(current_status);
create index idx_assets_client on assets(current_client_id) where current_client_id is not null;
create index idx_assets_parent on assets(parent_asset_id) where parent_asset_id is not null;
create index idx_assets_battery_due on assets(battery_installed_at) where has_battery and battery_expected_life_days is not null;

comment on column assets.manufacturer_serial_number is
  'قسم 2.1 — رقم الشركة الأم من الكرتونة. لا يُستبدل أبداً. أساس أي مطالبة ضمان.';

-- ============================================================================
-- 9. عملية التجميع (Assembly Event) — قسم 2.8.3
-- ============================================================================
create table assembly_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references product_definitions(id),
  assembled_by uuid not null references profiles(id),
  assembled_at timestamptz not null default now(),
  resulting_asset_id uuid not null references assets(id),
  total_component_cost numeric(12,2), -- محسوب عند الإنشاء
  notes text
);

-- تفاصيل القطع bulk المستهلكة بهذا التجميع (لكل تجميع عدة سطور)
create table assembly_event_components (
  id uuid primary key default gen_random_uuid(),
  assembly_event_id uuid not null references assembly_events(id) on delete cascade,
  component_id uuid not null references components(id),
  quantity int not null,
  unit_cost_at_time numeric(12,2) not null
);

-- ============================================================================
-- 10. عملية التفكيك (Disassembly Event) — قسم 2.8.4
-- ============================================================================
create table disassembly_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  disassembled_by uuid not null references profiles(id),
  disassembled_at timestamptz not null default now(),
  notes text
);

create table disassembly_event_components (
  id uuid primary key default gen_random_uuid(),
  disassembly_event_id uuid not null references disassembly_events(id) on delete cascade,
  component_id uuid not null references components(id),
  quantity int not null,
  condition text not null check (condition in ('good', 'damaged'))
);

-- ============================================================================
-- 11. سجل النشر (Deployment) — قسم 2.3، قلب النظام
-- ============================================================================
create table deployments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  client_id uuid not null references clients(id),
  contract_reference text, -- يربط لاحقاً بعقد CRM
  deployed_at timestamptz not null default now(),
  expected_return_date date,
  actual_return_date timestamptz,
  deployed_by uuid not null references profiles(id),
  returned_by uuid references profiles(id),
  return_condition text check (return_condition in ('good','needs_repair','damaged','missing')),
  notes text
);

create index idx_deployments_asset on deployments(asset_id);
create index idx_deployments_client on deployments(client_id);
create index idx_deployments_expected_return on deployments(expected_return_date) where actual_return_date is null;

-- المستهلكات المستخدمة بكل عملية نشر — قسم 2.8.5
create table deployment_consumables (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments(id) on delete cascade,
  consumable_id uuid not null references consumables(id),
  quantity_used int not null,
  cost_at_time numeric(12,2) not null
);

-- ============================================================================
-- 12. سجل الصيانة (Maintenance Log) — قسم 2.4، يشمل استبدال البطارية
-- ============================================================================
create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  maintenance_type text not null
    check (maintenance_type in ('inspection','repair','firmware_update','cleaning','battery_replacement')),
  performed_at timestamptz not null default now(),
  performed_by uuid not null references profiles(id),
  cost numeric(12,2) default 0,
  notes text,
  result text check (result in ('passed','failed','needs_parts'))
);

create index idx_maintenance_asset on maintenance_logs(asset_id);

-- ============================================================================
-- 13. مهام الفني (Task / Work Order) — قسم 2.9.1
-- ============================================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null
    check (task_type in ('installation','maintenance','battery_replacement','retrieval','inspection')),
  branch_id uuid not null references clients(id),
  assigned_to uuid not null references profiles(id),
  created_by uuid not null references profiles(id), -- المدير اللي أنشأها
  scheduled_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  related_product_id uuid references product_definitions(id), -- لو تركيب جديد
  related_asset_id uuid references assets(id), -- لو صيانة/استرجاع لجهاز موجود
  checklist text,
  completion_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_tasks_branch on tasks(branch_id);
create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_status on tasks(status);

comment on table tasks is
  'قسم 2.9 و 2.10 — واجهة الفني + مصدر تاريخ الفرع (مبني على branch_id، مستقل عن تغيّر سريال الجهاز)';

-- ============================================================================
-- 14. الفواتير (Invoices) — قسم 2.8.7، توثيق داخلي فقط
-- ============================================================================
create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  invoice_number text,
  invoice_date date not null,
  shipping_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  attached_file_url text, -- رابط الملف المرفوع (Supabase Storage)
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  component_id uuid references components(id),
  consumable_id uuid references consumables(id),
  asset_model_id uuid references asset_models(id), -- لو شراء جهاز/قطعة مُسريلة جاهزة
  quantity int not null,
  unit_cost numeric(12,2) not null,
  check (
    (component_id is not null)::int +
    (consumable_id is not null)::int +
    (asset_model_id is not null)::int = 1
  ) -- كل سطر يشير لنوع واحد بالضبط
);

create table installation_cost_sheets (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments(id),
  component_cost numeric(12,2) not null default 0,
  consumables_cost numeric(12,2) not null default 0,
  shipping_allocation numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  total_unit_cost numeric(12,2) generated always as
    (component_cost + consumables_cost + shipping_allocation + labor_cost) stored,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 15. دوال مساعدة (Stored Procedures) — لضمان سلامة العمليات المركّبة
-- ============================================================================
-- بدون هذي الدوال، أي عملية تجميع/تفكيك تحتاج عدة INSERT/UPDATE من التطبيق،
-- ولو فشل سطر بالنص (انقطاع نت مثلاً)، تنكسر البيانات (قطعة اتخصمت، جهاز ما اتسجل).
-- الحل: كل عملية مركّبة تصير transaction واحدة داخل الدالة نفسها.

create or replace function fn_assemble_device(
  p_product_id uuid,
  p_assembled_by uuid,
  p_new_serial_number text,
  p_manufacturer_asset_ids uuid[] default '{}' -- سريالات O-NA/SSD الداخلة بهذا الجهاز
) returns uuid
language plpgsql
as $$
declare
  v_new_asset_id uuid;
  v_component record;
  v_total_cost numeric(12,2) := 0;
  v_assembly_id uuid;
begin
  -- 1. إنشاء الجهاز الجديد
  insert into assets (serial_number, asset_type, current_status)
  values (p_new_serial_number, 'main_device', 'in_warehouse')
  returning id into v_new_asset_id;

  -- 2. ربط القطع الفردية (O-NA, SSD) كـ parent
  if array_length(p_manufacturer_asset_ids, 1) > 0 then
    update assets set parent_asset_id = v_new_asset_id, current_status = 'in_warehouse'
    where id = any(p_manufacturer_asset_ids);
  end if;

  -- 3. إنشاء سجل التجميع
  insert into assembly_events (product_id, assembled_by, resulting_asset_id)
  values (p_product_id, p_assembled_by, v_new_asset_id)
  returning id into v_assembly_id;

  -- 4. خصم القطع bulk حسب BOM + تسجيل تكلفتها
  for v_component in
    select c.id, c.unit_cost, b.quantity_required
    from product_bom_items b join components c on c.id = b.component_id
    where b.product_id = p_product_id
  loop
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

comment on function fn_assemble_device is
  'قسم 2.8.3 — تجميع جهاز كامل بعملية واحدة atomic: إنشاء الأصل، ربط القطع الفردية، خصم القطع bulk، حساب التكلفة';

create or replace function fn_disassemble_device(
  p_asset_id uuid,
  p_disassembled_by uuid,
  p_returned_components jsonb -- [{"component_id": "...", "quantity": 1, "condition": "good"}, ...]
) returns uuid
language plpgsql
as $$
declare
  v_event_id uuid;
  v_item jsonb;
begin
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

    -- القطع السليمة بس ترجع للمخزون المتاح — قسم 2.8.4
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

comment on function fn_disassemble_device is
  'قسم 2.8.4 — تفكيك جهاز بعملية واحدة atomic: القطع السليمة ترجع للمخزون، التالفة تُسجَّل بدون إرجاع';

-- trigger عام لتحديث updated_at
create or replace function fn_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_assets_updated_at before update on assets
  for each row execute function fn_set_updated_at();
create trigger trg_clients_updated_at before update on clients
  for each row execute function fn_set_updated_at();
create trigger trg_components_updated_at before update on components
  for each row execute function fn_set_updated_at();
create trigger trg_consumables_updated_at before update on consumables
  for each row execute function fn_set_updated_at();

-- ============================================================================
-- 16. Views للتقارير — قسم 11، كل تقرير = view واحد، قابل للربط بأي أداة BI
-- ============================================================================

-- تقرير حالة الأصول (لحظي)
create view v_asset_status_snapshot as
select current_status, asset_type, count(*) as total
from assets
group by current_status, asset_type
order by current_status, asset_type;

-- تقرير مستويات المخزون (قطع + مستهلكات مع بعض)
create view v_stock_levels as
select 'component' as item_kind, id, component_name as item_name, quantity_on_hand, reorder_threshold,
       (quantity_on_hand <= reorder_threshold) as needs_reorder
from components
union all
select 'consumable' as item_kind, id, consumable_name as item_name, quantity_on_hand, reorder_threshold,
       (quantity_on_hand <= reorder_threshold) as needs_reorder
from consumables;

-- تقرير إعادة شراء الأجهزة الجاهزة (asset_models)
create view v_asset_model_reorder as
select am.id, am.model_name, am.reorder_threshold, am.lead_time_days,
       count(a.id) filter (where a.current_status = 'in_warehouse' and a.condition_grade in ('new','good')) as available_count
from asset_models am
left join assets a on a.asset_model_id = am.id
group by am.id, am.model_name, am.reorder_threshold, am.lead_time_days
having count(a.id) filter (where a.current_status = 'in_warehouse' and a.condition_grade in ('new','good')) <= am.reorder_threshold;

-- تقرير الهدر/التلف
create view v_waste_report as
select 'component_disassembly' as source, de.disassembled_at as event_date,
       c.component_name as item_name, dec.quantity, c.unit_cost * dec.quantity as loss_value
from disassembly_event_components dec
join disassembly_events de on de.id = dec.disassembly_event_id
join components c on c.id = dec.component_id
where dec.condition = 'damaged'
union all
select 'deployment_return' as source, d.actual_return_date as event_date,
       a.serial_number as item_name, 1 as quantity, a.purchase_cost as loss_value
from deployments d
join assets a on a.id = d.asset_id
where d.return_condition in ('damaged', 'missing');

-- تقرير التركيبات
create view v_installations_report as
select t.id, t.scheduled_date, t.completed_at, c.client_name, c.branch_name,
       p.product_name, prof.full_name as technician_name
from tasks t
join clients c on c.id = t.branch_id
left join product_definitions p on p.id = t.related_product_id
join profiles prof on prof.id = t.assigned_to
where t.task_type = 'installation' and t.status = 'completed';

-- تقرير انتهاء الضمان
create view v_warranty_expiry as
select serial_number, manufacturer_serial_number, asset_type, warranty_expiry,
       (warranty_expiry - current_date) as days_remaining
from assets
where warranty_expiry is not null
order by warranty_expiry asc;

-- تقرير أداء الفنيين
create view v_technician_performance as
select prof.id as technician_id, prof.full_name,
       count(*) filter (where t.status = 'completed') as completed_tasks,
       count(*) filter (where t.status = 'pending') as pending_tasks,
       avg(extract(epoch from (t.completed_at - t.created_at))/3600) filter (where t.status = 'completed') as avg_hours_to_complete
from tasks t
join profiles prof on prof.id = t.assigned_to
group by prof.id, prof.full_name;

-- سيرة الفروع — مستقل عن تغيّر السريال (قسم 2.10)
create view v_branch_history as
select c.id as branch_id, c.client_name, c.branch_name,
       count(t.id) as total_visits,
       count(t.id) filter (where t.task_type = 'installation') as installations,
       count(t.id) filter (where t.task_type = 'maintenance') as maintenances,
       count(t.id) filter (where t.task_type = 'battery_replacement') as battery_replacements,
       max(t.completed_at) as last_visit
from clients c
left join tasks t on t.branch_id = c.id and t.status = 'completed'
group by c.id, c.client_name, c.branch_name;

-- تقرير التكلفة الإجمالية لكل جهاز (TCO)
create view v_tco_per_unit as
select a.id as asset_id, a.serial_number,
       coalesce(ae.total_component_cost, 0) as assembly_cost,
       coalesce(sum(ml.cost), 0) as maintenance_cost,
       coalesce(ae.total_component_cost, 0) + coalesce(sum(ml.cost), 0) as total_cost_of_ownership
from assets a
left join assembly_events ae on ae.resulting_asset_id = a.id
left join maintenance_logs ml on ml.asset_id = a.id
group by a.id, a.serial_number, ae.total_component_cost;

-- تقرير بطاريات مستحقة (استباقي)
create view v_battery_due as
select serial_number, sensor_subtype, current_client_id, battery_installed_at, battery_expected_life_days,
       (battery_installed_at + (battery_expected_life_days || ' days')::interval)::date as expected_death_date
from assets
where has_battery and battery_expected_life_days is not null
  and (current_date - battery_installed_at) >= (battery_expected_life_days - 14);

-- تنبيهات الاشتراك (اقتراب انتهاء / تأخر استرجاع)
create view v_subscription_alerts as
select d.id as deployment_id, a.serial_number, c.client_name, c.branch_name,
       d.expected_return_date,
       case
         when d.expected_return_date < current_date then 'overdue'
         when d.expected_return_date - current_date <= 14 then 'expiring_soon'
       end as alert_type
from deployments d
join assets a on a.id = d.asset_id
join clients c on c.id = d.client_id
where d.actual_return_date is null
  and d.expected_return_date is not null
  and d.expected_return_date - current_date <= 14;

-- تنبيه: جهاز يرجع بشكل متكرر بمدة قصيرة (مؤشر عطل)
create view v_repeat_returns as
select asset_id, count(*) as deployments_last_6mo,
       avg(extract(day from (coalesce(actual_return_date, now()) - deployed_at))) as avg_duration_days
from deployments
where deployed_at >= (current_date - interval '6 months')
group by asset_id
having count(*) > 3
   and avg(extract(day from (coalesce(actual_return_date, now()) - deployed_at))) < 30;

-- ============================================================================
-- 17. Row Level Security (RLS) — أساسي، يتوسع لاحقاً حسب المرحلة 3
-- ============================================================================
alter table assets enable row level security;
alter table deployments enable row level security;
alter table tasks enable row level security;

-- Admin و Warehouse Staff يشوفون كل شي
create policy "admin_warehouse_full_access_assets" on assets
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','warehouse_staff'))
  );

-- الفني يشوف بس المهام المُسندة له
create policy "technician_own_tasks" on tasks
  for select using (
    assigned_to = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('admin','warehouse_staff'))
  );

create policy "admin_warehouse_manage_tasks" on tasks
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "technician_update_own_tasks" on tasks
  for update using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

create policy "admin_warehouse_full_access_deployments" on deployments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','warehouse_staff'))
  );

-- ============================================================================
-- ملاحظات تنفيذ قبل تشغيل هذا الملف
-- ============================================================================
-- 1. شغّل هذا الملف كامل على مشروع Supabase جديد (SQL Editor أو migration).
-- 2. بعد التشغيل، أنشئ أول مستخدم Admin يدوياً عبر Supabase Auth، وأضف له
--    سطر في profiles بـ role = 'admin'.
-- 3. عبّي product_definitions + product_bom_items بقائمة القطع الفعلية
--    (O-NA و SSD كـ product_required_asset_models، الباقي كـ product_bom_items).
-- 4. استيراد Airtable (قسم 5.5): يكون INSERT مباشر لجدول assets + clients،
--    بعد ما تتأكد من نظافة serial_number (بدون تكرار — عندنا UNIQUE constraint
--    بيرفض أي تكرار تلقائياً، فلو الاستيراد فشل بسبب duplicate key، هذا مؤشر
--    فيه تكرار فعلي بالبيانات القديمة يحتاج تنظيف يدوي قبل الاستيراد).
-- ============================================================================
