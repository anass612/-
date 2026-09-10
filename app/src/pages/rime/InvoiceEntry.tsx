import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Plus, X, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { AssetModel, Component, Consumable } from '../../lib/types'
import { Card, Field, Mono, PrimaryButton, SecondaryButton, Select, TextField } from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'

type LineType = 'component' | 'consumable' | 'asset_model'
interface Line { id: string; type: LineType; ref_id: string; quantity: number; unit_price: number; manufacturer_serial_number?: string; asset_type?: string }

export function InvoiceEntry() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [components, setComponents] = useState<Component[]>([])
  const [consumables, setConsumables] = useState<Consumable[]>([])
  const [models, setModels] = useState<AssetModel[]>([])

  const [supplierName, setSupplierName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [shippingCost, setShippingCost] = useState(0)
  const [lines, setLines] = useState<Line[]>([{ id: crypto.randomUUID(), type: 'component', ref_id: '', quantity: 1, unit_price: 0 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('components').select('*'),
      supabase.from('consumables').select('*'),
      supabase.from('asset_models').select('*'),
    ]).then(([c, n, m]) => {
      setComponents((c.data as Component[]) ?? [])
      setConsumables((n.data as Consumable[]) ?? [])
      setModels((m.data as AssetModel[]) ?? [])
    })
  }, [])

  function addLine() {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), type: 'component', ref_id: '', quantity: 1, unit_price: 0 }])
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }
  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const optionsFor = (type: LineType) => (type === 'component' ? components : type === 'consumable' ? consumables : models)

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  const grandTotal = subtotal + shippingCost

  async function handleSave() {
    if (!profile) return
    setError(null)
    if (!supplierName || lines.some((l) => !l.ref_id || l.quantity <= 0 || l.unit_price < 0)) {
      setError('Complete every line: item, quantity and unit price.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.rpc('fn_save_purchase_invoice', {
      p_supplier_name: supplierName,
      p_invoice_number: invoiceNumber || null,
      p_invoice_date: invoiceDate,
      p_shipping_cost: shippingCost,
      p_created_by: profile.id,
      p_line_items: lines.map((l) => ({
        type: l.type, ref_id: l.ref_id, quantity: l.type === 'asset_model' ? 1 : l.quantity, unit_price: l.unit_price,
        manufacturer_serial_number: l.manufacturer_serial_number, asset_type: l.asset_type,
      })),
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    navigate('/invoices')
  }

  return (
    <div>
      <TopBar title={t.invoices.title} subtitle={t.invoices.stockNote} />
      <div className="p-6 grid gap-4" style={{ background: 'var(--bg-base)', gridTemplateColumns: '1fr 1.45fr' }}>
        <Card>
          <div className="space-y-4">
            <Field label={t.invoices.supplier} required><TextField value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.invoices.invoiceNumber}><TextField value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
              <Field label={t.invoices.invoiceDate}><TextField type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
            </div>
            <Field label={t.invoices.shippingCost} helper={t.invoices.shippingNote}>
              <div className="flex items-center gap-2">
                <TextField type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>SAR</span>
              </div>
            </Field>
            <div className="flex items-center gap-2 p-3" style={{ border: '1px dashed var(--border-color-strong)', borderRadius: 'var(--rime-radius-md)' }}>
              <FileText size={16} color="var(--text-tertiary)" />
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.invoices.attachedFile}</span>
            </div>
          </div>
        </Card>

        <div>
          <Card>
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">{t.invoices.lineItems}</div>
              <SecondaryButton icon={<Plus size={14} />} onClick={addLine}>{t.invoices.addLine}</SecondaryButton>
            </div>
            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.id} className="grid gap-2 items-end" style={{ gridTemplateColumns: '1fr 1fr 0.7fr 0.9fr auto', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                  <Field label={t.invoices.col_category}>
                    <Select value={l.type} onChange={(e) => updateLine(l.id, { type: e.target.value as LineType, ref_id: '' })}>
                      <option value="component">{t.assembly.trackingBulk}</option>
                      <option value="consumable">{t.assembly.trackingConsumable}</option>
                      <option value="asset_model">{t.assembly.trackingIndividual}</option>
                    </Select>
                  </Field>
                  <Field label={t.invoices.col_item}>
                    <Select value={l.ref_id} onChange={(e) => updateLine(l.id, { ref_id: e.target.value })}>
                      <option value="">—</option>
                      {optionsFor(l.type).map((o: Component | Consumable | AssetModel) => (
                        <option key={o.id} value={o.id}>{'component_name' in o ? o.component_name : 'consumable_name' in o ? o.consumable_name : o.model_name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t.invoices.col_quantity}>
                    <TextField type="number" min={1} disabled={l.type === 'asset_model'} value={l.type === 'asset_model' ? 1 : l.quantity} onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })} />
                  </Field>
                  <Field label={t.invoices.col_unitPrice}>
                    <TextField type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(l.id, { unit_price: Number(e.target.value) })} />
                  </Field>
                  <button onClick={() => removeLine(l.id)} style={{ height: 44, color: 'var(--text-tertiary)' }}><X size={16} /></button>
                  {l.type === 'asset_model' && (
                    <div className="grid grid-cols-2 gap-2" style={{ gridColumn: '1 / -1' }}>
                      <TextField placeholder="Manufacturer serial" value={l.manufacturer_serial_number ?? ''} onChange={(e) => updateLine(l.id, { manufacturer_serial_number: e.target.value })} />
                      <TextField placeholder="Asset type" value={l.asset_type ?? ''} onChange={(e) => updateLine(l.id, { asset_type: e.target.value })} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 p-3" style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--rime-radius-md)' }}>
              <div className="flex justify-between" style={{ fontSize: 14 }}><span>{t.invoices.subtotalParts}</span><Mono>SAR {subtotal.toFixed(2)}</Mono></div>
              <div className="flex justify-between" style={{ fontSize: 14 }}><span>{t.invoices.subtotalShipping}</span><Mono>SAR {shippingCost.toFixed(2)}</Mono></div>
              <div className="flex justify-between font-semibold mt-1" style={{ fontSize: 15 }}><span>{t.invoices.grandTotal}</span><Mono>SAR {grandTotal.toFixed(2)}</Mono></div>
            </div>
          </Card>

          {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{error}</p>}
          <PrimaryButton icon={<Save size={16} />} onClick={handleSave} disabled={submitting} className="mt-4">{t.invoices.saveInvoice}</PrimaryButton>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>{t.invoices.serializedNote}</p>
        </div>
      </div>
    </div>
  )
}
