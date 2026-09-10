import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Asset, AssetModel } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, Select, Spinner, Table } from '../../components/ui'

const emptyForm = { model_name: '', category: '', preferred_supplier: '', unit_cost: 0, lead_time_days: 0, reorder_threshold: 0, reorder_quantity: 0 }

export function AssetModelsTab() {
  const [items, setItems] = useState<AssetModel[]>([])
  const [available, setAvailable] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('asset_models').select('*').order('model_name')
    setItems((data as AssetModel[]) ?? [])

    const { data: assets } = await supabase
      .from('assets')
      .select('asset_model_id, current_status, condition_grade')
      .not('asset_model_id', 'is', null)
    const counts: Record<string, number> = {}
    for (const a of (assets as Pick<Asset, 'asset_model_id' | 'current_status' | 'condition_grade'>[]) ?? []) {
      if (a.current_status === 'in_warehouse' && ['new', 'good'].includes(a.condition_grade) && a.asset_model_id) {
        counts[a.asset_model_id] = (counts[a.asset_model_id] ?? 0) + 1
      }
    }
    setAvailable(counts)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('asset_models').insert(form)
    setSaving(false)
    if (!error) {
      setForm(emptyForm)
      setShowForm(false)
      load()
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'إلغاء' : 'إضافة موديل'}</Button>
      </div>
      <RegisterSerializedAsset models={items} onRegistered={load} />
      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-3">
            <div><Label>اسم الموديل</Label><Input required value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} /></div>
            <div><Label>الفئة</Label><Input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="camera / NVR / gateway..." /></div>
            <div><Label>المورّد المفضّل</Label><Input value={form.preferred_supplier} onChange={(e) => setForm({ ...form, preferred_supplier: e.target.value })} /></div>
            <div><Label>تكلفة الوحدة</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} /></div>
            <div><Label>مدة التوريد (يوم)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: Number(e.target.value) })} /></div>
            <div><Label>حد إعادة الطلب</Label><Input type="number" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: Number(e.target.value) })} /></div>
            <div><Label>كمية إعادة الطلب</Label><Input type="number" value={form.reorder_quantity} onChange={(e) => setForm({ ...form, reorder_quantity: Number(e.target.value) })} /></div>
            <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </Card>
      )}

      {items.length === 0 ? <EmptyState message="لا توجد موديلات مسجّلة بعد" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">الموديل</th>
                <th className="px-4 py-3">الفئة</th>
                <th className="px-4 py-3">المتوفر بالمستودع</th>
                <th className="px-4 py-3">حد الطلب</th>
                <th className="px-4 py-3">مدة التوريد</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className={`border-b border-[var(--color-hairline)] last:border-0 ${(available[m.id] ?? 0) <= m.reorder_threshold ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">{m.model_name}</td>
                  <td className="px-4 py-3">{m.category}</td>
                  <td className="px-4 py-3 font-medium">{available[m.id] ?? 0}</td>
                  <td className="px-4 py-3">{m.reorder_threshold}</td>
                  <td className="px-4 py-3">{m.lead_time_days ?? '—'} يوم</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function RegisterSerializedAsset({ models, onRegistered }: { models: AssetModel[]; onRegistered: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ asset_model_id: '', manufacturer_serial_number: '', asset_type: '', purchase_date: '', purchase_cost: 0, warranty_expiry: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const model = models.find((m) => m.id === form.asset_model_id)
    const serialNumber = `SN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const { error } = await supabase.from('assets').insert({
      serial_number: serialNumber,
      manufacturer_serial_number: form.manufacturer_serial_number || null,
      asset_model_id: form.asset_model_id || null,
      asset_type: form.asset_type || model?.category || 'component',
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost || null,
      warranty_expiry: form.warranty_expiry || null,
      current_status: 'in_warehouse',
      condition_grade: 'new',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ asset_model_id: '', manufacturer_serial_number: '', asset_type: '', purchase_date: '', purchase_cost: 0, warranty_expiry: '' })
    setOpen(false)
    onRegistered()
  }

  return (
    <Card className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-[var(--color-horizon)]">
        {open ? 'إخفاء' : '+ تسجيل قطعة مُسريلة جديدة (O-NA / SSD / بوابة...) من الشركة الأم'}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-3 mt-4">
          <div>
            <Label>الموديل (اختياري)</Label>
            <Select value={form.asset_model_id} onChange={(e) => setForm({ ...form, asset_model_id: e.target.value })}>
              <option value="">بدون موديل محدد</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
            </Select>
          </div>
          <div><Label>نوع الأصل</Label><Input value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })} placeholder="main_board / ssd / gateway / sensor" required /></div>
          <div><Label>السريال من الشركة الأم</Label><Input required value={form.manufacturer_serial_number} onChange={(e) => setForm({ ...form, manufacturer_serial_number: e.target.value })} /></div>
          <div><Label>تاريخ الشراء</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
          <div><Label>تكلفة الشراء</Label><Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: Number(e.target.value) })} /></div>
          <div><Label>انتهاء الضمان</Label><Input type="date" value={form.warranty_expiry} onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })} /></div>
          {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
          <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري التسجيل...' : 'تسجيل'}</Button></div>
        </form>
      )}
    </Card>
  )
}
