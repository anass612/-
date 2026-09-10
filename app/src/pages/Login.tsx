import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Languages } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { Card, Field, PrimaryButton, TextField } from '../components/rime/primitives'

export function Login() {
  const { session, signIn } = useAuth()
  const { t, locale, toggle } = useLanguage()
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
    <div className="min-h-screen flex items-center justify-center relative" style={{ background: '#0A0E1A' }}>
      <button
        onClick={toggle}
        className="absolute inline-flex items-center gap-1.5 font-medium"
        style={{ top: 20, insetInlineEnd: 20, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}
      >
        <Languages size={15} /> {locale === 'ar' ? 'English' : 'العربية'}
      </button>
      <Card style={{ width: '100%', maxWidth: 380, padding: 32 }}>
        <img src="/images/rime_wordmark_dark.png" alt="RIME" style={{ height: 24, marginBottom: 20 }} />
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>{t.common.appSubtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.common.email}><TextField type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t.common.password}><TextField type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</p>}
          <PrimaryButton type="submit" disabled={busy} className="w-full justify-center">
            {busy ? t.common.loading : t.common.signIn}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
