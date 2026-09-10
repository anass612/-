import { NavLink } from 'react-router-dom'
import {
  LayoutGrid, Box, Wrench, Truck, ClipboardList, Bell, Package, Building2, Receipt, BarChart3,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'

const ICONS = {
  grid: LayoutGrid, box: Box, tool: Wrench, truck: Truck, clipboard: ClipboardList,
  bell: Bell, package: Package, building: Building2, receipt: Receipt, chart: BarChart3,
}

interface NavItem {
  to: string
  key: keyof typeof ICONS
  labelKey: keyof ReturnType<typeof useLanguage>['t']['nav']
  badge?: number
}

const STAFF_ITEMS: NavItem[] = [
  { to: '/', key: 'grid', labelKey: 'dashboard' },
  { to: '/assets', key: 'box', labelKey: 'assets' },
  { to: '/assembly', key: 'tool', labelKey: 'assembly' },
  { to: '/deployments', key: 'truck', labelKey: 'deploy' },
  { to: '/tasks', key: 'clipboard', labelKey: 'tasks' },
  { to: '/alerts', key: 'bell', labelKey: 'alerts' },
  { to: '/stock', key: 'package', labelKey: 'stock' },
  { to: '/clients', key: 'building', labelKey: 'clients' },
  { to: '/invoices', key: 'receipt', labelKey: 'invoices' },
  { to: '/reports', key: 'chart', labelKey: 'reports' },
]

export function NavRail({ alertBadge = 0 }: { alertBadge?: number }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const initials = (profile?.full_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('')

  return (
    <nav
      className="flex flex-col shrink-0"
      style={{ width: 236, background: 'var(--nav-bg)', padding: '18px 12px', gap: 2 }}
    >
      <div className="flex items-center gap-2.5" style={{ padding: '4px 10px 20px' }}>
        <img src="/images/rime_wordmark_white.png" alt="RIME" style={{ height: 20, width: 'auto' }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', borderInlineStart: '1px solid rgba(255,255,255,0.28)', paddingInlineStart: 10 }}>
          {t.common.appSubtitle}
        </span>
      </div>

      {STAFF_ITEMS.map((item) => {
        const Icon = ICONS[item.key]
        const badge = item.labelKey === 'alerts' ? alertBadge : undefined
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 font-medium transition-colors ${isActive ? 'font-semibold' : ''}`
            }
            style={({ isActive }) => ({
              minHeight: 44,
              padding: '0 10px',
              borderRadius: 'var(--rime-radius-button)',
              fontSize: 14,
              background: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? 'var(--color-on-primary)' : '#fafafa',
            })}
          >
            <Icon size={18} strokeWidth={1.7} className="flex-none" />
            <span>{t.nav[item.labelKey]}</span>
            {!!badge && (
              <span
                className="inline-flex items-center justify-center font-bold text-white"
                style={{ marginInlineStart: 'auto', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, fontSize: 11, background: 'var(--critical-text)' }}
              >
                {badge}
              </span>
            )}
          </NavLink>
        )
      })}

      <div
        className="flex items-center gap-2.5 mt-auto"
        style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.16)' }}
      >
        <div
          className="flex items-center justify-center font-semibold text-white"
          style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontSize: 12 }}
        >
          {initials}
        </div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{profile?.full_name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)' }}>{profile?.role}</div>
        </div>
      </div>
    </nav>
  )
}
