import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ExportMenu, ListScreen } from '../../admin/components/data'
import { useVendorProductsController } from '../controllers/useVendorController'
import { VENDOR_PRODUCT_COLUMNS, VENDOR_PRODUCT_TABS } from '../tableColumns/vendorColumns'
import { AddVendorProductModal } from '../components/modals/AddVendorProductModal'
import { ImportProductsModal } from '../components/modals/ImportProductsModal'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'
import { ScanBarcodeModal } from '../../../components/common/ScanBarcodeModal'
import { downloadTableCsv } from '../../admin/lib/exportCsv'

export function VendorProductsPage() {
  const list = useVendorProductsController()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <ListScreen
        title="Products"
        description="Manage your product listings, pricing and stock. New products go live once an admin approves them."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('products.csv', VENDOR_PRODUCT_COLUMNS, list.items)} />
            <Button size="control" icon="search" variant="secondary" onClick={() => setScanOpen(true)}>
              Scan barcode
            </Button>
            <Button size="control" icon="upload" variant="secondary" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button size="control" icon="add" onClick={() => setAddModalOpen(true)}>
              Add product
            </Button>
          </>
        }
        controller={list}
        columns={VENDOR_PRODUCT_COLUMNS}
        tabs={VENDOR_PRODUCT_TABS}
        searchPlaceholder="SKU, product title or category…"
        itemLabel="vendor products"
        emptyIcon="products"
        emptyTitle="No products match these filters"
        onRowClick={(row) => setSelectedProduct(row)}
      />

      <AddVendorProductModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAddProduct={list.addProduct}
      />

      <ImportProductsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        // The list is server-paged, so a refetch is the only way the new rows
        // appear — there is nothing local to append them to.
        onImported={() => list.refetch?.()}
      />

      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={list.updateStock}
      />

      {/* Scoped to this seller's own catalog server-side — see
          Controllers/vendorProductController.js — so a scan can never
          resolve to, or leak the existence of, another seller's product. */}
      <ScanBarcodeModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        lookupPath={(code) => `/vendor/products/barcode/${code}`}
        onFound={(product) => {
          setScanOpen(false)
          setSelectedProduct(product)
        }}
      />
    </>
  )
}
