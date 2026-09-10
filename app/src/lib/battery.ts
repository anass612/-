import type { Asset } from './types'

export interface BatteryInfo {
  pct: number | null
  remainingDays: number | null
  remainingLabel: string | null
  tone: 'critical' | 'warning' | 'success' | 'neutral'
}

export function getBatteryInfo(
  asset: Asset | null | undefined,
  labels: { overdue: string; days: string },
): BatteryInfo | null {
  if (!asset || !asset.has_battery) return null

  let remainingDays: number | null = null
  if (asset.battery_installed_at && asset.battery_expected_life_days) {
    const deathTime = new Date(asset.battery_installed_at).getTime() + asset.battery_expected_life_days * 86400000
    remainingDays = Math.round((deathTime - Date.now()) / 86400000)
  }

  const pct = asset.battery_level_pct
  const tone: BatteryInfo['tone'] = pct != null
    ? pct < 20 ? 'critical' : pct < 50 ? 'warning' : 'success'
    : remainingDays != null
      ? remainingDays <= 0 ? 'critical' : remainingDays <= 14 ? 'warning' : 'success'
      : 'neutral'

  const remainingLabel = remainingDays == null ? null : remainingDays <= 0 ? labels.overdue : `${remainingDays} ${labels.days}`

  return { pct, remainingDays, remainingLabel, tone }
}
