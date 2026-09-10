import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, Input, Label } from '../components/ui'

export function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-midnight)' }}>
      <form onSubmit={handleSubmit} className="card p-8 w-full max-w-sm">
        <div className="font-display text-xl font-semibold mb-1">RIME</div>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">نظام إدارة أصول RES</p>

        <div className="mb-4">
          <Label>البريد الإلكتروني</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-4">
          <Label>كلمة المرور</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </Button>
      </form>
    </div>
  )
}
