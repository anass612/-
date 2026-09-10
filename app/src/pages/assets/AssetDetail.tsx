import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Asset, Client, Deployment, MaintenanceLog } from '../../lib/types'
import { Button, Card, EmptyState, PageHeader, Spinner, StatusBadge, Table } from '../../components/ui'

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

export function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: a }, { data: dep }, { data: maint }] = await Promise.all([
      supabase.from('assets').select('*').eq('id', id).single(),
      supabase.from('deployments').select('*').eq('asset_id', id).order('deployed_at', { ascending: false }),
      supabase.from('maintenance_logs').select('*').eq('asset_id', id).order('performed_at', { ascending: false }),
    ])
    setAsset(a as Asset)
    setDeployments((dep as Deployment[]) ?? [])
    setMaintenance((maint as MaintenanceLog[]) ?? [])

    const clientIds = [...new Set((dep as Deployment[] | null)?.map((d) => d.client_id))] as string[]
    if (clientIds.length) {
      const { data: cl } = await supabase.from('clients').select('*').in('id', clientIds)
      const map: Record<string, Client> = {}
      for (const c of (cl as Client[]) ?? []) map[c.id] = c
      setClients(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <Spinner />
  if (!asset) return <EmptyState message="الجهاز غير موجود" />

  const totalDeployments = deployments.length
  const totalDays = deployments.reduce(
    (sum, d) => sum + daysBetween(d.deployed_at, d.actual_return_date ?? new Date().toISOString()),
    0
  )
  const avgDuration = totalDeployments ? Math.round(totalDays / totalDeployments) : 0
  const lastClient = deployments[0] ? clients[deployments[0].client_id] : null
  const activeDeployment = deployments.find((d) => !d.actual_return_date)

  return (
    <div>
      <PageHeader
        title={`الجهاز: ${asset.serial_number}`}
        action={
          <div className="flex gap-2">
            {asset.current_status === 'in_warehouse' && (
              <Button onClick={() => navigate(`/deployments/deploy?asset=${asset.id}`)}>نشر الجهاز</Button>
            )}
            {asset.current_status === 'deployed' && activeDeployment && (
              <Button onClick={() => navigate(`/deployments/retrieve?deployment=${activeDeployment.id}`)}>
                استرجاع الجهاز
              </Button>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">تفاصيل الجهاز</div>
          <dl className="text-sm space-y-2">
            <Row label="الحالة"><StatusBadge status={asset.current_status} /></Row>
            <Row label="النوع">{asset.asset_type}</Row>
            <Row label="الموديل">{asset.model ?? '—'}</Row>
            <Row label="الحالة الفنية">{asset.condition_grade}</Row>
            <Row label="السريال (الشركة الأم)">{asset.manufacturer_serial_number ?? '—'}</Row>
            <Row label="تاريخ الشراء">{asset.purchase_date ?? '—'}</Row>
            <Row label="انتهاء الضمان">{asset.warranty_expiry ?? '—'}</Row>
            {asset.parent_asset_id && (
              <Row label="مركّب داخل">
                <Link to={`/assets/${asset.parent_asset_id}`} className="text-[var(--color-horizon)] hover:underline">
                  عرض الجهاز الأم
                </Link>
              </Row>
            )}
          </dl>
        </Card>

        <Card className="md:col-span-2">
          <div className="text-xs label-mono text-[var(--color-ink-soft)] mb-3">ملخص الاستخدام</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <Stat label="مرات التركيب" value={totalDeployments} />
            <Stat label="إجمالي أيام الاستخدام" value={totalDays} />
            <Stat label="متوسط مدة النشرة" value={avgDuration} />
            <Stat label="آخر عميل" value={lastClient ? lastClient.client_name : '—'} small />
          </div>
        </Card>
      </div>

      <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">سيرة النشر</h2>
      {deployments.length === 0 ? (
        <EmptyState message="لا يوجد سجل نشر لهذا الجهاز بعد" />
      ) : (
        <Card className="p-0 overflow-hidden mb-6">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">من تاريخ</th>
                <th className="px-4 py-3">إلى تاريخ</th>
                <th className="px-4 py-3">المدة (يوم)</th>
                <th className="px-4 py-3">حالة الإرجاع</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">{clients[d.client_id]?.client_name} — {clients[d.client_id]?.branch_name}</td>
                  <td className="px-4 py-3">{new Date(d.deployed_at).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">{d.actual_return_date ? new Date(d.actual_return_date).toLocaleDateString('ar-SA') : 'حالياً منشور'}</td>
                  <td className="px-4 py-3">{daysBetween(d.deployed_at, d.actual_return_date ?? new Date().toISOString())}</td>
                  <td className="px-4 py-3">{d.return_condition ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">سجل الصيانة</h2>
      {maintenance.length === 0 ? (
        <EmptyState message="لا يوجد سجل صيانة" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">النتيجة</th>
                <th className="px-4 py-3">التكلفة</th>
                <th className="px-4 py-3">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {maintenance.map((m) => (
                <tr key={m.id} className="border-b border-[var(--color-hairline)] last:border-0">
                  <td className="px-4 py-3">{m.maintenance_type}</td>
                  <td className="px-4 py-3">{new Date(m.performed_at).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">{m.result ?? '—'}</td>
                  <td className="px-4 py-3">{m.cost ?? 0}</td>
                  <td className="px-4 py-3">{m.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-hairline)] pb-2 last:border-0">
      <dt className="text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div>
      <div className={small ? 'text-sm font-semibold' : 'text-2xl font-semibold'}>{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)] mt-1">{label}</div>
    </div>
  )
}
