import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Asset, AssetModel, Component, ProductDefinition } from '../../lib/types'
import { Button, Card, Input, Label, PageHeader, Select, Spinner } from '../../components/ui'

interface BomLine {
  component_id: string
  quantity_required: number
  component: Component
}

interface RequiredAssetModelLine {
  asset_model_id: string
  role_label: string | null
  asset_model: AssetModel
}

export function AssembleDevice() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [productId, setProductId] = useState('')
  const [bomLines, setBomLines] = useState<BomLine[]>([])
  const [requiredModels, setRequiredModels] = useState<RequiredAssetModelLine[]>([])
  const [availableByModel, setAvailableByModel] = useState<Record<string, Asset[]>>({})
  const [selectedManufacturerAssets, setSelectedManufacturerAssets] = useState<Record<string, string>>({})
  const [serialNumber, setSerialNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('product_definitions')
      .select('*')
      .eq('product_type', 'main_device')
      .then(({ data }) => {
        setProducts((data as ProductDefinition[]) ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!productId) {
      setBomLines([])
      setRequiredModels([])
      return
    }
    async function loadProduct() {
      const [{ data: bom }, { data: req }] = await Promise.all([
        supabase.from('product_bom_items').select('component_id, quantity_required, components(*)').eq('product_id', productId),
        supabase.from('product_required_asset_models').select('asset_model_id, role_label, asset_models(*)').eq('product_id', productId),
      ])
      const bomParsed: BomLine[] = ((bom as Record<string, unknown>[] | null) ?? []).map((r) => ({
        component_id: r.component_id as string,
        quantity_required: r.quantity_required as number,
        component: r.components as unknown as Component,
      }))
      const reqParsed: RequiredAssetModelLine[] = ((req as Record<string, unknown>[] | null) ?? []).map((r) => ({
        asset_model_id: r.asset_model_id as string,
        role_label: r.role_label as string | null,
        asset_model: r.asset_models as unknown as AssetModel,
      }))
      setBomLines(bomParsed)
      setRequiredModels(reqParsed)

      const modelIds = reqParsed.map((r) => r.asset_model_id)
      if (modelIds.length) {
        const { data: avail } = await supabase
          .from('assets')
          .select('*')
          .in('asset_model_id', modelIds)
          .eq('current_status', 'in_warehouse')
          .is('parent_asset_id', null)
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
      if (!selectedManufacturerAssets[req.asset_model_id]) {
        setError(`اختر جهاز ${req.role_label ?? req.asset_model.model_name} قبل المتابعة`)
        return
      }
    }
    for (const line of bomLines) {
      if (line.component.quantity_on_hand < line.quantity_required) {
        setError(`الكمية غير كافية من "${line.component.component_name}" (متوفر ${line.component.quantity_on_hand}، مطلوب ${line.quantity_required})`)
        return
      }
    }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('fn_assemble_device', {
      p_product_id: productId,
      p_assembled_by: profile.id,
      p_new_serial_number: serialNumber,
      p_manufacturer_asset_ids: Object.values(selectedManufacturerAssets),
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/assets/${data as string}`)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="تجميع جهاز جديد" />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <Card>
          <Label>المنتج (BOM)</Label>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">اختر منتج...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.product_name}</option>
            ))}
          </Select>
          {products.length === 0 && (
            <p className="text-xs text-[var(--color-ink-soft)] mt-2">
              لا يوجد منتجات معرّفة بعد — أضِف واحد من شاشة "المخزون → المنتجات (BOM)".
            </p>
          )}
        </Card>

        {requiredModels.length > 0 && (
          <Card>
            <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">القطع المُسريلة المطلوبة</div>
            <div className="space-y-3">
              {requiredModels.map((req) => (
                <div key={req.asset_model_id}>
                  <Label>{req.role_label ?? req.asset_model.model_name}</Label>
                  <Select
                    value={selectedManufacturerAssets[req.asset_model_id] ?? ''}
                    onChange={(e) =>
                      setSelectedManufacturerAssets((prev) => ({ ...prev, [req.asset_model_id]: e.target.value }))
                    }
                    required
                  >
                    <option value="">اختر جهاز بالسريال...</option>
                    {(availableByModel[req.asset_model_id] ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.serial_number} {a.manufacturer_serial_number ? `(${a.manufacturer_serial_number})` : ''}
                      </option>
                    ))}
                  </Select>
                  {(availableByModel[req.asset_model_id] ?? []).length === 0 && (
                    <p className="text-xs text-red-600 mt-1">لا يوجد مخزون متاح من هذا الموديل — سجّله أولاً كـ Asset مستقل</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {bomLines.length > 0 && (
          <Card>
            <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">القطع bulk المطلوبة (BOM)</div>
            <ul className="text-sm space-y-1.5">
              {bomLines.map((l) => (
                <li key={l.component_id} className="flex justify-between">
                  <span>{l.component.component_name}</span>
                  <span className={l.component.quantity_on_hand < l.quantity_required ? 'text-red-600 font-medium' : 'text-[var(--color-ink-soft)]'}>
                    مطلوب {l.quantity_required} / متوفر {l.component.quantity_on_hand}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <Label>السريال الداخلي الجديد</Label>
          <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required placeholder="RES-00123" />
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={submitting || !productId}>
          {submitting ? 'جاري التجميع...' : 'تجميع الجهاز'}
        </Button>
      </form>
    </div>
  )
}
