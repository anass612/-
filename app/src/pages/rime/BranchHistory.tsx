import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, Client, Deployment, Task } from '../../lib/types'
import { ASSET_STATUS_TONE, CLIENT_STATUS_TONE, EmptyState, KpiCard, Mono, Spinner, StatusPill } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'

interface BranchHistoryRow {
  total_visits: number
  installations: number
  maintenances: number
  battery_replacements: number
}

export function BranchHistory() {
  const { id } = useParams()
  const { t } = useLanguage()
  const [client, setClient] = useState<Client | null>(null)
  const [history, setHistory] = useState<BranchHistoryRow | null>(null)
  const [deployments, setDeployments] = useState<(Deployment & { asset: Asset | null })[]>([])
  const [tasks, setTasks] = useState<(Task & { technician_name: string | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)
      const [{ data: c }, { data: h }, { data: dep }, { data: tsk }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('v_branch_history').select('*').eq('branch_id', id).maybeSingle(),
        supabase.from('deployments').select('*, asset:assets(*)').eq('client_id', id).order('deployed_at', { ascending: false }),
        supabase.from('tasks').select('*, profiles(full_name)').eq('branch_id', id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(6),
      ])
      setClient(c as Client)
      setHistory(h as BranchHistoryRow | null)
      setDeployments((dep as (Deployment & { asset: Asset | null })[]) ?? [])
      setTasks(((tsk as Record<string, unknown>[] | null) ?? []).map((row) => ({ ...(row as unknown as Task), technician_name: (row.profiles as { full_name: string } | null)?.full_name ?? null })))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <Spinner />
  if (!client) return <EmptyState message={t.common.noData} />

  return (
    <div>
      <div style={{ padding: '20px 24px', background: 'var(--surface-primary)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 'var(--rime-text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          <Link to="/clients" style={{ color: 'var(--text-tertiary)' }}>{t.nav.clients}</Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 style={{ fontFamily: 'var(--rime-font-display)', fontSize: 'var(--rime-text-2xl)', fontWeight: 600, margin: 0 }}>
            {client.client_name} — {client.branch_name}
          </h1>
          <StatusPill tone={CLIENT_STATUS_TONE[client.status]}>{t.status[client.status]}</StatusPill>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>{client.client_sector ?? t.common.dash}</p>
      </div>

      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KpiCard label={t.branch.totalVisits} value={history?.total_visits ?? 0} />
          <KpiCard label={t.branch.installations} value={history?.installations ?? 0} />
          <KpiCard label={t.branch.maintenanceVisits} value={history?.maintenances ?? 0} />
          <KpiCard label={t.branch.batteryReplacements} value={history?.battery_replacements ?? 0} />
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
          <div>
            <div className="font-semibold mb-3">{t.branch.visitTimeline}</div>
            {tasks.length === 0 ? <EmptyState message={t.common.noData} /> : (
              <div>
                {tasks.map((task, i) => (
                  <div key={task.id} className="flex gap-3" style={{ paddingBottom: i === tasks.length - 1 ? 0 : 14 }}>
                    <div className="flex flex-col items-center flex-none">
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--border-color-strong)' }} />
                      {i !== tasks.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 26, background: 'var(--border-color)' }} />}
                    </div>
                    <div style={{ paddingBottom: 4 }}>
                      <div className="font-semibold" style={{ fontSize: 14 }}>{t.technician.taskType[task.task_type]}</div>
                      <Mono style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{task.completed_at?.slice(0, 10)}</Mono>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.technician_name}{task.completion_notes ? ` — ${task.completion_notes}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="font-semibold mb-3">{t.branch.devices}</div>
            {deployments.length === 0 ? <EmptyState message={t.common.noData} /> : (
              <TableCard>
                <THead>
                  <TH>{t.branch.col_serial}</TH>
                  <TH>{t.branch.col_period}</TH>
                  <TH>{t.branch.col_currentState}</TH>
                </THead>
                <tbody>
                  {deployments.map((d) => (
                    <TR key={d.id}>
                      <TD>{d.asset ? <Link to={`/assets/${d.asset.id}`}><Mono className="font-medium" style={{ color: 'var(--color-link)' }}>{d.asset.serial_number}</Mono></Link> : t.common.dash}</TD>
                      <TD><Mono style={{ fontSize: 12 }}>{d.deployed_at.slice(0, 10)} → {d.actual_return_date ? d.actual_return_date.slice(0, 10) : t.deviceHistory.ongoing}</Mono></TD>
                      <TD>{d.asset && <StatusPill tone={ASSET_STATUS_TONE[d.asset.current_status]}>{t.status[d.asset.current_status]}</StatusPill>}</TD>
                    </TR>
                  ))}
                </tbody>
              </TableCard>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
