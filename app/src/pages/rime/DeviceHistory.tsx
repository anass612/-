import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Truck, Download, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, AuditLogRow, Client, Component, Deployment, MaintenanceLog } from '../../lib/types'
import { getBatteryInfo } from '../../lib/battery'
import { diffFields } from '../../lib/auditDiff'
import {
  ASSET_STATUS_TONE, Card, EmptyState, Field, KpiCard, Mono, SecondaryButton, Spinner, StatusPill, TextField,
} from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

interface AssemblyInfo {
  assembled_at: string
  assembled_by_name: string | null
  total_component_cost: number | null
  bulkParts: { component_name: string; quantity: number }[]
  serializedParts: Asset[]
}

export function DeviceHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([])
  const [assembly, setAssembly] = useState<AssemblyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [readingValue, setReadingValue] = useState('')
  const [savingBattery, setSavingBattery] = useState(false)
  const [batteryError, setBatteryError] = useState<string | null>(null)
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([])
  const [actors, setActors] = useState<Record<string, string>>({})
  const [expandedAuditId, setExpandedAuditId] = useState<number | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: a }, { data: dep }, { data: maint }] = await Promise.all([
      supabase.from('assets').select('*').eq('id', id).single(),
      supabase.from('deployments').select('*').eq('asset_id', id).order('deployed_at', { ascending: false }),
      supabase.from('maintenance_logs').select('*').eq('asset_id', id).order('performed_at', { ascending: false }),
    ])
    setAsset(a as Asset)
    setDeployments((dep as Deployment[]) ?? [])
    setMaintenance((maint as MaintenanceLog[]) ?? [])

    const clientIds = [...new Set((dep as Deployment[] | null)?.map((d) => d.client_id))] as string[]
    if (clientIds.length) {
      const { data: cl } = await supabase.from('clients').select('*').in('id', clientIds)
      setClients(Object.fromEntries(((cl as Client[]) ?? []).map((c) => [c.id, c])))
    }

    const { data: events } = await supabase
      .from('assembly_events')
      .select('id, assembled_at, total_component_cost, assembled_by, profiles(full_name)')
      .eq('resulting_asset_id', id)
      .order('assembled_at', { ascending: false })
      .limit(1)
    const event = (events as Record<string, unknown>[] | null)?.[0]
    if (event) {
      const [{ data: comps }, { data: serialized }] = await Promise.all([
        supabase.from('assembly_event_components').select('quantity, components(component_name)').eq('assembly_event_id', (event as { id?: string }).id ?? ''),
        supabase.from('assets').select('*').eq('parent_asset_id', id),
      ])
      setAssembly({
        assembled_at: event.assembled_at as string,
        assembled_by_name: (event.profiles as { full_name: string } | null)?.full_name ?? null,
        total_component_cost: event.total_component_cost as number | null,
        bulkParts: ((comps as Record<string, unknown>[] | null) ?? []).map((c) => ({
          component_name: (c.components as Component | null)?.component_name ?? '—',
          quantity: c.quantity as number,
        })),
        serializedParts: (serialized as Asset[]) ?? [],
      })
    } else {
      const { data: serialized } = await supabase.from('assets').select('*').eq('parent_asset_id', id)
      setAssembly({ assembled_at: '', assembled_by_name: null, total_component_cost: null, bulkParts: [], serializedParts: (serialized as Asset[]) ?? [] })
    }

    const { data: audit } = await supabase.from('audit_log').select('*').eq('table_name', 'assets').eq('row_id', id).order('occurred_at', { ascending: false })
    setAuditRows((audit as AuditLogRow[]) ?? [])
    const actorIds = [...new Set(((audit as AuditLogRow[]) ?? []).map((r) => r.actor_id).filter(Boolean))] as string[]
    if (actorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', actorIds)
      setActors(Object.fromEntries(((profs as { id: string; full_name: string }[]) ?? []).map((p) => [p.id, p.full_name])))
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleLogReading() {
    if (!asset || readingValue === '') return
    const pct = Number(readingValue)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { setBatteryError(t.branch.batteryLevel); return }
    setBatteryError(null)
    setSavingBattery(true)
    const { error } = await supabase.from('assets')
      .update({ battery_level_pct: pct, battery_level_checked_at: new Date().toISOString().slice(0, 10) })
      .eq('id', asset.id)
    setSavingBattery(false)
    if (error) { setBatteryError(error.message); return }
    setReadingValue('')
    await load()
  }

  async function handleMarkReplaced() {
    if (!asset) return
    setBatteryError(null)
    setSavingBattery(true)
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('assets')
      .update({ battery_installed_at: today, battery_last_replaced_at: today, battery_level_pct: 100, battery_level_checked_at: today })
      .eq('id', asset.id)
    setSavingBattery(false)
    if (error) { setBatteryError(error.message); return }
    await load()
  }

  if (loading) return <Spinner />
  if (!asset) return <EmptyState message={t.common.noData} />

  const canEdit = profile?.role === 'admin' || profile?.role === 'warehouse_staff'
  const battery = getBatteryInfo(asset, { overdue: t.branch.batteryOverdue, days: t.branch.days })
  const totalDeployments = deployments.length
  const totalDays = deployments.reduce((sum, d) => sum + daysBetween(d.deployed_at, d.actual_return_date ?? new Date().toISOString()), 0)
  const avgDuration = totalDeployments ? Math.round(totalDays / totalDeployments) : 0
  const tco = (assembly?.total_component_cost ?? 0) + maintenance.reduce((s, m) => s + (m.cost ?? 0), 0)
  const activeDeployment = deployments.find((d) => !d.actual_return_date)

  return (
    <div>
      <div style={{ padding: '20px 24px', background: 'var(--surface-primary)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 'var(--rime-text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          <Link to="/assets" style={{ color: 'var(--text-tertiary)' }}>{t.deviceHistory.breadcrumb}</Link> / <Mono>{asset.serial_number}</Mono>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Mono className="font-semibold" style={{ fontSize: 'var(--rime-text-2xl)' }}>{asset.serial_number}</Mono>
            <StatusPill tone={ASSET_STATUS_TONE[asset.current_status]}>{t.status[asset.current_status]}</StatusPill>
          </div>
          <div className="flex items-center gap-2">
            {asset.current_status === 'in_warehouse' && (
              <SecondaryButton icon={<Truck size={15} />} onClick={() => navigate(`/deployments?asset=${asset.id}`)}>
                {t.deploy.segDeploy}
              </SecondaryButton>
            )}
            {asset.current_status === 'deployed' && activeDeployment && (
              <SecondaryButton icon={<Truck size={15} />} onClick={() => navigate(`/deployments?mode=retrieve&deployment=${activeDeployment.id}`)}>
                {t.deviceHistory.requestRetrieval}
              </SecondaryButton>
            )}
            <SecondaryButton icon={<Download size={15} />}>{t.deviceHistory.exportHistory}</SecondaryButton>
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
          {asset.asset_type} · {asset.current_client_id ? clients[asset.current_client_id]?.branch_name : t.common.dash}
        </p>
      </div>

      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KpiCard label={t.deviceHistory.installations} value={totalDeployments} />
          <KpiCard label={t.deviceHistory.totalDays} value={totalDays} />
          <KpiCard label={t.deviceHistory.avgDeployment} value={avgDuration} />
          <KpiCard label={t.deviceHistory.tco} value={<Mono>SAR {tco.toLocaleString()}</Mono>} />
        </div>

        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card>
            <div className="font-semibold mb-3">{t.deviceHistory.warranty}</div>
            <div className="space-y-2" style={{ fontSize: 14 }}>
              <div className="flex justify-between p-2 rounded" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t.deviceHistory.manufacturerSerial}</span>
                <Mono className="font-semibold">{asset.manufacturer_serial_number ?? t.common.dash}</Mono>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>{t.deviceHistory.warrantyExpiry}</span>
                {asset.warranty_expiry ? (
                  <StatusPill tone="warning"><Clock size={11} /> {asset.warranty_expiry}</StatusPill>
                ) : t.common.dash}
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>{t.deviceHistory.purchaseDate}</span>
                <Mono>{asset.purchase_date ?? t.common.dash} {asset.purchase_cost ? `· SAR ${asset.purchase_cost}` : ''}</Mono>
              </div>
            </div>
          </Card>

          <Card>
            <div className="font-semibold mb-3">{t.deviceHistory.build}</div>
            {(assembly?.serializedParts.length ?? 0) === 0 && assembly?.bulkParts.length === 0 ? (
              <EmptyState message={t.common.noData} />
            ) : (
              <div className="space-y-2">
                {assembly?.serializedParts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-color)', fontSize: 13 }}>
                    <span>
                      <StatusPill tone="info">{t.assembly.trackingIndividual}</StatusPill> <span className="ms-2">{p.asset_type}</span>
                    </span>
                    <Mono>{p.serial_number}</Mono>
                  </div>
                ))}
                {assembly && assembly.bulkParts.length > 0 && (
                  <div className="grid gap-x-4 gap-y-1.5 mt-2" style={{ gridTemplateColumns: '1fr 1fr', fontSize: 13 }}>
                    {assembly.bulkParts.map((b, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{b.component_name}</span>
                        <Mono>× {b.quantity}</Mono>
                      </div>
                    ))}
                  </div>
                )}
                {assembly?.assembled_at && (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                    {assembly.assembled_by_name} · <Mono>{assembly.assembled_at.slice(0, 10)}</Mono> · SAR {assembly.total_component_cost ?? 0}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {asset.has_battery && (
          <Card className="mb-4">
            <div className="font-semibold mb-3">{t.deviceHistory.battery}</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.deviceHistory.batteryLevelNow}</div>
                {battery?.pct != null ? <StatusPill tone={battery.tone}>{battery.pct}%</StatusPill> : <span>{t.common.dash}</span>}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.deviceHistory.batteryInstalledAt}</div>
                <Mono>{asset.battery_installed_at ?? t.common.dash}</Mono>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.deviceHistory.batteryExpectedLife}</div>
                <Mono>{asset.battery_expected_life_days ? `${asset.battery_expected_life_days} ${t.branch.days}` : t.common.dash}</Mono>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.deviceHistory.batteryRemaining}</div>
                {battery?.remainingLabel ? <StatusPill tone={battery.tone}>{battery.remainingLabel}</StatusPill> : <span>{t.common.dash}</span>}
              </div>
            </div>

            {canEdit && (
              <div className="flex items-end gap-3 mt-4 flex-wrap" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <Field label={t.deviceHistory.logReading}>
                  <TextField type="number" min={0} max={100} value={readingValue} onChange={(e) => setReadingValue(e.target.value)} style={{ width: 120 }} />
                </Field>
                <SecondaryButton onClick={handleLogReading} disabled={savingBattery || readingValue === ''}>{t.deviceHistory.save}</SecondaryButton>
                <SecondaryButton onClick={handleMarkReplaced} disabled={savingBattery}>{t.deviceHistory.markReplaced}</SecondaryButton>
              </div>
            )}
            {batteryError && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>{batteryError}</p>}
            {asset.battery_level_checked_at && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                {t.deviceHistory.batteryLastChecked}: <Mono>{asset.battery_level_checked_at}</Mono>
              </p>
            )}
          </Card>
        )}

        <div className="font-semibold mb-2">{t.deviceHistory.deploymentLog}</div>
        {deployments.length === 0 ? (
          <EmptyState message={t.common.noData} />
        ) : (
          <TableCard>
            <THead>
              <TH>{t.deviceHistory.col_num}</TH>
              <TH>{t.deviceHistory.col_client}</TH>
              <TH>{t.deviceHistory.col_from}</TH>
              <TH>{t.deviceHistory.col_to}</TH>
              <TH>{t.deviceHistory.col_duration}</TH>
              <TH>{t.deviceHistory.col_returnCondition}</TH>
            </THead>
            <tbody>
              {deployments.map((d, i) => (
                <TR key={d.id}>
                  <TD><Mono>{deployments.length - i}</Mono></TD>
                  <TD>{clients[d.client_id]?.client_name} — {clients[d.client_id]?.branch_name}</TD>
                  <TD>
                    <Mono>{d.deployed_at.slice(0, 10)}</Mono>
                    {d.deployed_at_is_estimated && (
                      <div style={{ fontSize: 10, color: 'var(--warning-text)', marginTop: 2 }} title={t.common.estimatedDate}>● {t.common.estimatedDate}</div>
                    )}
                  </TD>
                  <TD><Mono>{d.actual_return_date ? d.actual_return_date.slice(0, 10) : t.deviceHistory.ongoing}</Mono></TD>
                  <TD><Mono>{daysBetween(d.deployed_at, d.actual_return_date ?? new Date().toISOString())}</Mono></TD>
                  <TD>
                    {d.return_condition ? (
                      <StatusPill tone={d.return_condition === 'good' ? 'success' : d.return_condition === 'needs_repair' ? 'warning' : 'critical'}>
                        {t.status[d.return_condition]}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral">{t.deviceHistory.inService}</StatusPill>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        )}

        {profile?.role === 'admin' && (
          <div className="mt-4">
            <div className="font-semibold mb-2">{t.deviceHistory.changeLog}</div>
            {auditRows.length === 0 ? <EmptyState message={t.common.noData} /> : (
              <TableCard>
                <THead>
                  <TH>{t.audit.col_time}</TH>
                  <TH>{t.audit.col_actor}</TH>
                  <TH>{t.audit.col_action}</TH>
                  <TH>{t.audit.col_source}</TH>
                  <TH>{null}</TH>
                </THead>
                <tbody>
                  {auditRows.map((r) => {
                    const changed = diffFields(r.old_row, r.new_row)
                    const isOpen = expandedAuditId === r.id
                    return (
                      <Fragment key={r.id}>
                        <TR onClick={() => setExpandedAuditId(isOpen ? null : r.id)}>
                          <TD><Mono style={{ fontSize: 12 }}>{new Date(r.occurred_at).toLocaleString()}</Mono></TD>
                          <TD style={{ fontSize: 13 }}>{r.actor_id ? actors[r.actor_id] ?? t.audit.unknownActor : t.audit.systemActor}</TD>
                          <TD><StatusPill tone={r.action === 'INSERT' ? 'success' : r.action === 'DELETE' ? 'critical' : 'info'}>{r.action}</StatusPill></TD>
                          <TD style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.rpc_name ?? t.audit.directWrite}</TD>
                          <TD>{isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</TD>
                        </TR>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} style={{ background: 'var(--surface-secondary)', padding: 14 }}>
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
