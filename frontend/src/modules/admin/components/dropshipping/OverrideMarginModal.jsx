import { useState, useEffect } from 'react'
import { Button, Input, Modal } from '../../../../components/ui'
import { MoneyCell } from '../display'
import { toast } from '../../stores/toastStore'

export function OverrideMarginModal({ product, isOpen, onClose, onSaveOverride }) {
  const [newPrice, setNewPrice] = useState('')

  useEffect(() => {
    if (product) {
      setNewPrice((product.sellingPrice / 100).toString())
    }
  }, [product])

  if (!product) return null

  const cost = product.costPrice / 100
  const priceNum = parseFloat(newPrice) || cost
  const calculatedMargin = priceNum > cost ? (((priceNum - cost) / priceNum) * 100).toFixed(1) : '0.0'

  function handleSubmit(e) {
    e.preventDefault()
    const priceInPaise = Math.round(priceNum * 100)

    onSaveOverride?.(product.id, priceInPaise, parseFloat(calculatedMargin))
    toast.success(
      'Margin Override Saved',
      `Updated ${product.sku} list price to ₹${priceNum.toLocaleString('en-IN')} (${calculatedMargin}% margin).`,
    )
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Override Margin — ${product.sku}`}
      description={`Adjust list price and platform margin for ${product.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="save">
            Save override
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface-muted p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-subtle">Supplier Partner</span>
            <span className="font-semibold text-slate-900">{product.partnerName}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ink-subtle">Base Cost Price</span>
            <MoneyCell amount={product.costPrice} compact />
          </div>
        </div>

        <Input
          label="New Retail List Price (₹)"
          type="number"
          step="0.01"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          required
        />

        <div className="flex items-center justify-between rounded-md bg-success-50 p-3 border border-success-200">
          <span className="text-xs font-semibold text-success-800">Calculated Platform Margin</span>
          <span className="text-base font-bold text-success-700">{calculatedMargin}%</span>
        </div>
      </form>
    </Modal>
  )
}
