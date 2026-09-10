import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Asset, Client, ProductDefinition, Task } from '../../lib/types'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, PageHeader, Select, Spinner } from '../../components/ui'

export function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [product, setProduct] = useState<ProductDefinition | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notes, setNotes] = useState('')
  const [receivingClientId, setReceivingClientId] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [result, setResult] = useState<'passed' | 'failed' | 'needs_parts'>('passed')
  const [cost, setCost] = useState(0)

  async function load() {
    if (!id) return
    setLoading(true)
    const { data: t } = await supabase.from('tasks').select('*').eq('id', id).single()
    setTask(t as Task)
    if (t) {
      const [{ data: c }, { data: a }, { data: p }, { data: allClients }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', t.branch_id).single(),
        t.related_asset_id ? supabase.from('assets').select('*').eq('id', t.related_asset_id).single() : Promise.resolve({ data: null }),
        t.related_product_id ? supabase.from('product_definitions').select('*').eq('id', t.related_product_id).single() : Promise.resolve({ data: null }),
        supabase.from('clients').select('*').eq('status', 'active'),
      ])
      setClient(c as Client)
      setAsset(a as Asset | null)
      setProduct(p as ProductDefinition | null)
      setClients((allClients as Client[]) ?? [])
      setReceivingClientId(t.branch_id)
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
      p_maintenance_cost: cost,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(-1)
  }

  if (loading) return <Spinner />
  if (!task) return <EmptyState message="المهمة غير موجودة" />

  return (
    <div>
      <PageHeader title={TASK_TYPE_LABELS[task.task_type]} />

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-2">الفرع</div>
          <div className="font-medium">{client?.client_name} — {client?.branch_name}</div>
          <div className="text-sm text-[var(--color-ink-soft)] mt-1">{client?.branch_address}</div>
          <div className="text-sm text-[var(--color-ink-soft)]">{client?.contact_person} {client?.contact_phone}</div>
        </Card>
        <Card>
          <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-2">التفاصيل</div>
          {asset && <div className="text-sm mb-1">الجهاز: <span className="font-medium">{asset.serial_number}</span></div>}
          {product && <div className="text-sm mb-1">المنتج: <span className="font-medium">{product.product_name}</span></div>}
          {task.checklist && <div className="text-sm mt-2 whitespace-pre-line">{task.checklist}</div>}
          <div className="text-sm mt-2 text-[var(--color-ink-soft)]">الحالة: {TASK_STATUS_LABELS[task.status]}</div>
        </Card>
      </div>

      {task.status === 'completed' ? (
        <Card><p className="text-sm text-[var(--color-ink-soft)]">هذه المهمة مكتملة بتاريخ {task.completed_at ? new Date(task.completed_at).toLocaleString('ar-SA') : ''}</p></Card>
      ) : (
        <Card className="max-w-lg">
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="text-sm font-medium">إنهاء المهمة</div>

            {task.task_type === 'installation' && (
              <>
                <div>
                  <Label>العميل المستلم للجهاز</Label>
                  <Select required value={receivingClientId} onChange={(e) => setReceivingClientId(e.target.value)}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.branch_name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>تاريخ الإرجاع المتوقع</Label>
                  <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
                </div>
              </>
            )}

            {['maintenance', 'inspection', 'retrieval'].includes(task.task_type) && (
              <div>
                <Label>النتيجة</Label>
                <Select value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
                  <option value="passed">نجحت / سليم</option>
                  <option value="failed">فشلت</option>
                  <option value="needs_parts">تحتاج قطع غيار</option>
                </Select>
              </div>
            )}

            {task.task_type !== 'installation' && (
              <div>
                <Label>التكلفة (إن وجدت)</Label>
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
            )}

            <div>
              <Label>ملاحظات الإنهاء</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>{submitting ? 'جاري الإنهاء...' : 'إنهاء المهمة'}</Button>
          </form>
        </Card>
      )}
    </div>
  )
}
