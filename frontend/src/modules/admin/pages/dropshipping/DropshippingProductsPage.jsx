import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useDropshipMarginsController,
  useDropshipProductsController,
} from '../../controllers/useDropshippingController'
import {
  DROPSHIP_PRODUCT_COLUMNS,
  DROPSHIP_PRODUCT_FILTERS,
  DROPSHIP_PRODUCT_TABS,
} from '../../tableColumns/dropshippingColumns'
import { OverrideMarginModal } from '../../components/dropshipping/OverrideMarginModal'
import { MarginRuleModal } from '../../components/dropshipping/MarginRuleModal'
import { downloadTableCsv } from '../../lib/exportCsv'

export function DropshippingProductsPage() {
  const list = useDropshipProductsController()
  const margins = useDropshipMarginsController()

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  const syncErrors = list.items.filter((row) => row.syncStatus === 'sync_error').length

  return (
    <>
      <ListScreen
        title="Dropship Catalog & Margins"
        description="Products supplied via Model A dropshipping partners with cost prices, list prices and gross margin percentages."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('dropship-products.csv', DROPSHIP_PRODUCT_COLUMNS, list.items)} />
            <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
              <Button size="control" icon="sliders" onClick={() => setRuleModalOpen(true)}>
                Margin rules
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          syncErrors > 0 && (
            <InlineAlert tone="warning" title={`${syncErrors} SKUs have stock or price sync warnings`}>
              Check supplier sync status adapter logs for details. Stock levels are automatically hidden on buyer apps if supplier feed times out.
            </InlineAlert>
          )
        }
        controller={list}
        columns={DROPSHIP_PRODUCT_COLUMNS}
        filters={DROPSHIP_PRODUCT_FILTERS}
        tabs={DROPSHIP_PRODUCT_TABS}
        searchPlaceholder="SKU, product name, supplier or category…"
        itemLabel="dropship SKUs"
        emptyIcon="products"
        emptyTitle="No dropship products match these filters"
        onRowClick={(row) => setSelectedProduct(row)}
      />

      <OverrideMarginModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onSaveOverride={list.overrideProductMargin}
      />

      <MarginRuleModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onAddRule={margins.addRule}
      />
    </>
  )
}
