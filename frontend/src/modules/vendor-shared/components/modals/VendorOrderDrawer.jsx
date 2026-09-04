import { Drawer } from '../../../admin/components/overlay/Drawer'
import { Badge, Button } from '../../../../components/ui'
import { MoneyCell, StatusPill } from '../../../admin/components/display'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'
import { toast } from '../../../admin/stores/toastStore'

export function VendorOrderDrawer({ order, isOpen, onClose, onUpdateStatus }) {
  if (!order) return null

  function handleAccept() {
    onUpdateStatus?.(order.id, 'vendor_accepted')
    toast.success(
      'Order Accepted',
      `Sub-order ${order.id} accepted. Packing slip ready for printing.`,
    )
  }

  function handleGenerateAwb() {
    const awb = `SRK-${Math.floor(100000 + Math.random() * 900000)}-DEL`
    onUpdateStatus?.(order.id, 'shipped', awb)
    toast.success(
      'AWB & Shipping Label Generated',
      `Shiprocket AWB ${awb} assigned. Pickup scheduled.`,
    )
  }

  function handlePrintPackingSlip() {
    toast.info('Packing Slip', `Printing packing slip for sub-order ${order.id}.`)
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Sub-Order ${order.id}`}
      description={`Placed on ${order.placedAt}`}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handlePrintPackingSlip} icon="print">
            Print packing slip
          </Button>

          {order.forwardingStatus === 'auto_assigned' && (
            <Button onClick={handleAccept} icon="check">
              Accept order
            </Button>
          )}

          {(order.forwardingStatus === 'vendor_accepted' || order.forwardingStatus === 'packed') && (
            <Button onClick={handleGenerateAwb} icon="shipments">
              Generate AWB & Ship
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* Status & Financial Summary */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-4">
          <div>
            <span className="text-2xs font-semibold uppercase text-ink-faint">Fulfillment Lifecycle</span>
            <div className="mt-1">
              <StatusPill status={order.forwardingStatus} tones={VENDOR_ORDER_STATUS_TONE} size="md" />
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase text-ink-faint">Net Vendor Payout</span>
            <div className="mt-1">
              <MoneyCell amount={order.netPayable} compact className="text-emerald-600 text-lg font-bold" />
            </div>
          </div>
        </div>

        {/* Item Details */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Ordered Items</h3>
          <div className="rounded-lg border border-border p-3.5 text-xs">
            <div className="flex items-center justify-between font-medium text-slate-900">
              <span>{order.productName}</span>
              <span>Qty: {order.quantity}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-ink-subtle">
              <span>Gross Order Value</span>
              <MoneyCell amount={order.orderValue} compact />
            </div>
            <div className="mt-1 flex items-center justify-between text-ink-subtle">
              <span>Platform Commission Fee</span>
              <MoneyCell amount={order.commissionAmount} compact />
            </div>
          </div>
        </div>

        {/* Buyer & Delivery Address */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Buyer Delivery Details</h3>
          <div className="rounded-lg border border-border p-3.5 text-xs flex flex-col gap-1">
            <span className="font-semibold text-slate-900">{order.customerName}</span>
            <span className="text-ink-muted">{order.phone}</span>
            <span className="mt-1 font-mono text-ink-subtle">{order.shippingAddress}</span>
          </div>
        </div>

        {/* Logistics AWB details */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Shiprocket Logistics Tracking</h4>
              <p className="mt-0.5 text-xs text-ink-subtle">
                Pickup configured from vendor's registered warehouse location.
              </p>
            </div>
            {order.awb ? (
              <Badge tone="success" size="sm">
                AWB: {order.awb}
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                No AWB Assigned
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
