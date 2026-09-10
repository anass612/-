import { Outlet } from 'react-router-dom'
import { Languages, LogOut } from 'lucide-react'
import { NavRail } from './NavRail'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { useAlertsCount } from '../../hooks/useAlertsCount'

export function AppShell() {
  const { profile, signOut } = useAuth()
  const { locale, toggle } = useLanguage()
  const alertBadge = useAlertsCount()
  const isStaff = profile?.role === 'admin' || profile?.role === 'warehouse_staff'

  if (!isStaff) {
    return (
      <div className="min-h-screen flex justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full" style={{ maxWidth: 480 }}>
          <div className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontFamily: 'var(--rime-font-display)', fontWeight: 600 }}>RIME</span>
            <div className="flex items-center gap-3">
              <button onClick={toggle} className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <Languages size={14} /> {locale === 'ar' ? 'EN' : 'ع'}
              </button>
              <button onClick={() => signOut()} className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <NavRail alertBadge={alertBadge} />
      <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
        <div className="flex justify-end items-center gap-3" style={{ padding: '8px 24px', background: 'var(--surface-primary)', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ fontSize: 13, color: 'var(--text-secondary)' }}
          >
            <Languages size={15} /> {locale === 'ar' ? 'English' : 'العربية'}
          </button>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 font-medium" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <LogOut size={15} />
          </button>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
