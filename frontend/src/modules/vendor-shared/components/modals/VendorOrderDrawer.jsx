import { useState } from 'react'
import { Drawer } from '../../../admin/components/overlay/Drawer'
import { Badge, Button, Input } from '../../../../components/ui'
import { MoneyCell, StatusPill } from '../../../admin/components/display/cells'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'
import { toast } from '../../../admin/stores/toastStore'

const NEXT_STATUS = { PENDING: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED' }
const NEXT_LABEL = { PROCESSING: 'Start Processing', SHIPPED: 'Mark Shipped', DELIVERED: 'Mark Delivered' }

export function VendorOrderDrawer({ order, isOpen, onClose, onUpdateItemStatus }) {
  const [tracking, setTracking] = useState({})

  if (!order) return null

  async function handleAdvance(item) {
    const nextStatus = NEXT_STATUS[item.status]
    if (!nextStatus) return

    const payload = { status: nextStatus }
    if (nextStatus === 'SHIPPED') {
      const trackingNumber = tracking[item.productId]?.trim()
      if (!trackingNumber) {
        toast.error('Tracking required', 'Enter a tracking number before marking this item shipped.')
        return
      }
      payload.trackingNumber = trackingNumber
      payload.courierName = tracking[`${item.productId}-courier`] || ''
    }

    try {
      await onUpdateItemStatus(order.orderId, item.productId, payload)
      toast.success('Item updated', `"${item.name}" is now ${nextStatus.toLowerCase()}.`)
    } catch (err) {
      toast.error('Could not update item', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Order #${order.id.slice(-8).toUpperCase()}`} description={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')}`} width="lg">
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-4">
          <div>
            <span className="text-2xs font-semibold uppercase text-ink-faint">Status</span>
            <div className="mt-1">
              <StatusPill status={order.status} tones={VENDOR_ORDER_STATUS_TONE} size="md" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xs font-semibold uppercase text-ink-faint">Your Items Value</span>
            <div className="mt-1">
              <MoneyCell amount={order.itemsValue} compact className="text-emerald-600 text-lg font-bold" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Your Items</h3>
          {order.items.map((item) => (
            <div key={item.productId} className="rounded-lg border border-border p-3.5 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between font-medium text-slate-900">
                <span>{item.name}{item.variant ? ` · ${item.variant}` : ''}</span>
                <span>Qty: {item.quantity}</span>
              </div>
              <div className="flex items-center justify-between text-ink-subtle">
                <MoneyCell amount={item.price} compact />
                <StatusPill status={item.status} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />
              </div>

              {item.trackingNumber && (
                <Badge tone="success" size="sm">
                  {item.courierName ? `${item.courierName} · ` : ''}AWB {item.trackingNumber}
                </Badge>
              )}

              {NEXT_STATUS[item.status] && (
                <div className="flex items-end gap-2 pt-1">
                  {NEXT_STATUS[item.status] === 'SHIPPED' && (
                    <>
                      <Input
                        label="Tracking number"
                        placeholder="AWB / tracking ID"
                        value={tracking[item.productId] || ''}
                        onChange={(e) => setTracking((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                      />
                      <Input
                        label="Courier (optional)"
                        placeholder="e.g. Delhivery"
                        value={tracking[`${item.productId}-courier`] || ''}
                        onChange={(e) => setTracking((prev) => ({ ...prev, [`${item.productId}-courier`]: e.target.value }))}
                      />
                    </>
                  )}
                  <Button size="xs" onClick={() => handleAdvance(item)}>
                    {NEXT_LABEL[NEXT_STATUS[item.status]]}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Delivery Address</h3>
          <div className="rounded-lg border border-border p-3.5 text-xs flex flex-col gap-1">
            <span className="font-semibold text-slate-900">{order.shippingAddress?.fullName}</span>
            <span className="text-ink-muted">{order.shippingAddress?.phone}</span>
            <span className="mt-1 text-ink-subtle">
              {order.shippingAddress?.line1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
