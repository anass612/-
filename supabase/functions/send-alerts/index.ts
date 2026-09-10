// يشغّل يومياً عبر pg_cron (راجع migration 0004_alerts_cron.sql)
// يجمع كل التنبيهات الحرجة من قسم 4 بالمواصفة ويرسلها كإيميل واحد عبر Resend.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ALERT_RECIPIENT_EMAIL = Deno.env.get('ALERT_RECIPIENT_EMAIL')
const ALERT_FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'RIME Assets <alerts@resend.dev>'

interface SectionResult {
  title: string
  rows: Record<string, unknown>[]
}

async function fetchSection(client: ReturnType<typeof createClient>, view: string, title: string): Promise<SectionResult> {
  const { data, error } = await client.from(view).select('*').limit(50)
  if (error) {
    return { title, rows: [{ خطأ: error.message }] }
  }
  return { title, rows: data ?? [] }
}

function renderTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '<p style="color:#5A6B85;font-size:13px;">لا يوجد</p>'
  const cols = Object.keys(rows[0])
  const head = cols.map((c) => `<th style="text-align:right;padding:6px 10px;border-bottom:1px solid #E3E6E0;font-size:11px;color:#5A6B85;">${c}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${cols.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #E3E6E0;font-size:13px;">${r[c] ?? '—'}</td>`).join('')}</tr>`
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;direction:rtl;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

Deno.serve(async (req: Request) => {
  // هذي الدالة تُستدعى فقط من pg_cron (راجع migration alerts_cron) — لا يوجد جلسة مستخدم JWT هنا،
  // لذلك verify_jwt معطّل والحماية عبر سر مشترك CRON_SECRET بدل ذلك.
  if (CRON_SECRET && req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  if (!RESEND_API_KEY || !ALERT_RECIPIENT_EMAIL) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY أو ALERT_RECIPIENT_EMAIL غير مُعرّفين بـ secrets' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const sections = await Promise.all([
    fetchSection(client, 'v_subscription_alerts', 'اقتراب انتهاء الاشتراك / تأخر الاسترجاع'),
    fetchSection(client, 'v_stock_levels', 'قطع/مستهلكات وصلت حد إعادة الطلب'),
    fetchSection(client, 'v_asset_model_reorder', 'موديلات أجهزة جاهزة وصلت حد إعادة الطلب'),
    fetchSection(client, 'v_battery_due', 'بطاريات حساسات قاربت الانتهاء'),
    fetchSection(client, 'v_repeat_returns', 'أجهزة ترجع بشكل متكرر (فحص جودة)'),
  ])

  const totalAlerts = sections.reduce((sum, s) => sum + s.rows.length, 0)

  const html = `
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:640px;margin:0 auto;">
      <h2 style="color:#0A0E1A;">تنبيهات نظام إدارة الأصول — ${new Date().toLocaleDateString('ar-SA')}</h2>
      <p style="color:#5A6B85;font-size:13px;">إجمالي التنبيهات النشطة: <strong>${totalAlerts}</strong></p>
      ${sections
        .map(
          (s) => `
        <h3 style="color:#1E3A5F;font-size:15px;margin-top:24px;">${s.title} (${s.rows.length})</h3>
        ${renderTable(s.rows)}
      `
        )
        .join('')}
    </div>
  `

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: ALERT_FROM_EMAIL,
      to: ALERT_RECIPIENT_EMAIL.split(',').map((e) => e.trim()),
      subject: `[RIME Assets] ${totalAlerts} تنبيه نشط — ${new Date().toLocaleDateString('ar-SA')}`,
      html,
    }),
  })

  const emailResult = await emailRes.json()

  return new Response(JSON.stringify({ sent: emailRes.ok, totalAlerts, emailResult }), {
    status: emailRes.ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  })
})
