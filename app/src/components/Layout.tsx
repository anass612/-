import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STAFF_NAV = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/assets', label: 'الأصول' },
  { to: '/clients', label: 'العملاء والفروع' },
  { to: '/inventory', label: 'المخزون' },
  { to: '/tasks', label: 'المهام' },
  { to: '/reports', label: 'التقارير' },
]

const TECHNICIAN_NAV = [{ to: '/my-tasks', label: 'مهامي', end: true }]

export function Layout() {
  const { profile, signOut } = useAuth()
  const isStaff = profile?.role === 'admin' || profile?.role === 'warehouse_staff'
  const nav = isStaff ? STAFF_NAV : TECHNICIAN_NAV

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'var(--color-clarity)' }}>
      <aside
        className="md:w-60 shrink-0 text-white flex flex-col"
        style={{ background: 'var(--color-midnight)' }}
      >
        <div className="p-5 border-b border-white/10">
          <div className="font-display text-lg font-semibold">RIME</div>
          <div className="text-xs text-white/50 mt-0.5">إدارة الأصول</div>
        </div>
        <nav className="flex-1 p-3 flex md:flex-col gap-1 overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive ? 'bg-[var(--color-first-light)] text-white' : 'text-white/70 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/60">
          <div className="mb-2">{profile?.full_name}</div>
          <button onClick={() => signOut()} className="text-white/80 hover:text-white underline">
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
