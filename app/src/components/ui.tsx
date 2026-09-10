import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import type { AssetStatus } from '../lib/types'
import { ASSET_STATUS_LABELS } from '../lib/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const base = variant === 'primary' ? 'btn-primary' : 'btn-secondary'
  return <button className={`${base} px-4 py-2 text-sm ${className}`} {...props} />
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input px-3 py-2 text-sm w-full ${props.className ?? ''}`} {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input px-3 py-2 text-sm w-full ${props.className ?? ''}`} {...props} />
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs text-[var(--color-ink-soft)] mb-1 label-mono">{children}</label>
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <h1 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h1>
      {action}
    </div>
  )
}

const STATUS_COLORS: Record<AssetStatus, string> = {
  in_warehouse: 'bg-[var(--color-frost)] text-[var(--color-ink)]',
  deployed: 'bg-green-100 text-green-800',
  in_maintenance: 'bg-amber-100 text-amber-800',
  in_transit: 'bg-blue-100 text-blue-800',
  disassembled: 'bg-gray-200 text-gray-700',
  retired: 'bg-gray-300 text-gray-600',
  lost_damaged: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {ASSET_STATUS_LABELS[status]}
    </span>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-[var(--color-ink-soft)] text-sm">{message}</div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-[var(--color-hairline)] border-t-[var(--color-first-light)] rounded-full animate-spin" />
    </div>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">{children}</table>
    </div>
  )
}
