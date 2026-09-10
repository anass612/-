import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/types'
import { Spinner } from './ui'

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center card p-8">
        <p className="text-[var(--color-ink)] mb-2 font-medium">حسابك غير مفعّل بعد</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          لا يوجد ملف صلاحيات (profile) مرتبط بحسابك. تواصل مع مسؤول النظام لإضافتك بالدور المناسب.
        </p>
      </div>
    )
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
