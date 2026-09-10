import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import type { Asset, Client, Deployment } from '../../lib/types'
import { EmptyState, Mono, SecondaryButton, Spinner, StatusPill, TextField } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

type Row = Deployment & { asset: Asset | null; client: Client | null }

export function DeploymentBackfill() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, { deployed_at: string; expected_return_date: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('deployments')
      .select('*, asset:assets(*), client:clients(*)')
      .eq('deployed_at_is_estimated', true)
      .is('actual_return_date', null)
      .order('deployed_at', { ascending: false })
    const list = (data as Row[]) ?? []
    setRows(list)
    setEdits(Object.fromEntries(list.map((r) => [r.id, {
      deployed_at: r.deployed_at.slice(0, 10),
      expected_return_date: r.expected_return_date ? r.expected_return_date.slice(0, 10) : '',
    }])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(id: string) {
    const edit = edits[id]
    if (!edit?.deployed_at) return
    setError(null)
    setSavingId(id)
    const { error } = await supabase.from('deployments')
      .update({
        deployed_at: edit.deployed_at,
        expected_return_date: edit.expected_return_date || null,
        deployed_at_is_estimated: false,
      })
      .eq('id', id)
    setSavingId(null)
    if (error) { setError(error.message); return }
    setSavedIds((prev) => new Set(prev).add(id))
  }

  return (
    <div>
      <TopBar title={t.backfill.title} subtitle={t.backfill.subtitle} />
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        {loading ? <Spinner /> : rows.length === 0 ? (
          <EmptyState message={t.backfill.allDone} />
        ) : (
          <TableCard>
            <THead>
              <TH>{t.backfill.col_serial}</TH>
              <TH>{t.backfill.col_client}</TH>
              <TH>{t.backfill.col_deployedAt}</TH>
              <TH>{t.backfill.col_expectedReturn}</TH>
              <TH>{null}</TH>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>{r.asset ? <Link to={`/assets/${r.asset.id}`}><Mono style={{ color: 'var(--color-link)' }}>{r.asset.serial_number}</Mono></Link> : t.common.dash}</TD>
                  <TD style={{ fontSize: 13 }}>{r.client ? `${r.client.client_name} — ${r.client.branch_name}` : t.common.dash}</TD>
                  <TD>
                    <TextField
                      type="date"
                      value={edits[r.id]?.deployed_at ?? ''}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], deployed_at: e.target.value } }))}
                      style={{ height: 36, width: 150 }}
                    />
                  </TD>
                  <TD>
                    <TextField
                      type="date"
                      value={edits[r.id]?.expected_return_date ?? ''}
                      onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], expected_return_date: e.target.value } }))}
                      style={{ height: 36, width: 150 }}
                    />
                  </TD>
                  <TD>
                    {savedIds.has(r.id) ? (
                      <StatusPill tone="success">{t.backfill.saved}</StatusPill>
                    ) : (
                      <SecondaryButton icon={<Save size={13} />} onClick={() => handleSave(r.id)} disabled={savingId === r.id} style={{ height: 34, padding: '0 12px', fontSize: 12 }}>
                        {t.common.save}
                      </SecondaryButton>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        )}
        {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  )
}
