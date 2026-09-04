import { useState } from 'react'
import { Button, Table } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell'
import { InlineAlert } from '../../admin/components/feedback'
import { SectionCard } from '../../admin/components/display'
import { MoneyCell, StatusPill } from '../../admin/components/display'
import { useVendorProductsController } from '../controllers/useVendorController'
import { VENDOR_PRODUCT_STATUS_TONE } from '../constants'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'

export function VendorInventoryPage() {
  const { items, isLoading, isError, error, updateStock } = useVendorProductsController()
  const [selectedProduct, setSelectedProduct] = useState(null)

  if (isLoading) {
    return <div className="p-4 text-xs text-ink-subtle">Loading inventory state...</div>
  }

  if (isError) {
    return <div className="p-4 text-xs text-danger-700">{error?.message || 'Error loading inventory'}</div>
  }

  const outOfStock = items.filter((p) => p.stock === 0).length

  const columns = [
    {
      key: 'sku',
      header: 'SKU / Product',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-slate-900">{row.name}</span>
          <span className="font-mono text-2xs text-ink-subtle">{row.sku} · {row.category}</span>
        </div>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Retail Price',
      width: '8rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.sellingPrice} compact />,
    },
    {
      key: 'stock',
      header: 'Warehouse Available Stock',
      width: '12rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <span className={`tabular font-semibold text-xs ${row.stock > 0 ? 'text-slate-900' : 'text-danger-600'}`}>
            {row.stock > 0 ? `${row.stock.toLocaleString('en-IN')} units` : 'Out of stock'}
          </span>
          <Button size="xs" variant="secondary" onClick={() => setSelectedProduct(row)}>
            Adjust
          </Button>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '8.5rem',
      render: (row) => <StatusPill status={row.status} tones={VENDOR_PRODUCT_STATUS_TONE} size="sm" />,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory & Warehouse Stock"
        description="Monitor live stock levels across your registered warehouse location to prevent order cancellation."
      />

      {outOfStock > 0 && (
        <InlineAlert tone="warning" title={`${outOfStock} SKUs are currently out of stock`}>
          Products with 0 stock are automatically hidden from retail and B2B buyer ordering apps.
        </InlineAlert>
      )}

      <SectionCard title="Live Stock Levels" description="Manage warehouse quantity for direct dropshipping and marketplace dispatch">
        <Table
          className="rounded-none border-0 border-t"
          columns={columns}
          data={items}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>

      <UpdateStockModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={updateStock}
      />
    </div>
  )
}
