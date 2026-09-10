import type { ReactNode } from 'react'

export function TopBar({ title, subtitle, pills, actions }: { title: string; subtitle?: string; pills?: ReactNode; actions?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4 flex-wrap"
      style={{ minHeight: 64, padding: '12px 24px', background: 'var(--surface-primary)', borderBottom: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <h1 style={{ fontFamily: 'var(--rime-font-display)', fontSize: 'var(--rime-text-lg)', fontWeight: 600, margin: 0 }}>{title}</h1>
        {subtitle && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{subtitle}</span>}
        {pills}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
