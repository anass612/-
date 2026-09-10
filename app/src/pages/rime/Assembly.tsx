import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanBarcode, Check, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, AssetModel, Component, ProductDefinition } from '../../lib/types'
import {
  Card, EmptyState, Field, Mono, PrimaryButton, Select, StatusPill, Spinner, TextField,
} from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'

interface BomLine { component_id: string; quantity_required: number; component: Component }
interface RequiredModelLine { asset_model_id: string; role_label: string | null; asset_model: AssetModel }

export function Assembly() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [productId, setProductId] = useState('')
  const [bomLines, setBomLines] = useState<BomLine[]>([])
  const [requiredModels, setRequiredModels] = useState<RequiredModelLine[]>([])
  const [availableByModel, setAvailableByModel] = useState<Record<string, Asset[]>>({})
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [serialNumber, setSerialNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('product_definitions').select('*').eq('product_type', 'main_device').then(({ data }) => {
      setProducts((data as ProductDefinition[]) ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!productId) { setBomLines([]); setRequiredModels([]); return }
    async function loadProduct() {
      const [{ data: bom }, { data: req }] = await Promise.all([
        supabase.from('product_bom_items').select('component_id, quantity_required, components(*)').eq('product_id', productId),
        supabase.from('product_required_asset_models').select('asset_model_id, role_label, asset_models(*)').eq('product_id', productId),
      ])
      const bomParsed: BomLine[] = ((bom as Record<string, unknown>[] | null) ?? []).map((r) => ({
        component_id: r.component_id as string, quantity_required: r.quantity_required as number, component: r.components as unknown as Component,
      }))
      const reqParsed: RequiredModelLine[] = ((req as Record<string, unknown>[] | null) ?? []).map((r) => ({
        asset_model_id: r.asset_model_id as string, role_label: r.role_label as string | null, asset_model: r.asset_models as unknown as AssetModel,
      }))
      setBomLines(bomParsed)
      setRequiredModels(reqParsed)
      const modelIds = reqParsed.map((r) => r.asset_model_id)
      if (modelIds.length) {
        const { data: avail } = await supabase.from('assets').select('*').in('asset_model_id', modelIds).eq('current_status', 'in_warehouse').is('parent_asset_id', null)
        const grouped: Record<string, Asset[]> = {}
        for (const a of (avail as Asset[]) ?? []) {
          if (!a.asset_model_id) continue
          grouped[a.asset_model_id] = grouped[a.asset_model_id] ?? []
          grouped[a.asset_model_id].push(a)
        }
        setAvailableByModel(grouped)
      }
    }
    loadProduct()
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    for (const req of requiredModels) {
      if (!selected[req.asset_model_id]) { setError(`${req.role_label ?? req.asset_model.model_name}: required`); return }
    }
    for (const line of bomLines) {
      if (line.component.quantity_on_hand < line.quantity_required) { setError(`${line.component.component_name}: insufficient stock`); return }
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('fn_assemble_device', {
      p_product_id: productId, p_assembled_by: profile.id, p_new_serial_number: serialNumber,
      p_manufacturer_asset_ids: Object.values(selected),
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    navigate(`/assets/${data as string}`)
  }

  const belowThreshold = bomLines.filter((l) => l.component.quantity_on_hand - l.quantity_required <= l.component.reorder_threshold)

  if (loading) return <Spinner />

  return (
    <div>
      <TopBar
        title={t.assembly.title}
        pills={<StatusPill tone="neutral">{t.assembly.draft}</StatusPill>}
        actions={<button onClick={() => navigate('/assembly/teardown')} style={{ fontSize: 13, color: 'var(--color-link)' }}>{t.teardown.title} →</button>}
      />
      <form onSubmit={handleSubmit} className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div style={{ marginBottom: 16, maxWidth: 420 }}>
          <Field label={t.assembly.bomTable}>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">—</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1.35fr 1fr', alignItems: 'start' }}>
          <Card>
            {bomLines.length === 0 ? <EmptyState message={t.common.noData} /> : (
              <table className="w-full" style={{ fontSize: 14 }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    <th className="text-start py-2">{t.assembly.col_component}</th>
                    <th className="text-start py-2">{t.assembly.col_tracking}</th>
                    <th className="text-start py-2">{t.assembly.col_required}</th>
                    <th className="text-start py-2">{t.assembly.col_available}</th>
                  </tr>
                </thead>
                <tbody>
                  {bomLines.map((l) => {
                    const short = l.component.quantity_on_hand < l.quantity_required
                    return (
                      <tr key={l.component_id} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td className="py-2.5">{l.component.component_name}</td>
                        <td className="py-2.5"><StatusPill tone="neutral">{t.assembly.trackingBulk}</StatusPill></td>
                        <td className="py-2.5"><Mono>{l.quantity_required}</Mono></td>
                        <td className="py-2.5"><StatusPill tone={short ? 'critical' : 'success'}><Mono>{l.component.quantity_on_hand}</Mono></StatusPill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {belowThreshold.length > 0 && (
              <div className="flex items-start gap-2 mt-3 p-3" style={{ background: 'var(--warning-bg)', borderTop: '1px solid var(--warning-border)' }}>
                <TriangleAlert size={18} color="var(--warning-text)" className="flex-none mt-0.5" />
                <p style={{ fontSize: 13, color: 'var(--warning-text)' }}>
                  {belowThreshold.map((l) => l.component.component_name).join(', ')}
                </p>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            {requiredModels.length > 0 && (
              <Card>
                <div className="font-semibold mb-3">{t.assembly.serializedParts}</div>
                <div className="space-y-3">
                  {requiredModels.map((req) => (
                    <Field key={req.asset_model_id} label={req.role_label ?? req.asset_model.model_name}>
                      <div className="flex items-center gap-2">
                        <ScanBarcode size={16} color="var(--text-tertiary)" className="flex-none" />
                        <Select value={selected[req.asset_model_id] ?? ''} onChange={(e) => setSelected((p) => ({ ...p, [req.asset_model_id]: e.target.value }))} required>
                          <option value="">{t.assembly.scanSerial}</option>
                          {(availableByModel[req.asset_model_id] ?? []).map((a) => <option key={a.id} value={a.id}>{a.serial_number}</option>)}
                        </Select>
                        {selected[req.asset_model_id] && (
                          <span className="flex items-center gap-1 flex-none" style={{ color: 'var(--success-text)', fontSize: 13 }}>
                            <Check size={14} /> {t.assembly.matched}
                          </span>
                        )}
                      </div>
                    </Field>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '14px 0' }} />
                <Field label={t.assembly.newSerial} helper={t.assembly.generatedAuto}>
                  <TextField value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required placeholder="RES-2026-0000" />
                </Field>
              </Card>
            )}

            <Card>
              <div className="space-y-2" style={{ fontSize: 14 }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>{t.assembly.costBulk}</span><Mono>SAR {bomLines.reduce((s, l) => s + l.quantity_required * l.component.unit_cost, 0).toFixed(2)}</Mono></div>
                <div style={{ borderTop: '1px solid var(--border-color)' }} />
                <div className="flex justify-between font-semibold"><span>{t.assembly.costTotal}</span><Mono>SAR {bomLines.reduce((s, l) => s + l.quantity_required * l.component.unit_cost, 0).toFixed(2)}</Mono></div>
              </div>
              {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 10 }}>{error}</p>}
              <PrimaryButton type="submit" icon={<Check size={16} />} disabled={submitting || !productId} className="w-full justify-center mt-4">
                {submitting ? t.common.loading : t.assembly.confirmAssembly}
              </PrimaryButton>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{t.assembly.atomicNote}</p>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
