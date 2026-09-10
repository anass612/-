import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Asset, Client, Deployment } from '../../lib/types'
import { Card, EmptyState, PageHeader, Spinner, StatusBadge, Table } from '../../components/ui'

interface BranchHistoryRow {
  total_visits: number
  installations: number
  maintenances: number
  battery_replacements: number
  last_visit: string | null
}

export function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [history, setHistory] = useState<BranchHistoryRow | null>(null)
  const [deployments, setDeployments] = useState<(Deployment & { asset: Asset | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)
      const [{ data: c }, { data: h }, { data: dep }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('v_branch_history').select('*').eq('branch_id', id).maybeSingle(),
        supabase.from('deployments').select('*, asset:assets(*)').eq('client_id', id).order('deployed_at', { ascending: false }),
      ])
      setClient(c as Client)
      setHistory(h as BranchHistoryRow | null)
      setDeployments((dep as (Deployment & { asset: Asset | null })[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <Spinner />
  if (!client) return <EmptyState message="الفرع غير موجود" />

  return (
    <div>
      <PageHeader title={`${client.client_name} — ${client.branch_name}`} />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Card><div className="text-2xl font-semibold">{history?.total_visits ?? 0}</div><div className="text-xs text-[var(--color-ink-soft)] mt-1">إجمالي الزيارات</div></Card>
        <Card><div className="text-2xl font-semibold">{history?.installations ?? 0}</div><div className="text-xs text-[var(--color-ink-soft)] mt-1">تركيبات</div></Card>
        <Card><div className="text-2xl font-semibold">{history?.maintenances ?? 0}</div><div className="text-xs text-[var(--color-ink-soft)] mt-1">صيانات</div></Card>
        <Card><div className="text-2xl font-semibold">{history?.battery_replacements ?? 0}</div><div className="text-xs text-[var(--color-ink-soft)] mt-1">استبدال بطاريات</div></Card>
      </div>

      <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">الأجهزة (حالياً وتاريخياً)</h2>
      {deployments.length === 0 ? <EmptyState message="لا توجد أجهزة مرتبطة بهذا الفرع" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">السريال</th>
                <th className="px-4 py-3">حالة الجهاز الآن</th>
                <th className="px-4 py-3">نُشر بتاريخ</th>
                <th className="px-4 py-3">أُرجع بتاريخ</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">
                    {d.asset ? (
                      <Link to={`/assets/${d.asset.id}`} className="font-medium text-[var(--color-horizon)] hover:underline">{d.asset.serial_number}</Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{d.asset && <StatusBadge status={d.asset.current_status} />}</td>
                  <td className="px-4 py-3">{new Date(d.deployed_at).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">{d.actual_return_date ? new Date(d.actual_return_date).toLocaleDateString('ar-SA') : 'حالياً منشور'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
