import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Asset, Component } from '../../lib/types'
import { ASSET_STATUS_LABELS, type AssetStatus } from '../../lib/types'
import { Button, Card, Input, Label, PageHeader, Select, Spinner } from '../../components/ui'

interface ConsumedLine {
  component_id: string
  component: Component
  original_quantity: number
  return_quantity: number
  condition: 'good' | 'damaged'
}

const ELIGIBLE_STATUSES: AssetStatus[] = ['in_maintenance', 'in_warehouse']

export function DisassembleDevice() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<Asset[]>([])
  const [selected, setSelected] = useState<Asset | null>(null)
  const [lines, setLines] = useState<ConsumedLine[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!search.trim()) {
      setCandidates([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('assets')
        .select('*')
        .ilike('serial_number', `%${search}%`)
        .in('current_status', ELIGIBLE_STATUSES)
        .limit(10)
      setCandidates((data as Asset[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  async function selectAsset(asset: Asset) {
    setSelected(asset)
    setLoading(true)
    const { data: events } = await supabase
      .from('assembly_events')
      .select('id')
      .eq('resulting_asset_id', asset.id)
      .order('assembled_at', { ascending: false })
      .limit(1)
    const eventId = (events as { id: string }[] | null)?.[0]?.id
    if (!eventId) {
      setLines([])
      setLoading(false)
      return
    }
    const { data: comps } = await supabase
      .from('assembly_event_components')
      .select('component_id, quantity, components(*)')
      .eq('assembly_event_id', eventId)
    const parsed: ConsumedLine[] = ((comps as Record<string, unknown>[] | null) ?? []).map((c) => ({
      component_id: c.component_id as string,
      component: c.components as unknown as Component,
      original_quantity: c.quantity as number,
      return_quantity: c.quantity as number,
      condition: 'good',
    }))
    setLines(parsed)
    setLoading(false)
  }

  function updateLine(componentId: string, patch: Partial<ConsumedLine>) {
    setLines((prev) => prev.map((l) => (l.component_id === componentId ? { ...l, ...patch } : l)))
  }

  async function handleSubmit() {
    if (!selected || !profile) return
    setError(null)
    setSubmitting(true)
    const payload = lines.map((l) => ({
      component_id: l.component_id,
      quantity: l.return_quantity,
      condition: l.condition,
    }))
    const { error } = await supabase.rpc('fn_disassemble_device', {
      p_asset_id: selected.id,
      p_disassembled_by: profile.id,
      p_returned_components: payload,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/assets/${selected.id}`)
  }

  return (
    <div>
      <PageHeader title="تفكيك جهاز" />

      {!selected ? (
        <Card className="max-w-lg">
          <Label>ابحث عن الجهاز بالسريال</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="RES-00123" />
          <ul className="mt-3 space-y-1">
            {candidates.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => selectAsset(a)}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-[var(--color-clarity)] text-sm"
                >
                  <span className="font-medium">{a.serial_number}</span>
                  <span className="text-[var(--color-ink-soft)]"> — {ASSET_STATUS_LABELS[a.current_status]}</span>
                </button>
              </li>
            ))}
          </ul>
          {search && candidates.length === 0 && (
            <p className="text-xs text-[var(--color-ink-soft)] mt-2">
              لا توجد نتائج (فقط أجهزة بالصيانة أو بالمستودع تظهر هنا)
            </p>
          )}
        </Card>
      ) : loading ? (
        <Spinner />
      ) : (
        <div className="max-w-2xl space-y-5">
          <Card>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{selected.serial_number}</div>
                <div className="text-xs text-[var(--color-ink-soft)]">{ASSET_STATUS_LABELS[selected.current_status]}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-[var(--color-horizon)] hover:underline">
                تغيير الجهاز
              </button>
            </div>
          </Card>

          {lines.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-ink-soft)]">
                لا يوجد سجل تجميع مرتبط بهذا الجهاز (ربما استُورد مباشرة). سيتم تحديث حالته إلى "مُفكّك" فقط.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">القطع المستهلكة عند التجميع</div>
              <div className="space-y-3">
                {lines.map((l) => (
                  <div key={l.component_id} className="grid grid-cols-3 gap-3 items-end border-b border-[var(--color-hairline)] pb-3 last:border-0">
                    <div className="col-span-1">
                      <div className="text-sm font-medium">{l.component.component_name}</div>
                      <div className="text-xs text-[var(--color-ink-soft)]">أصلي: {l.original_quantity}</div>
                    </div>
                    <div>
                      <Label>الكمية المرجعة</Label>
                      <Input
                        type="number"
                        min={0}
                        max={l.original_quantity}
                        value={l.return_quantity}
                        onChange={(e) => updateLine(l.component_id, { return_quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>الحالة</Label>
                      <Select
                        value={l.condition}
                        onChange={(e) => updateLine(l.component_id, { condition: e.target.value as 'good' | 'damaged' })}
                      >
                        <option value="good">سليمة (ترجع للمخزون)</option>
                        <option value="damaged">تالفة (خسارة)</option>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'جاري التفكيك...' : 'تأكيد التفكيك'}
          </Button>
        </div>
      )}
    </div>
  )
}
