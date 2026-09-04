import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { PermissionGate } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useProductListController,
  useProductWriteController,
} from '../../controllers/useCatalogController'
import { PRODUCT_COLUMNS, PRODUCT_FILTERS, PRODUCT_TABS } from '../../tableColumns/catalogColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import { productBulkActions, productRowActions } from '../../lib/catalogActions'

export function ProductsPage() {
  const navigate = useNavigate()
  const list = useProductListController()
  const [removing, setRemoving] = useState(null)
  const writer = useProductWriteController()

  const setStatus = (id, status) => writer.setStatus.run({ id, status })

  const columns = useMemo(
    () =>
      withRowActions(
        PRODUCT_COLUMNS,
        productRowActions({
          open: (row) => navigate(adminPath.productDetail(row.id)),
          setStatus,
          onDelete: setRemoving,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, writer.setStatus],
  )

  return (
    <>
      <ListScreen
        title="Products"
        description={`${list.totalItems.toLocaleString('en-IN')} listings across marketplace, dropshipping and own stock`}
        actions={
          <>
            <ExportMenu onExport={() => {}} />
            <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
              <Button
                variant="secondary"
                size="control"
                icon="upload"
                onClick={() => navigate(ADMIN_ROUTES.CATALOG_IMPORT)}
              >
                Import
              </Button>
              <Button size="control" icon="add" onClick={() => navigate(ADMIN_ROUTES.PRODUCT_NEW)}>
                New product
              </Button>
            </PermissionGate>
          </>
        }
        controller={list}
        columns={columns}
        filters={PRODUCT_FILTERS}
        tabs={PRODUCT_TABS}
        searchPlaceholder="Product name, SKU or brand…"
        onRowClick={(product) => navigate(adminPath.productDetail(product.id))}
        itemLabel="products"
        emptyIcon="products"
        emptyTitle="No products match these filters"
        emptyDescription="Try a different tab, or clear the filters to see the whole catalog."
        selectable
        bulkLabel="products selected"
        bulkActions={productBulkActions({
          selectedKeys: list.selectedKeys,
          setStatus,
          clearSelection: () => list.setSelectedKeys([]),
        })}
      />

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        description="The listing is removed from the catalog. Orders already placed against it are unaffected."
        confirmLabel="Delete listing"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removing.id })
          setRemoving(null)
        }}
      />
    </>
  )
}
