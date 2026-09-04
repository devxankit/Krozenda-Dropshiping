import { useMemo, useState } from 'react'
import { Tabs } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { DataTable, ExportMenu, FilterBar } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { InventoryAdjustDialog } from '../../components/catalog/CatalogForms'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useInventoryController,
  useInventoryWriteController,
} from '../../controllers/useCatalogController'
import { INVENTORY_COLUMNS, INVENTORY_TABS } from '../../tableColumns/catalogColumns'
import { withRowActions } from '../../tableColumns/rowActions'

export function InventoryPage() {
  const list = useInventoryController()
  const [adjusting, setAdjusting] = useState(null)
  const writer = useInventoryWriteController({ onSaved: () => setAdjusting(null) })
  const lowCount = list.tabCounts.low || 0

  const columns = useMemo(
    () =>
      withRowActions(INVENTORY_COLUMNS, (row) => [
        {
          label: 'Adjust stock',
          icon: 'edit',
          permission: ADMIN_PERMISSIONS.CATALOG_MANAGE,
          // Vendor stock is the seller's count, not ours to overwrite.
          disabled: row.bucket === 'vendor',
          onSelect: () => setAdjusting(row),
        },
      ]),
    [],
  )

  return (
    <>
    <PageBody>
      <PageHeader
        title="Inventory"
        description="Own stock and vendor stock are counted in separate buckets and reported separately."
        actions={<ExportMenu onExport={() => {}} />}
      />

      {lowCount > 0 && (
        <InlineAlert tone="warning" title={`${lowCount} products have a week or less of cover`}>
          Days of cover is calculated from the last 30 days of sales. Vendor stock cannot be
          replenished from here — the seller is notified instead.
        </InlineAlert>
      )}

      <Tabs
        items={INVENTORY_TABS.map((tab) => ({ ...tab, count: list.tabCounts[tab.id] }))}
        activeId={list.tab}
        onChange={list.changeTab}
      />

      <FilterBar
        filters={[]}
        value={list.filters}
        onChange={list.changeFilters}
        searchPlaceholder="Product name or SKU…"
      />

      <DataTable
        columns={columns}
        data={list.items}
        getRowKey={(item) => item.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.refetch}
        page={1}
        totalPages={1}
        totalItems={list.items.length}
        rowsPerPage={list.rowsPerPage}
        onPageChange={list.setPage}
        itemLabel="products"
        emptyIcon="inventory"
        emptyTitle="No stock matches this view"
        emptyDescription="Switch tabs or clear the search to see everything held."
      />
    </PageBody>

      {adjusting && (
        <InventoryAdjustDialog
          key={adjusting.id}
          isOpen
          onClose={() => setAdjusting(null)}
          row={adjusting}
          adjust={writer.adjust}
        />
      )}
    </>
  )
}
