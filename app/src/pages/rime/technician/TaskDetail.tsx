import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Phone, MapPin, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useLanguage } from '../../../i18n/LanguageContext'
import type { Asset, Client, ProductDefinition, Task } from '../../../lib/types'
import { Card, Checkbox, EmptyState, Field, Mono, PrimaryButton, SecondaryButton, Select, Spinner, StatusPill, Textarea, TextField } from '../../../components/rime/primitives'
import { TASK_STATUS_TONE } from '../../../components/rime/primitives'

export function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, dir } = useLanguage()
  const [task, setTask] = useState<Task | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [product, setProduct] = useState<ProductDefinition | null>(null)
  const [bomItems, setBomItems] = useState<{ id: string; component_name: string }[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notes, setNotes] = useState('')
  const [receivingClientId, setReceivingClientId] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [result, setResult] = useState<'passed' | 'failed' | 'needs_parts'>('passed')

  async function load() {
    if (!id) return
    setLoading(true)
    const { data: tk } = await supabase.from('tasks').select('*').eq('id', id).single()
    setTask(tk as Task)
    if (tk) {
      const [{ data: c }, { data: a }, { data: p }, { data: allClients }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', tk.branch_id).single(),
        tk.related_asset_id ? supabase.from('assets').select('*').eq('id', tk.related_asset_id).single() : Promise.resolve({ data: null }),
        tk.related_product_id ? supabase.from('product_definitions').select('*').eq('id', tk.related_product_id).single() : Promise.resolve({ data: null }),
        supabase.from('clients').select('*').eq('status', 'active'),
      ])
      setClient(c as Client)
      setAsset(a as Asset | null)
      setProduct(p as ProductDefinition | null)
      setClients((allClients as Client[]) ?? [])
      setReceivingClientId(tk.branch_id)

      if (tk.related_product_id) {
        const { data: bom } = await supabase.from('product_bom_items').select('id, components(component_name)').eq('product_id', tk.related_product_id)
        setBomItems(((bom as Record<string, unknown>[] | null) ?? []).map((b) => ({ id: b.id as string, component_name: (b.components as { component_name: string } | null)?.component_name ?? '' })))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault()
    if (!task) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('fn_complete_task', {
      p_task_id: task.id,
      p_completion_notes: notes || null,
      p_client_id: task.task_type === 'installation' ? receivingClientId : null,
      p_expected_return_date: task.task_type === 'installation' ? expectedReturn || null : null,
      p_maintenance_result: ['maintenance', 'inspection', 'retrieval'].includes(task.task_type) ? result : null,
      p_maintenance_cost: 0,
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    navigate(-1)
  }

  if (loading) return <Spinner />
  if (!task) return <EmptyState message={t.common.noData} />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-primary)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--surface-secondary)', transform: dir === 'ltr' ? 'scaleX(-1)' : undefined }}>
            <ChevronRight size={18} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t.technician.taskType[task.task_type]}</div>
            <Mono style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{task.id.slice(0, 8)}</Mono>
          </div>
          <StatusPill tone={TASK_STATUS_TONE[task.status]}>{task.status === 'in_progress' ? t.technician.inProgress : t.status[task.status]}</StatusPill>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{client?.client_name} — {client?.branch_name}</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{client?.branch_address}</p>
          {asset && <Mono style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{asset.serial_number}</Mono>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <a href={`tel:${client?.contact_phone ?? ''}`}>
              <SecondaryButton icon={<Phone size={15} />} className="w-full justify-center">{t.technician.call}</SecondaryButton>
            </a>
            <a href={client?.branch_address ? `https://maps.google.com/?q=${encodeURIComponent(client.branch_address)}` : '#'} target="_blank" rel="noreferrer">
              <SecondaryButton icon={<MapPin size={15} />} className="w-full justify-center">{t.technician.location}</SecondaryButton>
            </a>
          </div>
        </Card>

        {(product || bomItems.length > 0) && (
          <Card>
            <div className="font-semibold mb-2" style={{ fontSize: 14 }}>{t.technician.requiredParts}</div>
            <div className="space-y-2">
              {bomItems.map((b) => (
                <label key={b.id} className="flex items-center gap-2.5" style={{ fontSize: 14 }}>
                  <Checkbox checked={!!checked[b.id]} onChange={(v) => setChecked((p) => ({ ...p, [b.id]: v }))} />
                  {b.component_name}
                </label>
              ))}
            </div>
          </Card>
        )}

        {task.status === 'completed' ? (
          <Card><p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t.status.completed} — {task.completed_at?.slice(0, 16).replace('T', ' ')}</p></Card>
        ) : (
          <form onSubmit={handleComplete}>
            <Card>
              {task.task_type === 'installation' && (
                <div className="space-y-3 mb-3">
                  <Field label={t.deploy.clientBranch} required>
                    <Select value={receivingClientId} onChange={(e) => setReceivingClientId(e.target.value)} required>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.branch_name}</option>)}
                    </Select>
                  </Field>
                  <Field label={t.deploy.expectedReturn}><TextField type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} /></Field>
                </div>
              )}
              {['maintenance', 'inspection', 'retrieval'].includes(task.task_type) && (
                <Field label={t.stock.col_state} >
                  <Select value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
                    <option value="passed">{t.common.good}</option>
                    <option value="failed">{t.common.damaged}</option>
                    <option value="needs_parts">{t.status.needs_repair}</option>
                  </Select>
                </Field>
              )}
              <Field label={t.technician.notes}>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.technician.notesPlaceholder} />
              </Field>
            </Card>

            {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <PrimaryButton type="submit" icon={<Check size={18} />} disabled={submitting} className="w-full justify-center mt-4" style={{ height: 52 }}>
              {t.technician.completeTask}
            </PrimaryButton>
            <p className="text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{t.technician.completeNote}</p>
          </form>
        )}
      </div>
    </div>
  )
}
