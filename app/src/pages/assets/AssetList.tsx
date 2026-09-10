import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ASSET_STATUS_LABELS, type Asset, type AssetStatus, type Client } from '../../lib/types'
import { Button, Card, EmptyState, Input, PageHeader, Select, Spinner, StatusBadge, Table } from '../../components/ui'

export function AssetList() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AssetStatus | ''>('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('assets').select('*').order('created_at', { ascending: false }).limit(200)
      if (status) query = query.eq('current_status', status)
      if (search.trim()) {
        query = query.or(
          `serial_number.ilike.%${search}%,manufacturer_serial_number.ilike.%${search}%`
        )
      }
      const { data } = await query
      setAssets((data as Asset[]) ?? [])

      const clientIds = [...new Set((data as Asset[] | null)?.map((a) => a.current_client_id).filter(Boolean))] as string[]
      if (clientIds.length) {
        const { data: cl } = await supabase.from('clients').select('*').in('id', clientIds)
        const map: Record<string, Client> = {}
        for (const c of (cl as Client[]) ?? []) map[c.id] = c
        setClients(map)
      } else {
        setClients({})
      }
      setLoading(false)
    }
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, status])

  return (
    <div>
      <PageHeader
        title="الأصول"
        action={
          <div className="flex gap-2">
            <Link to="/assets/assemble"><Button>تجميع جهاز جديد</Button></Link>
            <Link to="/assets/disassemble"><Button variant="secondary">تفكيك جهاز</Button></Link>
          </div>
        }
      />

      <Card className="mb-4 flex flex-col md:flex-row gap-3">
        <Input
          placeholder="ابحث بالسريال (داخلي أو من الشركة الأم)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:w-80"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus | '')} className="md:w-56">
          <option value="">كل الحالات</option>
          {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((s) => (
            <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <Spinner />
      ) : assets.length === 0 ? (
        <EmptyState message="لا توجد أصول مطابقة" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                <th className="px-4 py-3">السريال الداخلي</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">العميل الحالي</th>
                <th className="px-4 py-3">الضمان</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[var(--color-clarity)]">
                  <td className="px-4 py-3">
                    <Link to={`/assets/${a.id}`} className="font-medium text-[var(--color-horizon)] hover:underline">
                      {a.serial_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{a.asset_type}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.current_status} /></td>
                  <td className="px-4 py-3">
                    {a.current_client_id ? `${clients[a.current_client_id]?.client_name ?? ''} — ${clients[a.current_client_id]?.branch_name ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">{a.warranty_expiry ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
