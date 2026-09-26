import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ListScreen } from '../../admin/components/data/ListScreen'
import { InlineAlert } from '../../admin/components/feedback'
import { useVendorInventoryController } from '../controllers/useVendorController'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'

export function VendorInventoryPage() {
  const controller = useVendorInventoryController()
  const [selectedProduct, setSelectedProduct] = useState(null)

  const outOfStock = controller.tabCounts?.out_of_stock || 0

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.image && <img src={row.image} alt="" className="h-8 w-8 rounded-md object-cover" />}
          <div className="flex flex-col">
            <span className="font-medium text-xs text-slate-900">{row.name}</span>
            <span className="font-mono text-2xs text-ink-subtle">{row.sku || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Available Stock',
      width: '12rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <span
            className={`tabular font-semibold text-xs ${row.isOutOfStock ? 'text-danger-600' : row.isLowStock ? 'text-warning-700' : 'text-slate-900'}`}
          >
            {row.isOutOfStock ? 'Out of stock' : `${row.stock.toLocaleString('en-IN')} units`}
          </span>
          <Button size="xs" variant="secondary" onClick={() => setSelectedProduct(row)}>
            Adjust
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <ListScreen
        title="Inventory"
        description="Track and adjust stock for your products."
        banner={
          outOfStock > 0 && (
            <InlineAlert tone="warning" title={`${outOfStock} products are out of stock`}>
              Out-of-stock products stay listed but can&apos;t be ordered until you restock them.
            </InlineAlert>
          )
        }
        controller={controller}
        columns={columns}
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'low_stock', label: 'Low Stock' },
          { id: 'out_of_stock', label: 'Out of Stock' },
        ]}
        itemLabel="products"
      />

      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={controller.updateStock}
      />
    </>
  )
}
