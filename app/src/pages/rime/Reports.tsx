import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { downloadCsv } from '../../lib/csv'
import { Card, Mono, SecondaryButton, Spinner } from '../../components/rime/primitives'
import { TopBar } from '../../components/rime/TopBar'

interface ReportDef {
  view: string
  titleAr: string
  titleEn: string
  questionAr: string
  questionEn: string
}

const REPORTS: ReportDef[] = [
  { view: 'v_asset_status_snapshot', titleAr: 'حالة الأصول', titleEn: 'Asset status snapshot', questionAr: 'كم جهاز بكل حالة الآن؟', questionEn: 'How many devices are in each state right now?' },
  { view: 'v_waste_report', titleAr: 'الهدر والتلف', titleEn: 'Waste and damage', questionAr: 'كم خسرنا هذا الشهر؟', questionEn: 'What did we lose this month?' },
  { view: 'v_installations_report', titleAr: 'التركيبات', titleEn: 'Installations', questionAr: 'كم تركيب صار وين؟', questionEn: 'How many installs happened, where?' },
  { view: 'v_stock_levels', titleAr: 'مستويات المخزون', titleEn: 'Stock levels', questionAr: 'وش قاعد يخلص؟', questionEn: 'What is running low?' },
  { view: 'purchase_invoices', titleAr: 'المشتريات', titleEn: 'Procurement', questionAr: 'كم صرفنا ولمين؟', questionEn: 'What did we spend, and with whom?' },
  { view: 'v_warranty_expiry', titleAr: 'انتهاء الضمان', titleEn: 'Warranty expiry', questionAr: 'أي جهاز قارب ضمانه ينتهي؟', questionEn: 'Which devices are close to warranty expiry?' },
  { view: 'v_technician_performance', titleAr: 'أداء الفنيين', titleEn: 'Technician performance', questionAr: 'مين الأسرع والأكثر إنتاجية؟', questionEn: 'Who is fastest and most productive?' },
  { view: 'v_branch_history', titleAr: 'سيرة الفروع', titleEn: 'Branch history', questionAr: 'كم زيارة لكل فرع تاريخيًا؟', questionEn: 'How many visits per branch, historically?' },
  { view: 'v_tco_per_unit', titleAr: 'التكلفة الإجمالية', titleEn: 'Total cost of ownership', questionAr: 'كم تكلّف كل جهاز فعليًا؟', questionEn: 'What does each device actually cost?' },
  { view: 'v_battery_due', titleAr: 'بطاريات مستحقة', titleEn: 'Batteries due', questionAr: 'أي بطارية قاربت تخلص؟', questionEn: 'Which batteries are due soon?' },
]

export function Reports() {
  const { t, locale } = useLanguage()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const results = await Promise.all(REPORTS.map((r) => supabase.from(r.view).select('*', { count: 'exact', head: true })))
      const map: Record<string, number> = {}
      results.forEach((res, i) => { map[REPORTS[i].view] = res.count ?? 0 })
      setCounts(map)
      setLoading(false)
    }
    load()
  }, [])

  async function exportReport(view: string) {
    const { data } = await supabase.from(view).select('*').limit(2000)
    downloadCsv(view, (data as Record<string, unknown>[]) ?? [])
  }

  if (loading) return <Spinner />

  return (
    <div>
      <TopBar title={t.reports.title} />
      <div className="p-6 grid gap-3" style={{ background: 'var(--bg-base)', gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {REPORTS.map((r) => (
          <Card key={r.view}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold" style={{ fontSize: 14 }}>{locale === 'ar' ? r.titleAr : r.titleEn}</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{locale === 'ar' ? r.questionAr : r.questionEn}</p>
                <Mono style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, display: 'block' }}>{r.view}</Mono>
              </div>
              <div className="text-center flex-none" style={{ width: 96 }}>
                <div style={{ fontFamily: 'var(--rime-font-display)', fontSize: 'var(--rime-text-lg)', fontWeight: 600 }}>{counts[r.view] ?? 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>rows</div>
              </div>
            </div>
            <SecondaryButton icon={<Download size={14} />} onClick={() => exportReport(r.view)} className="mt-3">CSV</SecondaryButton>
          </Card>
        ))}
      </div>
    </div>
  )
}
