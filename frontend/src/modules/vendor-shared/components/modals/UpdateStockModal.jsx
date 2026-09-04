import { useState, useEffect } from 'react'
import { Button, Input, Modal } from '../../../../components/ui'
import { toast } from '../../../admin/stores/toastStore'

export function UpdateStockModal({ product, isOpen, onClose, onUpdateStock }) {
  const [stock, setStock] = useState('')

  useEffect(() => {
    if (product) {
      setStock(product.stock.toString())
    }
  }, [product])

  if (!product) return null

  function handleSubmit(e) {
    e.preventDefault()
    const newQty = parseInt(stock, 10) || 0
    onUpdateStock?.(product.id, newQty)
    toast.success(
      'Stock Inventory Updated',
      `${product.sku} stock level set to ${newQty} units.`,
    )
    onClose()
  }

  function handleMarkOutOfStock() {
    onUpdateStock?.(product.id, 0)
    toast.warning(
      'SKU Marked Out of Stock',
      `${product.sku} is now hidden from instant cart order placement.`,
    )
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Inventory Stock — ${product.sku}`}
      description={`Update warehouse available quantity for ${product.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleMarkOutOfStock}>
            Mark out of stock
          </Button>
          <Button onClick={handleSubmit} icon="save">
            Update stock
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs">
          <p className="font-semibold text-slate-900">{product.name}</p>
          <p className="mt-0.5 text-ink-subtle">SKU: {product.sku} · Category: {product.category}</p>
        </div>

        <Input
          label="Current Stock Quantity (Units)"
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          required
        />
      </form>
    </Modal>
  )
}
