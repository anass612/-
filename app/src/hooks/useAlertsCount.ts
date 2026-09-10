import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAlertsCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [sub, stock, models, battery, repeats] = await Promise.all([
        supabase.from('v_subscription_alerts').select('*', { count: 'exact', head: true }),
        supabase.from('v_stock_levels').select('*', { count: 'exact', head: true }).eq('needs_reorder', true),
        supabase.from('v_asset_model_reorder').select('*', { count: 'exact', head: true }),
        supabase.from('v_battery_due').select('*', { count: 'exact', head: true }),
        supabase.from('v_repeat_returns').select('*', { count: 'exact', head: true }),
      ])
      if (cancelled) return
      setCount((sub.count ?? 0) + (stock.count ?? 0) + (models.count ?? 0) + (battery.count ?? 0) + (repeats.count ?? 0))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return count
}
