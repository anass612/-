import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Client } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, PageHeader, Spinner, Table } from '../../components/ui'

export function ClientList() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ client_name: '', branch_name: '', branch_address: '', contact_person: '', contact_phone: '', client_sector: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    let query = supabase.from('clients').select('*').order('client_name')
    if (search.trim()) query = query.or(`client_name.ilike.%${search}%,branch_name.ilike.%${search}%`)
    const { data } = await query
    setClients((data as Client[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').insert(form)
    setSaving(false)
    if (!error) {
      setForm({ client_name: '', branch_name: '', branch_address: '', contact_person: '', contact_phone: '', client_sector: '' })
      setShowForm(false)
      load()
    }
  }

  return (
    <div>
      <PageHeader title="العملاء والفروع" action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'إلغاء' : 'إضافة فرع'}</Button>} />

      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-3">
            <div><Label>اسم العميل</Label><Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><Label>اسم الفرع</Label><Input required value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} /></div>
            <div><Label>القطاع</Label><Input value={form.client_sector} onChange={(e) => setForm({ ...form, client_sector: e.target.value })} placeholder="مطاعم / تجزئة..." /></div>
            <div><Label>العنوان</Label><Input value={form.branch_address} onChange={(e) => setForm({ ...form, branch_address: e.target.value })} /></div>
            <div><Label>مسؤول التواصل</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>رقم التواصل</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </Card>
      )}

      <Card className="mb-4">
        <Input placeholder="ابحث بالعميل أو الفرع..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {loading ? <Spinner /> : clients.length === 0 ? <EmptyState message="لا يوجد عملاء" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">القطاع</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[var(--color-clarity)]">
                  <td className="px-4 py-3">
                    <Link to={`/clients/${c.id}`} className="font-medium text-[var(--color-horizon)] hover:underline">{c.client_name}</Link>
                  </td>
                  <td className="px-4 py-3">{c.branch_name}</td>
                  <td className="px-4 py-3">{c.client_sector ?? '—'}</td>
                  <td className="px-4 py-3">{c.status === 'active' ? 'نشط' : 'غير نشط'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
