import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, TriangleAlert, Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import type { AssetModel, Component, Consumable } from '../../lib/types'
import { Mono, PrimaryButton, SecondaryButton, SegmentedControl, Spinner, StatusPill } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

type Seg = 'all' | 'components' | 'consumables' | 'ready'

interface Row {
  key: string
  name: string
  type: string
  available: number
  threshold: number
  leadTime: string
  supplier: string
}

export function Stock() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [seg, setSeg] = useState<Seg>('all')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: comps }, { data: cons }, { data: models }, { data: assets }] = await Promise.all([
        supabase.from('components').select('*'),
        supabase.from('consumables').select('*'),
        supabase.from('asset_models').select('*'),
        supabase.from('assets').select('asset_model_id, current_status, condition_grade').not('asset_model_id', 'is', null),
      ])
      const availableByModel: Record<string, number> = {}
      for (const a of (assets as { asset_model_id: string; current_status: string; condition_grade: string }[]) ?? []) {
        if (a.current_status === 'in_warehouse' && ['new', 'good'].includes(a.condition_grade)) {
          availableByModel[a.asset_model_id] = (availableByModel[a.asset_model_id] ?? 0) + 1
        }
      }
      const componentRows: Row[] = ((comps as Component[]) ?? []).map((c) => ({
        key: `c-${c.id}`, name: c.component_name, type: t.assembly.trackingBulk, available: c.quantity_on_hand, threshold: c.reorder_threshold,
        leadTime: '—', supplier: c.preferred_supplier ?? '—',
      }))
      const consumableRows: Row[] = ((cons as Consumable[]) ?? []).map((c) => ({
        key: `n-${c.id}`, name: c.consumable_name, type: t.assembly.trackingConsumable, available: c.quantity_on_hand, threshold: c.reorder_threshold, leadTime: '—', supplier: '—',
      }))
      const modelRows: Row[] = ((models as AssetModel[]) ?? []).map((m) => ({
        key: `m-${m.id}`, name: m.model_name, type: 'Ready asset', available: availableByModel[m.id] ?? 0, threshold: m.reorder_threshold,
        leadTime: m.lead_time_days ? `${m.lead_time_days} ${t.stock.days}` : '—', supplier: m.preferred_supplier ?? '—',
      }))
      setRows([...componentRows, ...consumableRows, ...modelRows])
      setLoading(false)
    }
    load()
  }, [t])

  const filtered = rows.filter((r) => seg === 'all' || (seg === 'components' && r.type === t.assembly.trackingBulk) || (seg === 'consumables' && r.type === t.assembly.trackingConsumable) || (seg === 'ready' && r.type === 'Ready asset'))
  const below = filtered.filter((r) => r.available <= r.threshold)

  if (loading) return <Spinner />

  return (
    <div>
      <TopBar
        title={t.stock.title}
        pills={
          <SegmentedControl
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'all', label: t.stock.segAll },
              { value: 'components', label: t.stock.segComponents },
              { value: 'consumables', label: t.stock.segConsumables },
              { value: 'ready', label: t.stock.segReady },
            ]}
          />
        }
        actions={
          <div className="flex gap-2">
            <SecondaryButton icon={<Settings2 size={15} />} onClick={() => navigate('/stock/catalog')}>{t.common.edit}</SecondaryButton>
            <PrimaryButton icon={<Receipt size={16} />} onClick={() => navigate('/invoices/new')}>{t.stock.createPO}</PrimaryButton>
          </div>
        }
      />

      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        {below.length > 0 && (
          <div className="flex items-start gap-2 mb-4" style={{ padding: '14px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--rime-radius-md)' }}>
            <TriangleAlert size={18} color="var(--warning-text)" className="flex-none mt-0.5" />
            <p style={{ fontSize: 14, color: 'var(--warning-text)', fontWeight: 600 }}>
              {below.length} items hit their threshold — {below.map((r) => r.name).join(', ')}
            </p>
          </div>
        )}

        <TableCard>
          <THead>
            <TH>{t.stock.col_item}</TH>
            <TH>{t.stock.col_type}</TH>
            <TH>{t.stock.col_available}</TH>
            <TH>{t.stock.col_threshold}</TH>
            <TH>{t.stock.col_leadTime}</TH>
            <TH>{t.stock.col_supplier}</TH>
            <TH>{t.stock.col_state}</TH>
          </THead>
          <tbody>
            {filtered.map((r) => {
              const state = r.available < r.threshold ? 'critical' : r.available === r.threshold ? 'warning' : 'success'
              const label = r.available < r.threshold ? t.stock.orderNow : r.available === r.threshold ? t.stock.atThreshold : t.stock.sufficient
              return (
                <TR key={r.key}>
                  <TD>{r.name}</TD>
                  <TD style={{ color: 'var(--text-secondary)' }}>{r.type}</TD>
                  <TD className="text-center"><Mono className="font-semibold">{r.available}</Mono></TD>
                  <TD className="text-center"><Mono>{r.threshold}</Mono></TD>
                  <TD>{r.leadTime}</TD>
                  <TD>{r.supplier}</TD>
                  <TD><StatusPill tone={state}>{label}</StatusPill></TD>
                </TR>
              )
            })}
          </tbody>
        </TableCard>
      </div>
    </div>
  )
}
