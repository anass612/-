import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner } from '../components/ui'
import { ASSET_STATUS_LABELS, type AssetStatus } from '../lib/types'

interface StatusRow {
  current_status: AssetStatus
  asset_type: string
  total: number
}

interface Alerts {
  subscription: number
  reorderComponents: number
  reorderAssetModels: number
  batteryDue: number
  repeatReturns: number
}

export function Dashboard() {
  const [statusRows, setStatusRows] = useState<StatusRow[]>([])
  const [alerts, setAlerts] = useState<Alerts | null>(null)
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
        reorderComponents: stock.count ?? 0,
        reorderAssetModels: models.count ?? 0,
        batteryDue: battery.count ?? 0,
        repeatReturns: repeats.count ?? 0,
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

  const alertCards = [
    { label: 'اشتراكات قاربت الانتهاء / متأخرة', value: alerts?.subscription ?? 0, to: '/reports?view=v_subscription_alerts' },
    { label: 'قطع/مستهلكات تحتاج إعادة طلب', value: alerts?.reorderComponents ?? 0, to: '/reports?view=v_stock_levels' },
    { label: 'موديلات أجهزة تحتاج إعادة طلب', value: alerts?.reorderAssetModels ?? 0, to: '/reports?view=v_asset_model_reorder' },
    { label: 'بطاريات قاربت الانتهاء', value: alerts?.batteryDue ?? 0, to: '/reports?view=v_battery_due' },
    { label: 'أجهزة ترجع بشكل متكرر (فحص جودة)', value: alerts?.repeatReturns ?? 0, to: '/reports?view=v_repeat_returns' },
  ]

  return (
    <div>
      <PageHeader title="الرئيسية" />

      <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">التنبيهات</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {alertCards.map((a) => (
          <Link key={a.label} to={a.to}>
            <Card className={a.value > 0 ? 'border-[var(--color-first-light)]' : ''}>
              <div className={`text-2xl font-semibold ${a.value > 0 ? 'text-[var(--color-first-light)]' : 'text-[var(--color-ink)]'}`}>
                {a.value}
              </div>
              <div className="text-xs text-[var(--color-ink-soft)] mt-1">{a.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">حالة الأصول</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((status) => (
          <Card key={status}>
            <div className="text-2xl font-semibold">{totalsByStatus[status] ?? 0}</div>
            <div className="text-xs text-[var(--color-ink-soft)] mt-1">{ASSET_STATUS_LABELS[status]}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
