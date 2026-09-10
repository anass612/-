import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { KpiCard, Spinner, StatusPill } from '../../components/rime/primitives'
import { ASSET_STATUS_TONE } from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'
import type { AssetStatus } from '../../lib/types'

interface StatusRow {
  current_status: AssetStatus
  asset_type: string
  total: number
}

export function Dashboard() {
  const { t } = useLanguage()
  const [statusRows, setStatusRows] = useState<StatusRow[]>([])
  const [alerts, setAlerts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [snapshot, sub, stock, models, battery, repeats] = await Promise.all([
        supabase.from('v_asset_status_snapshot').select('*'),
        supabase.from('v_subscription_alerts').select('*', { count: 'exact', head: true }),
        supabase.from('v_stock_levels').select('*', { count: 'exact', head: true }).eq('needs_reorder', true),
        supabase.from('v_asset_model_reorder').select('*', { count: 'exact', head: true }),
        supabase.from('v_battery_due').select('*', { count: 'exact', head: true }),
        supabase.from('v_repeat_returns').select('*', { count: 'exact', head: true }),
      ])
      setStatusRows((snapshot.data as StatusRow[]) ?? [])
      setAlerts({
        subscription: sub.count ?? 0,
        stock: stock.count ?? 0,
        models: models.count ?? 0,
        battery: battery.count ?? 0,
        repeats: repeats.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  const totalsByStatus = statusRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.current_status] = (acc[r.current_status] ?? 0) + Number(r.total)
    return acc
  }, {})

  const statuses: AssetStatus[] = ['in_warehouse', 'deployed', 'in_maintenance', 'in_transit', 'disassembled', 'retired', 'lost_damaged']

  const alertCards = [
    { label: t.deviceHistory.deploymentLog + ' — ' + t.nav.alerts, value: alerts.subscription ?? 0, to: '/alerts' },
    { label: t.stock.title, value: (alerts.stock ?? 0) + (alerts.models ?? 0), to: '/stock' },
    { label: t.deploy.title, value: alerts.battery ?? 0, to: '/alerts' },
    { label: t.alerts.repeatReturns, value: alerts.repeats ?? 0, to: '/alerts' },
  ]

  return (
    <div>
      <TopBar title={t.nav.dashboard} />
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {alertCards.map((a) => (
            <Link key={a.label} to={a.to}>
              <KpiCard
                label={a.label}
                value={a.value}
                pill={a.value > 0 ? <StatusPill tone="critical">{t.assetList.needsReview}</StatusPill> : undefined}
              />
            </Link>
          ))}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {statuses.map((s) => (
            <KpiCard key={s} label={t.status[s]} value={totalsByStatus[s] ?? 0} pill={<StatusPill tone={ASSET_STATUS_TONE[s]}>{t.status[s]}</StatusPill>} small />
          ))}
        </div>
      </div>
    </div>
  )
}
