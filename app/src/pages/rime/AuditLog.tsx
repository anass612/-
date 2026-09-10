import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import type { AuditLogRow, Profile } from '../../lib/types'
import { diffFields } from '../../lib/auditDiff'
import { EmptyState, Mono, SecondaryButton, Select, Spinner, StatusPill, TextField } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

const TABLES = ['assets', 'deployments', 'tasks', 'components', 'consumables', 'clients', 'profiles', 'maintenance_logs', 'purchase_invoices']
const ACTION_TONE = { INSERT: 'success', UPDATE: 'info', DELETE: 'critical' } as const
const PAGE_SIZE = 50

export function AuditLog() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [actors, setActors] = useState<Record<string, Profile>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [tableFilter, setTableFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [allActors, setAllActors] = useState<Profile[]>([])

  useEffect(() => {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => setAllActors((data as Profile[]) ?? []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('audit_log').select('*', { count: 'exact' }).order('occurred_at', { ascending: false })
      if (tableFilter) query = query.eq('table_name', tableFilter)
      if (actorFilter) query = query.eq('actor_id', actorFilter)
      if (dateFrom) query = query.gte('occurred_at', dateFrom)
      if (dateTo) query = query.lte('occurred_at', `${dateTo}T23:59:59`)
      const from = page * PAGE_SIZE
      const { data, count } = await query.range(from, from + PAGE_SIZE - 1)
      setRows((data as AuditLogRow[]) ?? [])
      setTotal(count ?? 0)

      const actorIds = [...new Set(((data as AuditLogRow[]) ?? []).map((r) => r.actor_id).filter(Boolean))] as string[]
      if (actorIds.length) {
        const { data: profs } = await supabase.from('profiles').select('*').in('id', actorIds)
        setActors(Object.fromEntries(((profs as Profile[]) ?? []).map((p) => [p.id, p])))
      }
      setLoading(false)
    }
    load()
  }, [tableFilter, actorFilter, dateFrom, dateTo, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <TopBar title={t.audit.title} subtitle={t.audit.subtitle} />
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <Select value={tableFilter} onChange={(e) => { setTableFilter(e.target.value); setPage(0) }} style={{ width: 180 }}>
            <option value="">{t.audit.allTables}</option>
            {TABLES.map((tb) => <option key={tb} value={tb}>{tb}</option>)}
          </Select>
          <Select value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setPage(0) }} style={{ width: 180 }}>
            <option value="">{t.audit.allActors}</option>
            {allActors.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <TextField type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} style={{ width: 160 }} placeholder={t.audit.from} />
          <TextField type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} style={{ width: 160 }} placeholder={t.audit.to} />
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.audit.totalRows(total)}</span>
        </div>

        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message={t.common.noData} /> : (
          <>
            <TableCard>
              <THead>
                <TH>{t.audit.col_time}</TH>
                <TH>{t.audit.col_actor}</TH>
                <TH>{t.audit.col_table}</TH>
                <TH>{t.audit.col_action}</TH>
                <TH>{t.audit.col_source}</TH>
                <TH>{null}</TH>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const changed = diffFields(r.old_row, r.new_row)
                  const isOpen = expandedId === r.id
                  return (
                    <Fragment key={r.id}>
                      <TR onClick={() => setExpandedId(isOpen ? null : r.id)}>
                        <TD><Mono style={{ fontSize: 12 }}>{new Date(r.occurred_at).toLocaleString()}</Mono></TD>
                        <TD style={{ fontSize: 13 }}>{r.actor_id ? actors[r.actor_id]?.full_name ?? t.audit.unknownActor : t.audit.systemActor}</TD>
                        <TD><Mono style={{ fontSize: 12 }}>{r.table_name}</Mono></TD>
                        <TD><StatusPill tone={ACTION_TONE[r.action]}>{r.action}</StatusPill></TD>
                        <TD style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.rpc_name ?? t.audit.directWrite}</TD>
                        <TD>{isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</TD>
                      </TR>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--surface-secondary)', padding: 14 }}>
                            {changed.length === 0 ? (
                              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.audit.noFieldChanges}</span>
                            ) : (
                              <div className="grid gap-1.5" style={{ fontSize: 12 }}>
                                {changed.map((c) => (
                                  <div key={c.key} className="flex gap-2 items-baseline flex-wrap">
                                    <Mono className="font-semibold" style={{ minWidth: 160 }}>{c.key}</Mono>
                                    <Mono style={{ color: 'var(--color-error)', textDecoration: 'line-through' }}>{JSON.stringify(c.before) ?? t.common.dash}</Mono>
                                    <span>→</span>
                                    <Mono style={{ color: 'var(--success-text)' }}>{JSON.stringify(c.after) ?? t.common.dash}</Mono>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </TableCard>

            <div className="flex items-center justify-between mt-4">
              <SecondaryButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>{t.audit.prevPage}</SecondaryButton>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.audit.pageOf(page + 1, totalPages)}</span>
              <SecondaryButton onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>{t.audit.nextPage}</SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
