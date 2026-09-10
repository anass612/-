import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BatteryWarning, Clock, ShoppingCart, ShieldAlert, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { Card, SecondaryButton, Spinner, StatusPill, Toggle } from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'

interface AlertItem {
  key: string
  tone: 'critical' | 'warning' | 'neutral'
  icon: typeof Clock
  title: string
  body: string
  action: { label: string; to: string }
}

interface AlertSettings { email_enabled: boolean; push_enabled: boolean; sms_enabled: boolean; whatsapp_enabled: boolean }

export function Alerts() {
  const { t } = useLanguage()
  const { profile } = useAuth()
  const [items, setItems] = useState<AlertItem[]>([])
  const [repeatReturns, setRepeatReturns] = useState<{ asset_id: string; deployments_last_6mo: number; avg_duration_days: number }[]>([])
  const [settings, setSettings] = useState<AlertSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: sub }, { data: stock }, { data: models }, { data: battery }, { data: warranty }, { data: repeats }, { data: sett }] = await Promise.all([
        supabase.from('v_subscription_alerts').select('*'),
        supabase.from('v_stock_levels').select('*').eq('needs_reorder', true),
        supabase.from('v_asset_model_reorder').select('*'),
        supabase.from('v_battery_due').select('*'),
        supabase.from('v_warranty_expiry').select('*').lte('days_remaining', 30).gte('days_remaining', 0),
        supabase.from('v_repeat_returns').select('*'),
        supabase.from('alert_settings').select('*').eq('id', 'default').single(),
      ])
      setSettings(sett as AlertSettings)
      setRepeatReturns((repeats as typeof repeatReturns) ?? [])

      const built: AlertItem[] = []
      for (const r of (sub as { serial_number: string; client_name: string; branch_name: string; alert_type: string }[]) ?? []) {
        built.push({
          key: `sub-${r.serial_number}`,
          tone: r.alert_type === 'overdue' ? 'critical' : 'warning',
          icon: Clock,
          title: r.alert_type === 'overdue' ? 'Retrieval overdue' : 'Subscription ending soon',
          body: `${r.serial_number} — ${r.client_name} / ${r.branch_name}`,
          action: { label: t.deploy.segRetrieve, to: '/deployments?mode=retrieve' },
        })
      }
      for (const r of (stock as { item_name: string; quantity_on_hand: number; reorder_threshold: number }[]) ?? []) {
        built.push({
          key: `stock-${r.item_name}`,
          tone: 'warning',
          icon: ShoppingCart,
          title: 'Part at reorder threshold',
          body: `${r.item_name} — ${r.quantity_on_hand}/${r.reorder_threshold}`,
          action: { label: t.invoices.title, to: '/invoices/new' },
        })
      }
      for (const r of (models as { model_name: string; available_count: number; reorder_threshold: number }[]) ?? []) {
        built.push({
          key: `model-${r.model_name}`,
          tone: 'warning',
          icon: ShoppingCart,
          title: 'Ready asset model low',
          body: `${r.model_name} — ${r.available_count}/${r.reorder_threshold}`,
          action: { label: t.invoices.title, to: '/invoices/new' },
        })
      }
      for (const r of (battery as { serial_number: string; expected_death_date: string }[]) ?? []) {
        built.push({
          key: `battery-${r.serial_number}`,
          tone: 'critical',
          icon: BatteryWarning,
          title: 'Battery near end of life',
          body: `${r.serial_number} — ${r.expected_death_date}`,
          action: { label: t.nav.tasks, to: '/tasks' },
        })
      }
      for (const r of (warranty as { serial_number: string; days_remaining: number }[]) ?? []) {
        built.push({
          key: `warranty-${r.serial_number}`,
          tone: 'neutral',
          icon: ShieldAlert,
          title: 'Warranty expiring',
          body: `${r.serial_number} — ${r.days_remaining} days left`,
          action: { label: t.deviceHistory.warranty, to: '/assets' },
        })
      }
      setItems(built)
      setLoading(false)
    }
    load()
  }, [t])

  async function toggleSetting(key: keyof AlertSettings) {
    if (!settings || profile?.role !== 'admin') return
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    await supabase.from('alert_settings').update({ [key]: next[key] }).eq('id', 'default')
  }

  if (loading) return <Spinner />

  const critical = items.filter((i) => i.tone === 'critical').length
  const warning = items.filter((i) => i.tone === 'warning').length
  const medium = items.filter((i) => i.tone === 'neutral').length

  return (
    <div>
      <TopBar
        title={t.alerts.title}
        pills={
          <div className="flex gap-2">
            <StatusPill tone="critical">{critical} {t.alerts.critical}</StatusPill>
            <StatusPill tone="warning">{warning} {t.alerts.high}</StatusPill>
            <StatusPill tone="neutral">{medium} {t.alerts.medium}</StatusPill>
          </div>
        }
      />
      <div className="p-6 grid gap-4" style={{ background: 'var(--bg-base)', gridTemplateColumns: '1.55fr 1fr' }}>
        <div className="space-y-2.5">
          {items.map((item) => {
            const Icon = item.icon
            const toneVars = item.tone === 'critical' ? { bg: 'var(--critical-bg)', text: 'var(--critical-text)' } : item.tone === 'warning' ? { bg: 'var(--warning-bg)', text: 'var(--warning-text)' } : { bg: 'var(--surface-primary)', text: 'var(--text-primary)' }
            return (
              <div
                key={item.key}
                className="flex items-start gap-3"
                style={{ padding: '15px 17px', borderRadius: 'var(--rime-radius-md)', background: toneVars.bg, boxShadow: item.tone === 'neutral' ? 'var(--rime-shadow-sm)' : 'none', border: item.tone === 'neutral' ? '1px solid var(--border-color)' : 'none' }}
              >
                <Icon size={18} color={toneVars.text} className="flex-none mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold" style={{ fontSize: 15, color: toneVars.text }}>{item.title}</div>
                  <p style={{ fontSize: 14, color: item.tone === 'neutral' ? 'var(--text-secondary)' : toneVars.text, marginTop: 2 }}>{item.body}</p>
                </div>
                <Link to={item.action.to}>
                  <SecondaryButton>{item.action.label}</SecondaryButton>
                </Link>
              </div>
            )
          })}
          {items.length === 0 && <Card><p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t.common.noData}</p></Card>}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="font-semibold mb-3">{t.alerts.rules}</div>
            <div className="space-y-3">
              {(['email_enabled', 'push_enabled', 'sms_enabled', 'whatsapp_enabled'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span style={{ fontSize: 14, color: key === 'whatsapp_enabled' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    {key === 'email_enabled' ? 'Email digest' : key === 'push_enabled' ? 'Push notifications' : key === 'sms_enabled' ? 'SMS for overdue retrievals' : 'WhatsApp delivery'}
                  </span>
                  <Toggle checked={settings?.[key] ?? false} onChange={() => key !== 'whatsapp_enabled' && toggleSetting(key)} />
                </div>
              ))}
            </div>
          </Card>

          {repeatReturns.length > 0 && (
            <Card>
              <div className="font-semibold mb-2">{t.alerts.repeatReturns}</div>
              {repeatReturns.map((r) => (
                <div key={r.asset_id} className="mb-2">
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    A device redeployed {r.deployments_last_6mo} times in 6 months (avg {Math.round(r.avg_duration_days)} days) — the pattern suggests a quality check.
                  </p>
                  <Link to={`/assets/${r.asset_id}`}>
                    <SecondaryButton icon={<Eye size={14} />} className="mt-1.5">{t.alerts.reviewDevice}</SecondaryButton>
                  </Link>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
