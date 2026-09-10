import type { CSSProperties, ReactNode } from 'react'

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--rime-radius-lg)',
        boxShadow: 'var(--rime-shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 14, textAlign: 'start' }}>
          {children}
        </table>
      </div>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-color)' }}>
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        height: 45,
        padding: '0 16px',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--text-primary)',
        textAlign: 'start',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

export function TR({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
      style={{ borderBottom: '1px solid var(--border-color)' }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <td className={className} style={{ minHeight: 50, padding: '14px 16px', ...style }}>
      {children}
    </td>
  )
}
