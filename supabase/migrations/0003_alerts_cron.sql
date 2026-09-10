-- ============================================================================
-- جدولة التنبيه اليومي (قسم 4 + 9.5 بالمواصفة: "أهم ميزة عملية بالنظام")
-- يستدعي Edge Function send-alerts يومياً الساعة 6 صباحاً (توقيت السعودية = 3 UTC)
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- سر مشترك بين هذا الجدول وEdge Function (يُقارَن بـ CRON_SECRET بمتغيرات الدالة)
select vault.create_secret('87ce7c8b0a3d70714947def45d28f456b7c11ac84a7f0768121d6f94a97b4de6', 'cron_secret', 'Shared secret for pg_cron -> send-alerts edge function auth');

select cron.schedule(
  'daily-asset-alerts',
  '0 3 * * *', -- 06:00 توقيت السعودية (UTC+3)
  $$
  select net.http_post(
    url := 'https://pvhznqngnzpyvtdcfofh.supabase.co/functions/v1/send-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
