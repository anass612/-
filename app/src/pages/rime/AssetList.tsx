import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Download, ChevronDown, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { downloadCsv } from '../../lib/csv'
import type { Asset, AssetStatus, Client } from '../../lib/types'
import { ASSET_STATUS_TONE, CONDITION_TONE, EmptyState, KpiCard, Mono, SecondaryButton, Spinner, StatusPill } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

const STATUSES: AssetStatus[] = ['in_warehouse', 'deployed', 'in_maintenance', 'in_transit', 'lost_damaged']

export function AssetList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AssetStatus | ''>('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase.from('v_asset_status_snapshot').select('*')
      const totals: Record<string, number> = {}
      for (const r of (data as { current_status: string; total: number }[]) ?? []) {
        totals[r.current_status] = (totals[r.current_status] ?? 0) + Number(r.total)
      }
      setCounts(totals)
    }
    loadCounts()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('assets').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200)
      if (status) query = query.eq('current_status', status)
      if (search.trim()) query = query.or(`serial_number.ilike.%${search}%,manufacturer_serial_number.ilike.%${search}%`)
      const { data } = await query
      setAssets((data as Asset[]) ?? [])

      const clientIds = [...new Set((data as Asset[] | null)?.map((a) => a.current_client_id).filter(Boolean))] as string[]
      if (clientIds.length) {
        const { data: cl } = await supabase.from('clients').select('*').in('id', clientIds)
        setClients(Object.fromEntries(((cl as Client[]) ?? []).map((c) => [c.id, c])))
      } else {
        setClients({})
      }
      setLoading(false)
    }
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [search, status])

  return (
    <div>
      <TopBar
        title={t.assetList.title}
        actions={
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2"
              style={{ height: 38, padding: '0 12px', background: 'var(--surface-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--rime-radius-sm)', width: 340 }}
            >
              <Search size={16} color="var(--text-tertiary)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.assetList.serial + ' / ' + t.assetList.clientBranch}
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: 14, color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={() => navigate('/stock/catalog')}
              className="inline-flex items-center gap-2 font-semibold"
              style={{ height: 40, padding: '0 16px', border: 'none', borderRadius: 'var(--rime-radius-button)', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 14 }}
            >
              <Plus size={16} /> {t.assetList.registerNew}
            </button>
          </div>
        }
      />

      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {STATUSES.map((s) => (
            <KpiCard
              key={s}
              label={t.status[s]}
              value={(counts[s] ?? 0).toLocaleString()}
              pill={s === 'lost_damaged' && (counts[s] ?? 0) > 0 ? <StatusPill tone="critical">{t.assetList.needsReview}</StatusPill> : undefined}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {status && (
              <button
                onClick={() => setStatus('')}
                className="inline-flex items-center gap-1.5 font-medium"
                style={{ height: 34, padding: '0 12px', borderRadius: 999, background: 'var(--surface-selected)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: 13 }}
              >
                {t.status[status]} <X size={13} />
              </button>
            )}
            <div className="relative inline-block">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssetStatus | '')}
                className="appearance-none font-medium"
                style={{ height: 34, padding: '0 30px 0 12px', borderRadius: 999, background: 'var(--surface-primary)', border: '1px solid var(--border-color-strong)', color: 'var(--text-secondary)', fontSize: 13 }}
              >
                <option value="">{t.assetList.status}</option>
                {(Object.keys(t.status) as AssetStatus[]).filter((k) => STATUSES.includes(k)).map((s) => (
                  <option key={s} value={s}>{t.status[s]}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute" style={{ insetInlineEnd: 10, top: 10, color: 'var(--text-tertiary)' }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.assetList.showingCount(assets.length, assets.length)}</span>
            <SecondaryButton icon={<Download size={15} />} onClick={() => downloadCsv('assets', assets as unknown as Record<string, unknown>[])}>
              {t.common.export}
            </SecondaryButton>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : assets.length === 0 ? (
          <EmptyState message={t.common.noData} />
        ) : (
          <TableCard>
            <THead>
              <TH>{t.assetList.serial}</TH>
              <TH>{t.assetList.type}</TH>
              <TH>{t.assetList.model}</TH>
              <TH>{t.assetList.status}</TH>
              <TH>{t.assetList.clientBranch}</TH>
              <TH>{t.assetList.condition}</TH>
              <TH>{t.assetList.lastMovement}</TH>
            </THead>
            <tbody>
              {assets.map((a) => (
                <TR key={a.id} onClick={() => navigate(`/assets/${a.id}`)}>
                  <TD><Mono className="font-semibold" style={{ color: 'var(--color-link)' }}>{a.serial_number}</Mono></TD>
                  <TD>{a.asset_type}</TD>
                  <TD style={{ color: 'var(--text-secondary)' }}>{a.model ?? t.common.dash}</TD>
                  <TD><StatusPill tone={ASSET_STATUS_TONE[a.current_status]}>{t.status[a.current_status]}</StatusPill></TD>
                  <TD>
                    {a.current_client_id ? (
                      <Link to={`/clients/${a.current_client_id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--color-link)' }}>
                        {clients[a.current_client_id]?.client_name} — {clients[a.current_client_id]?.branch_name}
                      </Link>
                    ) : t.common.dash}
                  </TD>
                  <TD><StatusPill tone={CONDITION_TONE[a.condition_grade]}>{t.status[a.condition_grade]}</StatusPill></TD>
                  <TD><Mono style={{ color: 'var(--text-secondary)' }}>{new Date(a.updated_at).toISOString().slice(0, 10)}</Mono></TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </div>
  )
}
