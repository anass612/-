import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Component } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, Spinner, Table } from '../../components/ui'

const emptyForm = { component_name: '', category: '', unit_cost: 0, quantity_on_hand: 0, reorder_threshold: 0, reorder_quantity: 0, preferred_supplier: '', requires_individual_tracking: false }

export function ComponentsTab() {
  const [items, setItems] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('components').select('*').order('component_name')
    setItems((data as Component[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('components').insert(form)
    setSaving(false)
    if (!error) {
      setForm(emptyForm)
      setShowForm(false)
      load()
    }
  }

  async function adjustQuantity(id: string, delta: number) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await supabase.from('components').update({ quantity_on_hand: item.quantity_on_hand + delta }).eq('id', id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="mb-4"><Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'إلغاء' : 'إضافة قطعة'}</Button></div>
      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-3">
            <div><Label>اسم القطعة</Label><Input required value={form.component_name} onChange={(e) => setForm({ ...form, component_name: e.target.value })} /></div>
            <div><Label>الفئة</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>المورّد المفضّل</Label><Input value={form.preferred_supplier} onChange={(e) => setForm({ ...form, preferred_supplier: e.target.value })} /></div>
            <div><Label>تكلفة الوحدة</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} /></div>
            <div><Label>الكمية الحالية</Label><Input type="number" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: Number(e.target.value) })} /></div>
            <div><Label>حد إعادة الطلب</Label><Input type="number" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: Number(e.target.value) })} /></div>
            <div><Label>كمية إعادة الطلب</Label><Input type="number" value={form.reorder_quantity} onChange={(e) => setForm({ ...form, reorder_quantity: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm mt-5">
              <input type="checkbox" checked={form.requires_individual_tracking} onChange={(e) => setForm({ ...form, requires_individual_tracking: e.target.checked })} />
              تحتاج تتبع فردي (سريال)
            </label>
            <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </Card>
      )}

      {items.length === 0 ? <EmptyState message="لا توجد قطع مسجّلة بعد" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">المتوفر</th>
                <th className="px-4 py-3">حد الطلب</th>
                <th className="px-4 py-3">تكلفة الوحدة</th>
                <th className="px-4 py-3">تعديل</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className={`border-b border-[var(--color-hairline)] last:border-0 ${c.quantity_on_hand <= c.reorder_threshold ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">{c.component_name}</td>
                  <td className="px-4 py-3 font-medium">{c.quantity_on_hand}</td>
                  <td className="px-4 py-3">{c.reorder_threshold}</td>
                  <td className="px-4 py-3">{c.unit_cost}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => adjustQuantity(c.id, 1)} className="px-2 py-1 rounded bg-[var(--color-clarity)] border border-[var(--color-hairline)]">+1</button>
                    <button onClick={() => adjustQuantity(c.id, -1)} className="px-2 py-1 rounded bg-[var(--color-clarity)] border border-[var(--color-hairline)]">-1</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
