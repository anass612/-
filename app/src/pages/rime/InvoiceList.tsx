import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../i18n/LanguageContext'
import { EmptyState, Mono, PrimaryButton, Spinner } from '../../components/rime/primitives'
import { TableCard, THead, TH, TR, TD } from '../../components/rime/Table'
import { TopBar } from '../../components/rime/TopBar'

interface Invoice { id: string; supplier_name: string; invoice_number: string | null; invoice_date: string; total_cost: number }

export function InvoiceList() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('purchase_invoices').select('*').order('invoice_date', { ascending: false }).then(({ data }) => {
      setInvoices((data as Invoice[]) ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <TopBar title={t.nav.invoices} actions={<PrimaryButton icon={<Plus size={16} />} onClick={() => navigate('/invoices/new')}>{t.common.add}</PrimaryButton>} />
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        {loading ? <Spinner /> : invoices.length === 0 ? <EmptyState message={t.common.noData} /> : (
          <TableCard>
            <THead>
              <TH>{t.invoices.supplier}</TH>
              <TH>{t.invoices.invoiceNumber}</TH>
              <TH>{t.invoices.invoiceDate}</TH>
              <TH>{t.invoices.grandTotal}</TH>
            </THead>
            <tbody>
              {invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD>{inv.supplier_name}</TD>
                  <TD><Mono>{inv.invoice_number ?? '—'}</Mono></TD>
                  <TD><Mono>{inv.invoice_date}</Mono></TD>
                  <TD><Mono className="font-semibold">SAR {inv.total_cost.toLocaleString()}</Mono></TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </div>
  )
}
