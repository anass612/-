-- إعدادات قواعد التنبيه (شاشة 7 بتصميم RIME) — صف واحد ثابت، الأدمن بس يعدّله
create table alert_settings (
  id text primary key default 'default' check (id = 'default'),
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false, -- غير مفعّل حاليًا، يحتاج تكامل خارجي
  updated_at timestamptz not null default now()
);

insert into alert_settings (id) values ('default');

alter table alert_settings enable row level security;

create policy "staff_read_alert_settings" on alert_settings for select using (fn_is_staff());
create policy "admin_update_alert_settings" on alert_settings for update using (fn_is_admin()) with check (fn_is_admin());

revoke all on alert_settings from public, anon;
grant select on alert_settings to authenticated;
grant update on alert_settings to authenticated;
