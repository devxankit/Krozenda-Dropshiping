import { Badge, Button } from '../../../../components/ui'
import { PRODUCT_TYPE_LABELS, REVIEW_STATUS_TONE } from '../../constants'
import { KeyValueList, SectionCard, Timeline } from '../display'
import { CommissionChain, PriceTierTable, ProductInventoryTable } from './index'

export const PRODUCT_DETAIL_TABS = Object.freeze([
  { id: 'general', label: 'General' },
  { id: 'pricing', label: 'Pricing & tax' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'approval', label: 'Approval history' },
])

// One tab body per id. Keeping the switch here rather than in the page keeps
// the page at composition-only, which is what rule 03 asks for.
export function ProductTabPanel({ tab, product }) {
  if (tab === 'pricing') {
    return (
      <>
        <PriceTierTable
          tiers={product.priceTiers}
          actions={
            <Button variant="secondary" size="sm" icon="add">
              Add tier
            </Button>
          }
        />
        <CommissionChain commission={product.commission} />
      </>
    )
  }

  if (tab === 'inventory') {
    return <ProductInventoryTable inventory={product.inventory} />
  }

  if (tab === 'approval') {
    return (
      <SectionCard
        title="Approval chain"
        description="Category, then brand, then product — each blocked until the one before it clears"
      >
        <div className="px-4 py-4">
          <Timeline events={product.approvalHistory} />
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Description">
      <p className="px-4 py-3 text-xs leading-relaxed text-ink-muted">{product.description}</p>
    </SectionCard>
  )
}

export function ProductMetaRail({ product }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Tax & identifiers">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'SKU', value: <span className="tabular">{product.sku}</span> },
              { label: 'Barcode', value: <span className="tabular">{product.barcode}</span> },
              { label: 'HSN', value: <span className="tabular">{product.tax.hsn}</span> },
              { label: 'GST rate', value: `${product.tax.gstRate}%` },
              { label: 'Origin', value: product.tax.countryOfOrigin },
              { label: 'MOQ', value: product.moq },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Classification">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Category', value: product.category },
              {
                label: 'Brand',
                value: (
                  <Badge tone={REVIEW_STATUS_TONE[product.brand.status]} size="sm" dot>
                    {product.brand.name}
                  </Badge>
                ),
              },
              { label: 'Type', value: PRODUCT_TYPE_LABELS[product.type] },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  )
}
