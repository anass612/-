-- ============================================================================
-- إصلاح ثغرات أمنية اكتشفها Supabase Advisors بعد تطبيق 0002:
-- 1) RLS ما كان مفعّل فعلياً على assets/deployments/tasks (migration 0001 الأصلية
--    كانت تفعّله بس بأسماء سياسات قديمة — نستبدلها بسياسات staff_full_* الموحّدة)
-- 2) كل views التقارير كانت SECURITY DEFINER ضمنياً (تتجاوز RLS) — لازم security_invoker
-- 3) fn_set_updated_at بدون search_path ثابت
-- 4) دوال RPC الحساسة قابلة للتنفيذ من anon/public
-- ============================================================================

alter table assets enable row level security;
alter table deployments enable row level security;
alter table tasks enable row level security;

drop policy if exists "admin_warehouse_full_access_assets" on assets;
create policy "staff_full_assets" on assets for all using (fn_is_staff()) with check (fn_is_staff());
create policy "technician_read_own_task_assets" on assets for select using (
  exists (select 1 from tasks where tasks.related_asset_id = assets.id and tasks.assigned_to = auth.uid())
);

drop policy if exists "admin_warehouse_full_access_deployments" on deployments;
create policy "staff_full_deployments" on deployments for all using (fn_is_staff()) with check (fn_is_staff());

drop policy if exists "technician_own_tasks" on tasks;
drop policy if exists "admin_warehouse_manage_tasks" on tasks;
drop policy if exists "technician_update_own_tasks" on tasks;
create policy "technician_read_own_tasks" on tasks for select using (assigned_to = auth.uid() or fn_is_staff());
create policy "admin_create_tasks" on tasks for insert with check (fn_is_admin());
create policy "staff_manage_tasks" on tasks for update using (fn_is_staff()) with check (fn_is_staff());
create policy "technician_update_own_tasks" on tasks for update using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());
create policy "staff_delete_tasks" on tasks for delete using (fn_is_staff());

alter view v_asset_status_snapshot set (security_invoker = true);
alter view v_stock_levels set (security_invoker = true);
alter view v_asset_model_reorder set (security_invoker = true);
alter view v_waste_report set (security_invoker = true);
alter view v_installations_report set (security_invoker = true);
alter view v_warranty_expiry set (security_invoker = true);
alter view v_technician_performance set (security_invoker = true);
alter view v_branch_history set (security_invoker = true);
alter view v_tco_per_unit set (security_invoker = true);
alter view v_battery_due set (security_invoker = true);
alter view v_subscription_alerts set (security_invoker = true);
alter view v_repeat_returns set (security_invoker = true);

-- التقارير للـ staff بس (الفني ما يحتاج شاشة تقارير حسب المواصفة قسم 2.6/2.9)
revoke all on
  v_asset_status_snapshot, v_stock_levels, v_asset_model_reorder, v_waste_report,
  v_installations_report, v_warranty_expiry, v_technician_performance, v_branch_history,
  v_tco_per_unit, v_battery_due, v_subscription_alerts, v_repeat_returns
from public, anon, authenticated;

grant select on
  v_asset_status_snapshot, v_stock_levels, v_asset_model_reorder, v_waste_report,
  v_installations_report, v_warranty_expiry, v_technician_performance, v_branch_history,
  v_tco_per_unit, v_battery_due, v_subscription_alerts, v_repeat_returns
to authenticated;

create or replace function fn_set_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function fn_assemble_device(uuid, uuid, text, uuid[]) from public, anon;
revoke execute on function fn_disassemble_device(uuid, uuid, jsonb) from public, anon;
revoke execute on function fn_deploy_asset(uuid, uuid, uuid, text, date) from public, anon;
revoke execute on function fn_retrieve_asset(uuid, uuid, text, text) from public, anon;
revoke execute on function fn_complete_task(uuid, text, uuid, date, text, numeric) from public, anon;
revoke execute on function fn_is_staff() from public, anon;
revoke execute on function fn_is_admin() from public, anon;

grant execute on function fn_is_staff() to authenticated;
grant execute on function fn_is_admin() to authenticated;
