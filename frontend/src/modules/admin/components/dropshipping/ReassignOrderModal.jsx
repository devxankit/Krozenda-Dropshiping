import { useState, useEffect } from 'react'
import { Button, Modal, Select } from '../../../../components/ui'
import { MoneyCell } from '../display'
import { toast } from '../../stores/toastStore'

export function ReassignOrderModal({ order, isOpen, onClose, onReassign }) {
  const [partnerName, setPartnerName] = useState('')
  const [status, setStatus] = useState('auto_assigned')

  useEffect(() => {
    if (order) {
      setPartnerName(order.partnerName)
      setStatus(order.forwardingStatus)
    }
  }, [order])

  if (!order) return null

  function handleSubmit(e) {
    e.preventDefault()
    onReassign?.(order.id, partnerName, status)
    toast.success(
      'Sub-Order Forwarding Updated',
      `Sub-order ${order.id} re-assigned to ${partnerName} with status ${status.replace('_', ' ')}.`,
    )
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Re-Assign Sub-Order ${order.id}`}
      description="Re-route auto-assigned dropship sub-order to an alternate supplier or update forwarding lifecycle."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="send">
            Update order
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface-muted p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-subtle">Product</span>
            <span className="font-semibold text-slate-900">{order.productName} (x{order.quantity})</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ink-subtle">Order Total</span>
            <MoneyCell amount={order.orderValue} compact />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ink-subtle">Buyer Customer</span>
            <span className="font-medium text-slate-900">{order.customerName}</span>
          </div>
        </div>

        <Select
          label="Assigned Dropship Supplier"
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
          options={[
            { value: 'Arya Manufacturing', label: 'Arya Manufacturing' },
            { value: 'Meghna Wholesale', label: 'Meghna Wholesale' },
            { value: 'Kritika Enterprises', label: 'Kritika Enterprises' },
            { value: 'Deccan Spice Traders', label: 'Deccan Spice Traders' },
            { value: 'Ganga Handicrafts', label: 'Ganga Handicrafts' },
          ]}
        />

        <Select
          label="Forwarding Lifecycle Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: 'auto_assigned', label: 'Auto-Assigned (Awaiting Partner Accept)' },
            { value: 'vendor_accepted', label: 'Supplier Accepted' },
            { value: 'packed', label: 'Packed (Packing Slip Ready)' },
            { value: 'awb_generated', label: 'AWB Generated (Shiprocket)' },
            { value: 'shipped', label: 'Shipped (In Transit)' },
          ]}
        />
      </form>
    </Modal>
  )
}
