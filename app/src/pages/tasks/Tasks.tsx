import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Asset, Client, Profile, ProductDefinition, Task, TaskType } from '../../lib/types'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, Spinner, Table } from '../../components/ui'

export function Tasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    task_type: 'installation' as TaskType,
    branch_id: '',
    assigned_to: '',
    scheduled_date: '',
    related_product_id: '',
    related_asset_id: '',
    checklist: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: c }, { data: p }, { data: prod }, { data: a }] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('clients').select('*').order('client_name'),
      supabase.from('profiles').select('*').eq('role', 'technician').eq('is_active', true),
      supabase.from('product_definitions').select('*'),
      supabase.from('assets').select('*').order('serial_number').limit(500),
    ])
    setTasks((t as Task[]) ?? [])
    setClients((c as Client[]) ?? [])
    setTechnicians((p as Profile[]) ?? [])
    setProducts((prod as ProductDefinition[]) ?? [])
    setAssets((a as Asset[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))
  const techMap = Object.fromEntries(technicians.map((t) => [t.id, t]))

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('tasks').insert({
      task_type: form.task_type,
      branch_id: form.branch_id,
      assigned_to: form.assigned_to,
      created_by: profile.id,
      scheduled_date: form.scheduled_date || null,
      related_product_id: form.related_product_id || null,
      related_asset_id: form.related_asset_id || null,
      checklist: form.checklist || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ task_type: 'installation', branch_id: '', assigned_to: '', scheduled_date: '', related_product_id: '', related_asset_id: '', checklist: '' })
    setShowForm(false)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="المهام" action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'إلغاء' : 'مهمة جديدة'}</Button>} />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>نوع المهمة</Label>
              <Select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value as TaskType })}>
                {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label>الفرع</Label>
              <Select required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">اختر...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.branch_name}</option>)}
              </Select>
            </div>
            <div>
              <Label>الفني</Label>
              <Select required value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">اختر...</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </div>
            <div>
              <Label>تاريخ الجدولة</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            {form.task_type === 'installation' && (
              <div>
                <Label>المنتج (BOM — للتشيك ليست)</Label>
                <Select value={form.related_product_id} onChange={(e) => setForm({ ...form, related_product_id: e.target.value })}>
                  <option value="">اختر...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </Select>
              </div>
            )}
            <div>
              <Label>الجهاز المرتبط {form.task_type === 'installation' ? '(الجهاز المُجمَّع اللي راح يُركَّب)' : ''}</Label>
              <Select required={form.task_type !== 'installation'} value={form.related_asset_id} onChange={(e) => setForm({ ...form, related_asset_id: e.target.value })}>
                <option value="">اختر...</option>
                {assets.filter((a) => form.task_type !== 'installation' || a.current_status === 'in_warehouse').map((a) => (
                  <option key={a.id} value={a.id}>{a.serial_number} — {a.asset_type}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3"><Label>تعليمات / Checklist</Label><Input value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} /></div>
            {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
            <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'إنشاء المهمة'}</Button></div>
          </form>
        </Card>
      )}

      {tasks.length === 0 ? <EmptyState message="لا توجد مهام" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">الفني</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[var(--color-clarity)]">
                  <td className="px-4 py-3"><Link to={`/tasks/${t.id}`} className="text-[var(--color-horizon)] hover:underline font-medium">{TASK_TYPE_LABELS[t.task_type]}</Link></td>
                  <td className="px-4 py-3">{clientMap[t.branch_id]?.client_name} — {clientMap[t.branch_id]?.branch_name}</td>
                  <td className="px-4 py-3">{techMap[t.assigned_to]?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">{t.scheduled_date ?? '—'}</td>
                  <td className="px-4 py-3">{TASK_STATUS_LABELS[t.status]}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
