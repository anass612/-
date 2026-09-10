import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Mono({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span dir="ltr" className={className} style={{ fontFamily: 'var(--font-mono)', unicodeBidi: 'isolate', ...style }}>
      {children}
    </span>
  )
}

type Tone = 'info' | 'success' | 'warning' | 'critical' | 'neutral'

const TONE_VARS: Record<Tone, { bg: string; border: string; text: string }> = {
  info: { bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info-text)' },
  success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)' },
  critical: { bg: 'var(--critical-bg)', border: 'var(--critical-border)', text: 'var(--critical-text)' },
  neutral: { bg: 'var(--surface-secondary)', border: 'var(--border-color-strong)', text: 'var(--text-secondary)' },
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = TONE_VARS[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border font-semibold"
      style={{ background: c.bg, borderColor: c.border, color: c.text, padding: '2px 10px', fontSize: 'var(--rime-text-xs)' }}
    >
      <span className="rounded-full" style={{ width: 6, height: 6, background: 'currentColor' }} />
      {children}
    </span>
  )
}

export const ASSET_STATUS_TONE: Record<string, Tone> = {
  in_warehouse: 'info',
  deployed: 'success',
  in_maintenance: 'warning',
  in_transit: 'info',
  disassembled: 'neutral',
  retired: 'neutral',
  lost_damaged: 'critical',
}

export const CONDITION_TONE: Record<string, Tone> = {
  new: 'success',
  good: 'success',
  needs_repair: 'warning',
  damaged: 'critical',
  written_off: 'neutral',
}

export const TASK_STATUS_TONE: Record<string, Tone> = {
  pending: 'neutral',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
}

export const CLIENT_STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  inactive: 'neutral',
}

export function KpiCard({ label, value, pill, small }: { label: string; value: ReactNode; pill?: ReactNode; small?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--rime-radius-md)',
        boxShadow: 'var(--rime-shadow-sm)',
        padding: '14px 16px',
      }}
    >
      <span style={{ fontSize: 'var(--rime-text-xs)', color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          style={{
            fontFamily: 'var(--rime-font-display)',
            fontWeight: 600,
            fontSize: small ? 'var(--rime-text-lg)' : 'var(--rime-text-xl)',
          }}
        >
          {value}
        </span>
        {pill}
      </div>
    </div>
  )
}

export function PrimaryButton({ icon, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-[filter] ${className}`}
      style={{
        height: 40,
        padding: '0 16px',
        border: 'none',
        borderRadius: 'var(--rime-radius-button)',
        background: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        fontSize: 14,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function SecondaryButton({ icon, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        height: 40,
        padding: '0 16px',
        border: '1px solid var(--border-color-strong)',
        borderRadius: 'var(--rime-radius-button)',
        background: 'var(--surface-primary)',
        color: 'var(--text-primary)',
        fontSize: 14,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function Field({ label, required, helper, children }: { label?: string; required?: boolean; helper?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && (
        <span className="block mb-1.5" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {label}
          {required && <span style={{ color: 'var(--color-error)' }}> *</span>}
        </span>
      )}
      {children}
      {helper && (
        <span className="block mt-1" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {helper}
        </span>
      )}
    </label>
  )
}

const fieldStyle = {
  height: 44,
  padding: '0 12px',
  background: 'var(--surface-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--rime-radius-sm)',
  fontSize: 14,
  color: 'var(--text-primary)',
  width: '100%',
} as const

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input style={fieldStyle} {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select style={fieldStyle} {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={{ ...fieldStyle, height: 'auto', minHeight: 76, padding: '10px 12px', resize: 'vertical' }} {...props} />
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      data-rime-control
      className="inline-flex"
      style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--rime-radius-button)', padding: 3, gap: 2 }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="font-semibold transition-colors"
          style={{
            height: 34,
            padding: '0 16px',
            borderRadius: 'var(--rime-radius-button)',
            fontSize: 14,
            border: 'none',
            background: value === o.value ? 'var(--surface-primary)' : 'transparent',
            boxShadow: value === o.value ? 'var(--rime-shadow-sm)' : 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      data-rime-control
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center transition-colors"
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        background: checked ? 'var(--color-primary)' : 'var(--surface-tertiary)',
        border: checked ? 'none' : '1px solid var(--border-color-strong)',
        padding: 2,
        cursor: 'pointer',
      }}
    >
      <span
        className="block rounded-full bg-white transition-transform"
        style={{ width: 16, height: 16, transform: checked ? 'translateX(14px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export function Checkbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean }) {
  return (
    <button
      data-rime-control
      onClick={() => onChange(!checked)}
      className="inline-flex items-center justify-center flex-none"
      style={{
        width: 17,
        height: 17,
        borderRadius: 4,
        background: checked || indeterminate ? 'var(--color-primary)' : '#fff',
        border: checked || indeterminate ? 'none' : '1px solid var(--border-color-strong)',
        cursor: 'pointer',
      }}
    >
      {indeterminate && !checked ? (
        <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />
      ) : checked ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
    </button>
  )
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--rime-radius-lg)',
        boxShadow: 'var(--rime-shadow-sm)',
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
      {message}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="rounded-full animate-spin"
        style={{ width: 24, height: 24, border: '2px solid var(--border-color)', borderTopColor: 'var(--color-primary)' }}
      />
    </div>
  )
}
