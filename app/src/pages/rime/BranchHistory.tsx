import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Plus, Truck, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, Client, Component, Deployment, Task } from '../../lib/types'
import { getBatteryInfo } from '../../lib/battery'
import {
  ASSET_STATUS_TONE, Card, CLIENT_STATUS_TONE, EmptyState, Field, KpiCard, Mono, PrimaryButton,
  SecondaryButton, Select, Spinner, StatusPill, TextField, Toggle,
} from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'

type ReturnCondition = 'good' | 'needs_repair' | 'damaged' | 'missing'

interface BranchHistoryRow {
  total_visits: number
  installations: number
  maintenances: number
  battery_replacements: number
}

type LifeUnit = 'days' | 'months' | 'years'
const LIFE_UNIT_DAYS: Record<LifeUnit, number> = { days: 1, months: 30, years: 365 }

export function BranchHistory() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [client, setClient] = useState<Client | null>(null)
  const [history, setHistory] = useState<BranchHistoryRow | null>(null)
  const [deployments, setDeployments] = useState<(Deployment & { asset: Asset | null })[]>([])
  const [tasks, setTasks] = useState<(Task & { technician_name: string | null })[]>([])
  const [loading, setLoading] = useState(true)

  const [sensorComponents, setSensorComponents] = useState<Component[]>([])
  const [showSensorForm, setShowSensorForm] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [hasBattery, setHasBattery] = useState(true)
  const [batteryLevel, setBatteryLevel] = useState('')
  const [lifeValue, setLifeValue] = useState('')
  const [lifeUnit, setLifeUnit] = useState<LifeUnit>('months')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeCondition, setRemoveCondition] = useState<ReturnCondition>('good')
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: c }, { data: h }, { data: dep }, { data: tsk }, { data: sc }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('v_branch_history').select('*').eq('branch_id', id).maybeSingle(),
      supabase.from('deployments').select('*, asset:assets(*)').eq('client_id', id).order('deployed_at', { ascending: false }),
      supabase.from('tasks').select('*, profiles(full_name)').eq('branch_id', id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(6),
      supabase.from('components').select('*').eq('category', 'sensor').order('component_name'),
    ])
    setClient(c as Client)
    setHistory(h as BranchHistoryRow | null)
    setDeployments((dep as (Deployment & { asset: Asset | null })[]) ?? [])
    setTasks(((tsk as Record<string, unknown>[] | null) ?? []).map((row) => ({ ...(row as unknown as Task), technician_name: (row.profiles as { full_name: string } | null)?.full_name ?? null })))
    setSensorComponents((sc as Component[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const selectedComponent = sensorComponents.find((c) => c.id === selectedComponentId)

  async function handleAddSensors() {
    if (!profile || !id) return
    setFormError(null)
    setFormSuccess(null)
    if (!selectedComponentId) { setFormError(t.branch.sensorType); return }
    if (!quantity || quantity < 1) { setFormError(t.branch.quantity); return }
    if (selectedComponent && quantity > selectedComponent.quantity_on_hand) {
      setFormError(`${t.branch.insufficientStock} (${selectedComponent.quantity_on_hand} ${t.branch.availableQty})`)
      return
    }
    const lifeDays = hasBattery && lifeValue ? Math.round(Number(lifeValue) * LIFE_UNIT_DAYS[lifeUnit]) : null

    setSubmitting(true)
    const { error } = await supabase.rpc('fn_install_sensors', {
      p_client_id: id,
      p_component_id: selectedComponentId,
      p_quantity: quantity,
      p_installed_by: profile.id,
      p_has_battery: hasBattery,
      p_battery_level_pct: hasBattery && batteryLevel !== '' ? Number(batteryLevel) : null,
      p_battery_expected_life_days: lifeDays,
      p_notes: notes || null,
    })
    setSubmitting(false)
    if (error) {
      setFormError(error.message.includes('insufficient_stock') ? t.branch.insufficientStock : error.message)
      return
    }

    setFormSuccess(t.branch.sensorsSaved)
    setQuantity(1); setBatteryLevel(''); setLifeValue(''); setNotes('')
    await load()
  }

  async function handleConfirmRemove(deploymentId: string) {
    if (!profile) return
    setRemoveError(null)
    setRemoving(true)
    const { error } = await supabase.rpc('fn_retrieve_asset', {
      p_deployment_id: deploymentId,
      p_returned_by: profile.id,
      p_return_condition: removeCondition,
    })
    setRemoving(false)
    if (error) { setRemoveError(error.message); return }
    setRemovingId(null)
    setRemoveCondition('good')
    await load()
  }

  if (loading) return <Spinner />
  if (!client) return <EmptyState message={t.common.noData} />

  const canEdit = profile?.role === 'admin' || profile?.role === 'warehouse_staff'

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

        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
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
                  <TH>{t.branch.col_type}</TH>
                  <TH>{t.branch.col_period}</TH>
                  <TH>{t.branch.col_currentState}</TH>
                  <TH>{t.branch.col_battery}</TH>
                  {canEdit && <TH>{t.branch.col_actions}</TH>}
                </THead>
                <tbody>
                  {deployments.map((d) => {
                    const b = getBatteryInfo(d.asset, { overdue: t.branch.batteryOverdue, days: t.branch.days })
                    const isActive = !d.actual_return_date
                    return (
                      <TR key={d.id}>
                        <TD>{d.asset ? <Link to={`/assets/${d.asset.id}`}><Mono className="font-medium" style={{ color: 'var(--color-link)' }}>{d.asset.serial_number}</Mono></Link> : t.common.dash}</TD>
                        <TD style={{ fontSize: 13 }}>
                          {d.asset?.asset_type === 'sensor' ? d.asset.sensor_subtype : d.asset?.asset_type ?? t.common.dash}
                        </TD>
                        <TD>
                          <Mono style={{ fontSize: 12 }}>{d.deployed_at.slice(0, 10)} → {d.actual_return_date ? d.actual_return_date.slice(0, 10) : t.deviceHistory.ongoing}</Mono>
                          {d.deployed_at_is_estimated && (
                            <div style={{ fontSize: 10, color: 'var(--warning-text)', marginTop: 2 }} title={t.common.estimatedDate}>● {t.common.estimatedDate}</div>
                          )}
                        </TD>
                        <TD>
                          {!isActive ? (
                            <StatusPill tone="neutral">{t.branch.removedOn} <Mono style={{ fontSize: 11 }}>{d.actual_return_date!.slice(0, 10)}</Mono></StatusPill>
                          ) : (
                            d.asset && <StatusPill tone={ASSET_STATUS_TONE[d.asset.current_status]}>{t.status[d.asset.current_status]}</StatusPill>
                          )}
                        </TD>
                        <TD>
                          {!b ? <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{t.branch.noBattery}</span> : (
                            <div>
                              {b.pct != null && <StatusPill tone={b.tone}>{b.pct}%</StatusPill>}
                              {b.remainingLabel && (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{b.remainingLabel}</div>
                              )}
                              {b.pct == null && !b.remainingLabel && t.common.dash}
                            </div>
                          )}
                        </TD>
                        {canEdit && (
                          <TD>
                            {!isActive ? null : removingId === d.id ? (
                              <div className="flex items-center gap-1.5" style={{ minWidth: 190 }}>
                                <Select value={removeCondition} onChange={(e) => setRemoveCondition(e.target.value as ReturnCondition)} style={{ height: 32, fontSize: 12, padding: '0 6px' }}>
                                  <option value="good">{t.status.good}</option>
                                  <option value="needs_repair">{t.status.needs_repair}</option>
                                  <option value="damaged">{t.status.damaged}</option>
                                  <option value="missing">{t.status.lost_damaged}</option>
                                </Select>
                                <button onClick={() => handleConfirmRemove(d.id)} disabled={removing} style={{ height: 32, width: 32, color: 'var(--success-text)' }} title={t.common.confirm}>
                                  <Check size={16} />
                                </button>
                                <button onClick={() => setRemovingId(null)} style={{ height: 32, width: 32, color: 'var(--text-tertiary)' }} title={t.common.cancel}>
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <SecondaryButton icon={<Truck size={13} />} onClick={() => { setRemovingId(d.id); setRemoveError(null) }} style={{ height: 32, padding: '0 10px', fontSize: 12 }}>
                                {t.branch.remove}
                              </SecondaryButton>
                            )}
                          </TD>
                        )}
                      </TR>
                    )
                  })}
                </tbody>
              </TableCard>
            )}
            {removeError && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>{removeError}</p>}
          </div>
        </div>

        {canEdit && (
          <Card>
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">{t.branch.sensorsInstalled}</div>
              <SecondaryButton icon={showSensorForm ? <X size={14} /> : <Plus size={14} />} onClick={() => setShowSensorForm((v) => !v)}>
                {t.branch.addSensors}
              </SecondaryButton>
            </div>

            {showSensorForm && sensorComponents.length === 0 ? (
              <div className="text-center py-8" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                <p>{t.branch.noSensorComponents}</p>
                <Link to="/stock/catalog" style={{ color: 'var(--color-link)' }}>{t.branch.addFromInventory}</Link>
              </div>
            ) : showSensorForm && (
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <Field label={t.branch.sensorType}>
                  <Select value={selectedComponentId} onChange={(e) => setSelectedComponentId(e.target.value)}>
                    <option value="">—</option>
                    {sensorComponents.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.quantity_on_hand <= 0}>
                        {c.component_name} — {t.branch.availableQty}: {c.quantity_on_hand}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.branch.quantity} helper={selectedComponent ? `${t.branch.availableQty}: ${selectedComponent.quantity_on_hand}` : undefined}>
                  <TextField type="number" min={1} max={selectedComponent?.quantity_on_hand} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </Field>
                <Field label={t.branch.hasBattery}>
                  <div className="flex items-center" style={{ height: 44 }}>
                    <Toggle checked={hasBattery} onChange={setHasBattery} />
                  </div>
                </Field>

                {hasBattery && (
                  <>
                    <Field label={t.branch.batteryLevel}>
                      <TextField type="number" min={0} max={100} value={batteryLevel} onChange={(e) => setBatteryLevel(e.target.value)} />
                    </Field>
                    <Field label={t.branch.batteryExpectedLife}>
                      <TextField type="number" min={0} value={lifeValue} onChange={(e) => setLifeValue(e.target.value)} />
                    </Field>
                    <Field label={t.branch.batteryExpectedLifeUnit}>
                      <Select value={lifeUnit} onChange={(e) => setLifeUnit(e.target.value as LifeUnit)}>
                        <option value="days">{t.branch.days}</option>
                        <option value="months">{t.branch.months}</option>
                        <option value="years">{t.branch.years}</option>
                      </Select>
                    </Field>
                  </>
                )}

                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label={t.branch.notesOptional}>
                    <TextField value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                </div>

                {formError && <p style={{ color: 'var(--color-error)', fontSize: 13, gridColumn: '1 / -1' }}>{formError}</p>}
                {formSuccess && <p style={{ color: 'var(--success-text)', fontSize: 13, gridColumn: '1 / -1' }}>{formSuccess}</p>}

                <div style={{ gridColumn: '1 / -1' }}>
                  <PrimaryButton onClick={handleAddSensors} disabled={submitting}>
                    {submitting ? t.branch.savingSensors : t.branch.saveSensors}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
