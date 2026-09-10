import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, Client, Consumable, Deployment } from '../../lib/types'
import { Card, Checkbox, CONDITION_TONE, Field, Mono, PrimaryButton, SecondaryButton, Select, Spinner, StatusPill, TextField } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

type Mode = 'deploy' | 'retrieve'

export function DeployRetrieve() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) ?? 'deploy')

  const [assets, setAssets] = useState<Asset[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [consumables, setConsumables] = useState<Consumable[]>([])
  const [openDeployments, setOpenDeployments] = useState<(Deployment & { asset: Asset; client: Client })[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set(params.get('asset') ? [params.get('asset')!] : []))
  const [selectedDeployments, setSelectedDeployments] = useState<Set<string>>(new Set(params.get('deployment') ? [params.get('deployment')!] : []))
  const [clientId, setClientId] = useState('')
  const [contractRef, setContractRef] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [consumableQty, setConsumableQty] = useState<Record<string, number>>({})
  const [returnCondition, setReturnCondition] = useState<'good' | 'needs_repair' | 'damaged' | 'missing'>('good')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: a }, { data: c }, { data: co }, { data: dep }] = await Promise.all([
        supabase.from('assets').select('*').eq('current_status', 'in_warehouse').in('condition_grade', ['new', 'good']).order('serial_number'),
        supabase.from('clients').select('*').eq('status', 'active').order('client_name'),
        supabase.from('consumables').select('*').order('consumable_name'),
        supabase.from('deployments').select('*, asset:assets(*), client:clients(*)').is('actual_return_date', null),
      ])
      setAssets((a as Asset[]) ?? [])
      setClients((c as Client[]) ?? [])
      setConsumables((co as Consumable[]) ?? [])
      setOpenDeployments((dep as (Deployment & { asset: Asset; client: Client })[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const allChecked = mode === 'deploy' ? assets.length > 0 && selectedAssets.size === assets.length : openDeployments.length > 0 && selectedDeployments.size === openDeployments.length
  const someChecked = mode === 'deploy' ? selectedAssets.size > 0 && !allChecked : selectedDeployments.size > 0 && !allChecked

  function toggleAll() {
    if (mode === 'deploy') {
      setSelectedAssets(allChecked ? new Set() : new Set(assets.map((a) => a.id)))
    } else {
      setSelectedDeployments(allChecked ? new Set() : new Set(openDeployments.map((d) => d.id)))
    }
  }

  function toggleOne(id: string) {
    if (mode === 'deploy') {
      setSelectedAssets((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    } else {
      setSelectedDeployments((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  const consumablesCost = useMemo(
    () => consumables.reduce((sum, c) => sum + (consumableQty[c.id] ?? 0) * c.unit_cost * selectedAssets.size, 0),
    [consumables, consumableQty, selectedAssets]
  )

  async function handleSubmit() {
    if (!profile) return
    setError(null)
    setSubmitting(true)
    if (mode === 'deploy') {
      const payload = consumables.filter((c) => (consumableQty[c.id] ?? 0) > 0).map((c) => ({ consumable_id: c.id, quantity_per_unit: consumableQty[c.id] }))
      const { error } = await supabase.rpc('fn_deploy_assets_bulk', {
        p_asset_ids: [...selectedAssets], p_client_id: clientId, p_deployed_by: profile.id,
        p_contract_reference: contractRef || null, p_expected_return_date: expectedReturn || null, p_consumables: payload,
      })
      setSubmitting(false)
      if (error) { setError(error.message); return }
      setSelectedAssets(new Set())
      const { data: a } = await supabase.from('assets').select('*').eq('current_status', 'in_warehouse').in('condition_grade', ['new', 'good']).order('serial_number')
      setAssets((a as Asset[]) ?? [])
    } else {
      const { error } = await supabase.rpc('fn_retrieve_assets_bulk', {
        p_deployment_ids: [...selectedDeployments], p_returned_by: profile.id, p_return_condition: returnCondition,
      })
      setSubmitting(false)
      if (error) { setError(error.message); return }
      setSelectedDeployments(new Set())
      const { data: dep } = await supabase.from('deployments').select('*, asset:assets(*), client:clients(*)').is('actual_return_date', null)
      setOpenDeployments((dep as (Deployment & { asset: Asset; client: Client })[]) ?? [])
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <TopBar
        title={t.deploy.title}
        pills={
          <div data-rime-control className="inline-flex" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--rime-radius-button)', padding: 3, gap: 2 }}>
            {(['deploy', 'retrieve'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="font-semibold"
                style={{ height: 34, padding: '0 16px', borderRadius: 'var(--rime-radius-button)', fontSize: 14, border: 'none', background: mode === m ? 'var(--surface-primary)' : 'transparent', boxShadow: mode === m ? 'var(--rime-shadow-sm)' : 'none' }}
              >
                {m === 'deploy' ? t.deploy.segDeploy : t.deploy.segRetrieve}
              </button>
            ))}
          </div>
        }
        subtitle={`${mode === 'deploy' ? selectedAssets.size : selectedDeployments.size} selected`}
        actions={profile?.role === 'admin' && (
          <SecondaryButton icon={<CalendarClock size={15} />} onClick={() => navigate('/deployments/backfill')}>
            {t.backfill.navLink}
          </SecondaryButton>
        )}
      />

      <div className="p-6 grid gap-4" style={{ background: 'var(--bg-base)', gridTemplateColumns: '1fr 1.25fr' }}>
        {mode === 'deploy' ? (
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="space-y-4">
              <Field label={t.deploy.clientBranch} required>
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name} — {c.branch_name}</option>)}
                </Select>
              </Field>
              <Field label={t.deploy.contractReference}>
                <TextField value={contractRef} onChange={(e) => setContractRef(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.deploy.deployedOn}><TextField type="date" disabled value={new Date().toISOString().slice(0, 10)} /></Field>
                <Field label={t.deploy.expectedReturn}><TextField type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} /></Field>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)' }} />
              <div>
                <div className="font-semibold mb-2" style={{ fontSize: 14 }}>{t.deploy.consumables}</div>
                <div className="space-y-2">
                  {consumables.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2" style={{ fontSize: 13 }}>
                      <span>{c.consumable_name}</span>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} value={consumableQty[c.id] ?? 0} onChange={(e) => setConsumableQty((p) => ({ ...p, [c.id]: Number(e.target.value) }))} style={{ width: 56, height: 30, textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                        <Mono style={{ color: 'var(--text-tertiary)', width: 70, textAlign: 'end' }}>SAR {((consumableQty[c.id] ?? 0) * c.unit_cost * selectedAssets.size).toFixed(0)}</Mono>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{t.deploy.consumablesNote}</p>
              </div>
            </div>
            {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <PrimaryButton onClick={handleSubmit} disabled={submitting || !clientId || selectedAssets.size === 0} className="w-full justify-center" style={{ marginTop: 16 }}>
              {t.deploy.deployAction(selectedAssets.size)} {consumablesCost > 0 && <Mono>· SAR {consumablesCost.toFixed(0)}</Mono>}
            </PrimaryButton>
          </Card>
        ) : (
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <Field label={t.deploy.returnCondition}>
              <Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value as typeof returnCondition)}>
                <option value="good">{t.status.good}</option>
                <option value="needs_repair">{t.status.needs_repair}</option>
                <option value="damaged">{t.status.damaged}</option>
                <option value="missing">{t.status.lost_damaged}</option>
              </Select>
            </Field>
            {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <PrimaryButton onClick={handleSubmit} disabled={submitting || selectedDeployments.size === 0} className="w-full justify-center" style={{ marginTop: 16 }}>
              {t.deploy.retrieveAction(selectedDeployments.size)}
            </PrimaryButton>
          </Card>
        )}

        <TableCard>
          <THead>
            <TH><Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} /></TH>
            <TH>{t.deploy.col_serial}</TH>
            <TH>{t.deploy.col_type}</TH>
            <TH>{t.deploy.col_condition}</TH>
            <TH>{mode === 'deploy' ? t.deploy.col_lastInspection : t.deviceHistory.col_client}</TH>
          </THead>
          <tbody>
            {mode === 'deploy'
              ? assets.map((a) => (
                  <TR key={a.id} onClick={() => toggleOne(a.id)}>
                    <TD><Checkbox checked={selectedAssets.has(a.id)} onChange={() => toggleOne(a.id)} /></TD>
                    <TD><Mono className="font-medium">{a.serial_number}</Mono></TD>
                    <TD>{a.asset_type}</TD>
                    <TD><StatusPill tone={CONDITION_TONE[a.condition_grade]}>{t.status[a.condition_grade]}</StatusPill></TD>
                    <TD><Mono style={{ color: 'var(--text-tertiary)' }}>{a.updated_at.slice(0, 10)}</Mono></TD>
                  </TR>
                ))
              : openDeployments.map((d) => (
                  <TR key={d.id} onClick={() => toggleOne(d.id)}>
                    <TD><Checkbox checked={selectedDeployments.has(d.id)} onChange={() => toggleOne(d.id)} /></TD>
                    <TD><Mono className="font-medium">{d.asset.serial_number}</Mono></TD>
                    <TD>{d.asset.asset_type}</TD>
                    <TD><StatusPill tone={CONDITION_TONE[d.asset.condition_grade]}>{t.status[d.asset.condition_grade]}</StatusPill></TD>
                    <TD>{d.client.client_name} — {d.client.branch_name}</TD>
                  </TR>
                ))}
          </tbody>
        </TableCard>
      </div>
    </div>
  )
}
