-- تحسين أداء: تغليف auth.uid() بـ (select ...) عشان الـ query planner يحسبها مرة وحدة مو لكل صف
-- (Supabase Performance Advisor: auth_rls_initplan)
drop policy "read_own_profile" on profiles;
create policy "read_own_profile" on profiles for select using (id = (select auth.uid()));

drop policy "technician_read_assigned_branches" on clients;
create policy "technician_read_assigned_branches" on clients for select using (
  exists (select 1 from tasks where tasks.branch_id = clients.id and tasks.assigned_to = (select auth.uid()))
);

drop policy "technician_read_own_maintenance" on maintenance_logs;
create policy "technician_read_own_maintenance" on maintenance_logs for select using (performed_by = (select auth.uid()));

drop policy "technician_read_own_task_assets" on assets;
create policy "technician_read_own_task_assets" on assets for select using (
  exists (select 1 from tasks where tasks.related_asset_id = assets.id and tasks.assigned_to = (select auth.uid()))
);

drop policy "technician_read_own_tasks" on tasks;
create policy "technician_read_own_tasks" on tasks for select using (assigned_to = (select auth.uid()) or fn_is_staff());

drop policy "technician_update_own_tasks" on tasks;
create policy "technician_update_own_tasks" on tasks for update using (assigned_to = (select auth.uid())) with check (assigned_to = (select auth.uid()));
