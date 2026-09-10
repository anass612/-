import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Asset, Client, Deployment } from '../../lib/types'
import { Button, Card, Label, PageHeader, Select, Spinner, Input } from '../../components/ui'

interface OpenDeployment extends Deployment {
  asset: Asset
  client: Client
}

export function RetrieveAsset() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const presetDeploymentId = params.get('deployment')

  const [openDeployments, setOpenDeployments] = useState<OpenDeployment[]>([])
  const [deploymentId, setDeploymentId] = useState(presetDeploymentId ?? '')
  const [condition, setCondition] = useState<'good' | 'needs_repair' | 'damaged' | 'missing'>('good')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('deployments')
      .select('*, asset:assets(*), client:clients(*)')
      .is('actual_return_date', null)
      .then(({ data }) => {
        setOpenDeployments((data as OpenDeployment[]) ?? [])
        setLoading(false)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('fn_retrieve_asset', {
      p_deployment_id: deploymentId,
      p_returned_by: profile.id,
      p_return_condition: condition,
      p_notes: notes || null,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const dep = openDeployments.find((d) => d.id === deploymentId)
    navigate(dep ? `/assets/${dep.asset.id}` : '/assets')
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="استرجاع جهاز من عميل" />
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <Card className="space-y-4">
          <div>
            <Label>النشرة النشطة</Label>
            <Select value={deploymentId} onChange={(e) => setDeploymentId(e.target.value)} required>
              <option value="">اختر...</option>
              {openDeployments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset.serial_number} — {d.client.client_name} / {d.client.branch_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>حالة الإرجاع</Label>
            <Select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
              <option value="good">سليم</option>
              <option value="needs_repair">يحتاج إصلاح</option>
              <option value="damaged">تالف</option>
              <option value="missing">مفقود</option>
            </Select>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </Card>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting}>{submitting ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع'}</Button>
      </form>
    </div>
  )
}
