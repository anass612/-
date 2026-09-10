import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CircleAlert, Save, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, AssetStatus, Component } from '../../lib/types'
import { Card, EmptyState, Field, Mono, PrimaryButton, SecondaryButton, Spinner, StatusPill, Textarea } from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'

interface ConsumedLine { component_id: string; component: Component; quantity: number; condition: 'good' | 'damaged' }

const ELIGIBLE: AssetStatus[] = ['in_maintenance', 'in_warehouse']

export function Teardown() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<Asset[]>([])
  const [selected, setSelected] = useState<Asset | null>(null)
  const [lines, setLines] = useState<ConsumedLine[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!search.trim()) { setCandidates([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('assets').select('*').ilike('serial_number', `%${search}%`).in('current_status', ELIGIBLE).limit(10)
      setCandidates((data as Asset[]) ?? [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [search])

  async function selectAsset(asset: Asset) {
    setSelected(asset)
    setLoading(true)
    const { data: events } = await supabase.from('assembly_events').select('id').eq('resulting_asset_id', asset.id).order('assembled_at', { ascending: false }).limit(1)
    const eventId = (events as { id: string }[] | null)?.[0]?.id
    if (!eventId) { setLines([]); setLoading(false); return }
    const { data: comps } = await supabase.from('assembly_event_components').select('component_id, quantity, components(*)').eq('assembly_event_id', eventId)
    setLines(((comps as Record<string, unknown>[] | null) ?? []).map((c) => ({
      component_id: c.component_id as string, component: c.components as unknown as Component, quantity: c.quantity as number, condition: 'good' as const,
    })))
    setLoading(false)
  }

  function setCondition(id: string, condition: 'good' | 'damaged') {
    setLines((prev) => prev.map((l) => (l.component_id === id ? { ...l, condition } : l)))
  }

  const impact = useMemo(() => {
    const good = lines.filter((l) => l.condition === 'good')
    const damaged = lines.filter((l) => l.condition === 'damaged')
    const wasteValue = damaged.reduce((s, l) => s + l.quantity * l.component.unit_cost, 0)
    return { goodCount: good.length, damagedCount: damaged.length, wasteValue }
  }, [lines])

  async function handleSubmit() {
    if (!selected || !profile) return
    setError(null)
    setSubmitting(true)
    const payload = lines.map((l) => ({ component_id: l.component_id, quantity: l.quantity, condition: l.condition }))
    const { error } = await supabase.rpc('fn_disassemble_device', { p_asset_id: selected.id, p_disassembled_by: profile.id, p_returned_components: payload })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    navigate(`/assets/${selected.id}`)
  }

  const hasActiveWarranty = selected?.warranty_expiry && new Date(selected.warranty_expiry) > new Date()

  return (
    <div>
      <TopBar
        title={t.teardown.title}
        pills={selected ? <StatusPill tone="info">{t.teardown.receivedAt}</StatusPill> : undefined}
        subtitle={selected ? selected.serial_number : undefined}
        actions={<button onClick={() => navigate('/assembly')} style={{ fontSize: 13, color: 'var(--color-link)' }}>{t.assembly.title} →</button>}
      />
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        {!selected ? (
          <Card style={{ maxWidth: 480 }}>
            <Field label={t.assetList.serial}>
              <div className="flex items-center gap-2">
                <Search size={16} color="var(--text-tertiary)" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none border-b"
                  style={{ borderColor: 'var(--border-color)', paddingBottom: 6, fontSize: 14 }}
                  placeholder="RES-2026-0000"
                />
              </div>
            </Field>
            <ul className="mt-3 space-y-1">
              {candidates.map((a) => (
                <li key={a.id}>
                  <button onClick={() => selectAsset(a)} className="w-full text-start px-2 py-2 rounded-lg" style={{ fontSize: 14 }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Mono className="font-medium">{a.serial_number}</Mono> — {t.status[a.current_status]}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : loading ? <Spinner /> : (
          <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
            <Card>
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">{t.teardown.partsList}</div>
                <button onClick={() => setSelected(null)} style={{ fontSize: 13, color: 'var(--color-link)' }}>{t.common.cancel}</button>
              </div>
              {lines.length === 0 ? <EmptyState message={t.common.noData} /> : (
                <div className="space-y-3">
                  {lines.map((l) => (
                    <div key={l.component_id} className="flex items-center justify-between gap-3" style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div className="font-semibold" style={{ fontSize: 14 }}>{l.component.component_name}</div>
                        <Mono style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>× {l.quantity}</Mono>
                      </div>
                      <div data-rime-control className="inline-flex" style={{ borderRadius: 'var(--rime-radius-button)', overflow: 'hidden', border: '1px solid var(--border-color-strong)' }}>
                        <button
                          onClick={() => setCondition(l.component_id, 'good')}
                          className="font-semibold inline-flex items-center gap-1.5"
                          style={{ height: 34, padding: '0 12px', fontSize: 13, border: 'none', background: l.condition === 'good' ? 'var(--success-bg)' : 'var(--surface-primary)', color: l.condition === 'good' ? 'var(--success-text)' : 'var(--text-secondary)' }}
                        >
                          {l.condition === 'good' && <Check size={13} />} {t.teardown.good}
                        </button>
                        <button
                          onClick={() => setCondition(l.component_id, 'damaged')}
                          className="font-semibold inline-flex items-center gap-1.5"
                          style={{ height: 34, padding: '0 12px', fontSize: 13, border: 'none', background: l.condition === 'damaged' ? 'var(--critical-bg)' : 'var(--surface-primary)', color: l.condition === 'damaged' ? 'var(--critical-text)' : 'var(--text-secondary)' }}
                        >
                          {l.condition === 'damaged' && <Check size={13} />} {t.teardown.damagedChoice}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <div className="font-semibold mb-3">{t.teardown.impact}</div>
                <div className="space-y-2" style={{ fontSize: 14 }}>
                  <div className="flex justify-between items-center"><span style={{ color: 'var(--text-secondary)' }}>{t.teardown.returningToStock}</span><StatusPill tone="success">{impact.goodCount}</StatusPill></div>
                  <div className="flex justify-between items-center"><span style={{ color: 'var(--text-secondary)' }}>{t.teardown.writtenOff}</span><StatusPill tone="critical">{impact.damagedCount}</StatusPill></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>{t.teardown.wasteValue}</span><Mono>SAR {impact.wasteValue.toFixed(2)}</Mono></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>{t.teardown.resultingStatus}</span><span>{t.teardown.disassembledStatus}</span></div>
                </div>
              </Card>

              {hasActiveWarranty && (
                <div className="flex items-start gap-2 p-3" style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 'var(--rime-radius-md)' }}>
                  <CircleAlert size={18} color="var(--critical-text)" className="flex-none mt-0.5" />
                  <p style={{ fontSize: 13, color: 'var(--critical-text)' }}>
                    {t.teardown.warrantyCallout} <Mono>{selected.manufacturer_serial_number}</Mono>
                  </p>
                </div>
              )}

              <Card>
                <Field label={t.teardown.notes}>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.teardown.notesPlaceholder} />
                </Field>
                {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>{error}</p>}
                <div className="flex gap-2 mt-3">
                  <PrimaryButton icon={<Check size={16} />} onClick={handleSubmit} disabled={submitting || lines.some((l) => !l.condition)}>
                    {t.teardown.confirmTeardown}
                  </PrimaryButton>
                  <SecondaryButton icon={<Save size={15} />}>{t.teardown.saveAsDraft}</SecondaryButton>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
