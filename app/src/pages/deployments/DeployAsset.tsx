import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Asset, Client } from '../../lib/types'
import { Button, Card, Input, Label, PageHeader, Select, Spinner } from '../../components/ui'

export function DeployAsset() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const presetAssetId = params.get('asset')

  const [assets, setAssets] = useState<Asset[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [assetId, setAssetId] = useState(presetAssetId ?? '')
  const [clientId, setClientId] = useState('')
  const [contractRef, setContractRef] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from('assets').select('*').eq('current_status', 'in_warehouse').order('serial_number'),
        supabase.from('clients').select('*').eq('status', 'active').order('client_name'),
      ])
      setAssets((a as Asset[]) ?? [])
      setClients((c as Client[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)
    setError(null)
    const { data, error } = await supabase.rpc('fn_deploy_asset', {
      p_asset_id: assetId,
      p_client_id: clientId,
      p_deployed_by: profile.id,
      p_contract_reference: contractRef || null,
      p_expected_return_date: expectedReturn || null,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    void data
    navigate(`/assets/${assetId}`)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="نشر جهاز عند عميل" />
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <Card className="space-y-4">
          <div>
            <Label>الجهاز</Label>
            <Select value={assetId} onChange={(e) => setAssetId(e.target.value)} required>
              <option value="">اختر جهاز من المستودع...</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.serial_number} — {a.asset_type}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>العميل / الفرع</Label>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">اختر عميل...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.client_name} — {c.branch_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>مرجع العقد (اختياري)</Label>
            <Input value={contractRef} onChange={(e) => setContractRef(e.target.value)} />
          </div>
          <div>
            <Label>تاريخ الإرجاع المتوقع</Label>
            <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>
        </Card>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting}>{submitting ? 'جاري النشر...' : 'تأكيد النشر'}</Button>
      </form>
    </div>
  )
}
