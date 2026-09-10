import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { downloadCsv } from '../../lib/csv'
import { Button, Card, EmptyState, PageHeader, Select, Spinner, Table } from '../../components/ui'

const VIEWS = [
  { key: 'v_asset_status_snapshot', label: 'حالة الأصول (لحظي)' },
  { key: 'v_stock_levels', label: 'مستويات المخزون' },
  { key: 'v_asset_model_reorder', label: 'إعادة شراء الأجهزة الجاهزة' },
  { key: 'v_waste_report', label: 'الهدر / التلف' },
  { key: 'v_installations_report', label: 'التركيبات' },
  { key: 'v_warranty_expiry', label: 'انتهاء الضمان' },
  { key: 'v_technician_performance', label: 'أداء الفنيين' },
  { key: 'v_branch_history', label: 'سيرة الفروع' },
  { key: 'v_tco_per_unit', label: 'التكلفة الإجمالية لكل جهاز (TCO)' },
  { key: 'v_battery_due', label: 'بطاريات مستحقة' },
  { key: 'v_subscription_alerts', label: 'تنبيهات الاشتراك' },
  { key: 'v_repeat_returns', label: 'أجهزة ترجع بشكل متكرر' },
] as const

export function Reports() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('view') ?? VIEWS[0].key
  const [view, setView] = useState(initial)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from(view)
      .select('*')
      .limit(500)
      .then(({ data }) => {
        setRows((data as Record<string, unknown>[]) ?? [])
        setLoading(false)
      })
  }, [view])

  function changeView(v: string) {
    setView(v)
    setParams({ view: v })
  }

  const columns = rows[0] ? Object.keys(rows[0]) : []

  return (
    <div>
      <PageHeader
        title="التقارير"
        action={<Button variant="secondary" onClick={() => downloadCsv(view, rows)} disabled={rows.length === 0}>تصدير CSV</Button>}
      />

      <Card className="mb-4">
        <Select value={view} onChange={(e) => changeView(e.target.value)} className="max-w-md">
          {VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </Select>
      </Card>

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message="لا توجد بيانات لهذا التقرير حالياً" /> : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <thead className="bg-[var(--color-clarity)] border-b border-[var(--color-hairline)]">
              <tr className="text-xs label-mono text-[var(--color-ink-soft)]">
                {columns.map((c) => <th key={c} className="px-4 py-3 whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[var(--color-hairline)] last:border-0">
                  {columns.map((c) => <td key={c} className="px-4 py-3 whitespace-nowrap">{String(row[c] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
