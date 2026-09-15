import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ExportMenu, ListScreen } from '../../admin/components/data'
import { useVendorProductsController } from '../controllers/useVendorController'
import { VENDOR_PRODUCT_COLUMNS, VENDOR_PRODUCT_TABS } from '../tableColumns/vendorColumns'
import { AddVendorProductModal } from '../components/modals/AddVendorProductModal'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'

export function VendorProductsPage() {
  const list = useVendorProductsController()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  return (
    <>
      <ListScreen
        title="Products"
        description="Manage your product listings, pricing and stock. New products go live once an admin approves them."
        actions={
          <>
            <ExportMenu onExport={() => {}} />
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

      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={list.updateStock}
      />
    </>
  )
}
