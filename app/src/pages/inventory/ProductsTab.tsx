import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AssetModel, Component, ProductDefinition, ProductType } from '../../lib/types'
import { Button, Card, EmptyState, Input, Label, Select, Spinner } from '../../components/ui'

export function ProductsTab() {
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [selected, setSelected] = useState<ProductDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_name: '', product_type: 'main_device' as ProductType, default_battery_life_days: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('product_definitions').select('*').order('product_name')
    setProducts((data as ProductDefinition[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('product_definitions').insert({
      product_name: form.product_name,
      product_type: form.product_type,
      default_battery_life_days: form.default_battery_life_days ? Number(form.default_battery_life_days) : null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (!error) {
      setForm({ product_name: '', product_type: 'main_device', default_battery_life_days: '', notes: '' })
      setShowForm(false)
      load()
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="mb-4"><Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'إلغاء' : 'إضافة منتج'}</Button></div>
      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="grid md:grid-cols-3 gap-3">
            <div><Label>اسم المنتج</Label><Input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
            <div>
              <Label>النوع</Label>
              <Select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value as ProductType })}>
                <option value="main_device">جهاز رئيسي</option>
                <option value="sensor_install">تركيب حساس</option>
              </Select>
            </div>
            <div><Label>عمر البطارية الافتراضي (يوم)</Label><Input type="number" value={form.default_battery_life_days} onChange={(e) => setForm({ ...form, default_battery_life_days: e.target.value })} /></div>
            <div className="md:col-span-3"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button></div>
          </form>
        </Card>
      )}

      {products.length === 0 ? <EmptyState message="لا توجد منتجات معرّفة بعد" /> : (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-right p-3 rounded-lg border ${selected?.id === p.id ? 'border-[var(--color-first-light)] bg-orange-50' : 'border-[var(--color-hairline)]'}`}
              >
                <div className="text-sm font-medium">{p.product_name}</div>
                <div className="text-xs text-[var(--color-ink-soft)]">{p.product_type === 'main_device' ? 'جهاز رئيسي' : 'تركيب حساس'}</div>
              </button>
            ))}
          </div>
          <div className="md:col-span-2">
            {selected ? <ProductBomManager product={selected} /> : <EmptyState message="اختر منتج لإدارة قائمة مكوناته (BOM)" />}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductBomManager({ product }: { product: ProductDefinition }) {
  const [components, setComponents] = useState<Component[]>([])
  const [assetModels, setAssetModels] = useState<AssetModel[]>([])
  const [bomItems, setBomItems] = useState<{ id: string; component_id: string; quantity_required: number; components: Component }[]>([])
  const [requiredModels, setRequiredModels] = useState<{ id: string; asset_model_id: string; role_label: string | null; asset_models: AssetModel }[]>([])
  const [newComponentId, setNewComponentId] = useState('')
  const [newQty, setNewQty] = useState(1)
  const [newModelId, setNewModelId] = useState('')
  const [newRoleLabel, setNewRoleLabel] = useState('')

  async function load() {
    const [{ data: comps }, { data: models }, { data: bom }, { data: req }] = await Promise.all([
      supabase.from('components').select('*').order('component_name'),
      supabase.from('asset_models').select('*').order('model_name'),
      supabase.from('product_bom_items').select('id, component_id, quantity_required, components(*)').eq('product_id', product.id),
      supabase.from('product_required_asset_models').select('id, asset_model_id, role_label, asset_models(*)').eq('product_id', product.id),
    ])
    setComponents((comps as Component[]) ?? [])
    setAssetModels((models as AssetModel[]) ?? [])
    setBomItems((bom as unknown as typeof bomItems) ?? [])
    setRequiredModels((req as unknown as typeof requiredModels) ?? [])
  }

  useEffect(() => { load() }, [product.id])

  async function addBomItem() {
    if (!newComponentId) return
    await supabase.from('product_bom_items').insert({ product_id: product.id, component_id: newComponentId, quantity_required: newQty })
    setNewComponentId('')
    setNewQty(1)
    load()
  }

  async function removeBomItem(id: string) {
    await supabase.from('product_bom_items').delete().eq('id', id)
    load()
  }

  async function addRequiredModel() {
    if (!newModelId) return
    await supabase.from('product_required_asset_models').insert({ product_id: product.id, asset_model_id: newModelId, role_label: newRoleLabel || null })
    setNewModelId('')
    setNewRoleLabel('')
    load()
  }

  async function removeRequiredModel(id: string) {
    await supabase.from('product_required_asset_models').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">القطع المُسريلة الإلزامية (O-NA / SSD...)</div>
        <ul className="space-y-2 mb-3">
          {requiredModels.map((r) => (
            <li key={r.id} className="flex justify-between items-center text-sm">
              <span>{r.role_label ?? r.asset_models.model_name} — {r.asset_models.model_name}</span>
              <button onClick={() => removeRequiredModel(r.id)} className="text-xs text-red-600">حذف</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Select value={newModelId} onChange={(e) => setNewModelId(e.target.value)}>
            <option value="">اختر موديل...</option>
            {assetModels.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
          </Select>
          <Input placeholder="مسمى الدور (O-NA)" value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} />
          <Button type="button" onClick={addRequiredModel}>إضافة</Button>
        </div>
      </Card>

      <Card>
        <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">القطع bulk (BOM)</div>
        <ul className="space-y-2 mb-3">
          {bomItems.map((b) => (
            <li key={b.id} className="flex justify-between items-center text-sm">
              <span>{b.components.component_name} × {b.quantity_required}</span>
              <button onClick={() => removeBomItem(b.id)} className="text-xs text-red-600">حذف</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Select value={newComponentId} onChange={(e) => setNewComponentId(e.target.value)}>
            <option value="">اختر قطعة...</option>
            {components.map((c) => <option key={c.id} value={c.id}>{c.component_name}</option>)}
          </Select>
          <Input type="number" min={1} value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="w-20" />
          <Button type="button" onClick={addBomItem}>إضافة</Button>
        </div>
      </Card>
    </div>
  )
}
