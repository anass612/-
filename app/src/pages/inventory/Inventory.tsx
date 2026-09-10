import { useState } from 'react'
import { PageHeader } from '../../components/ui'
import { ComponentsTab } from './ComponentsTab'
import { ConsumablesTab } from './ConsumablesTab'
import { AssetModelsTab } from './AssetModelsTab'
import { ProductsTab } from './ProductsTab'

const TABS = [
  { key: 'components', label: 'القطع (Components)' },
  { key: 'consumables', label: 'المستهلكات' },
  { key: 'models', label: 'موديلات الأجهزة' },
  { key: 'products', label: 'المنتجات (BOM)' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function Inventory() {
  const [tab, setTab] = useState<TabKey>('components')

  return (
    <div>
      <PageHeader title="المخزون" />
      <div className="flex gap-1 mb-6 border-b border-[var(--color-hairline)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-[var(--color-first-light)] text-[var(--color-ink)] font-medium' : 'border-transparent text-[var(--color-ink-soft)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'components' && <ComponentsTab />}
      {tab === 'consumables' && <ConsumablesTab />}
      {tab === 'models' && <AssetModelsTab />}
      {tab === 'products' && <ProductsTab />}
    </div>
  )
}
