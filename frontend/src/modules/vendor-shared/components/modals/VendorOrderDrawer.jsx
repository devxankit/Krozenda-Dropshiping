import { useState } from 'react'
import { Drawer } from '../../../admin/components/overlay/Drawer'
import { Badge, Button, Input, Textarea } from '../../../../components/ui'
import { MoneyCell, StatusPill } from '../../../admin/components/display/cells'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'
import { toast } from '../../../admin/stores/toastStore'
import { useOrderShipmentsController, useShippingIntegrationController } from '../../controllers/useShippingController'
import { shipmentStatusPresentation } from '../../../../lib/shipping/presentation'

const NEXT_STATUS = { PENDING: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED' }
const NEXT_LABEL = { PROCESSING: 'Start Processing', SHIPPED: 'Mark Shipped', DELIVERED: 'Mark Delivered' }

export function VendorOrderDrawer({ order, isOpen, onClose, onUpdateItemStatus, onCreateShipment, onOpenShipment }) {
  const [tracking, setTracking] = useState({})
  // productId of the line the seller is rejecting, and the reason they type.
  // Rejection is deliberately two steps: it costs the buyer their order, and a
  // one-click "cancel" next to "start processing" is too easy to hit by
  // accident.
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  // Hooks must run unconditionally, so these are called before the early
  // return below; both are disabled when there is no order.
  const account = useShippingIntegrationController()
  const orderShipments = useOrderShipmentsController(order?.orderId || order?.id)

  if (!order) return null

  async function handleReject(item) {
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('Reason required', 'The buyer is told why their item was cancelled.')
      return
    }

    try {
      await onUpdateItemStatus(order.orderId, item.productId, { status: 'CANCELLED', reason })
      toast.success('Item cancelled', 'The buyer has been notified and the stock returned.')
      setRejecting(null)
      setRejectReason('')
    } catch (err) {
      toast.error('Could not cancel item', err?.response?.data?.message || 'Something went wrong')
    }
  }

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
              <MoneyCell amount={order.itemsValue} compact className="text-success-600 text-lg font-bold" />
            </div>
          </div>
        </div>

        <CourierSection
          account={account}
          orderShipments={orderShipments}
          onCreateShipment={onCreateShipment ? () => onCreateShipment(order) : null}
          onOpenShipment={onOpenShipment}
        />

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

              {/* Already rejected — show why, so the seller and support can
                  see what was told to the buyer. */}
              {item.status === 'CANCELLED' && item.rejectionReason && (
                <p className="rounded-md border border-danger-200 bg-danger-50 px-2.5 py-1.5 text-2xs text-danger-700">
                  <span className="font-semibold">Cancelled: </span>
                  {item.rejectionReason}
                </p>
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

                  {/* Rejecting is only possible before the parcel moves —
                      mirrors VALID_FROM_STATUSES on the server. */}
                  {['PENDING', 'PROCESSING'].includes(item.status) && rejecting !== item.productId && (
                    <Button
                      size="xs"
                      variant="dangerOutline"
                      onClick={() => {
                        setRejecting(item.productId)
                        setRejectReason('')
                      }}
                    >
                      Cannot fulfil
                    </Button>
                  )}
                </div>
              )}

              {rejecting === item.productId && (
                <div className="flex flex-col gap-2 rounded-md border border-danger-200 bg-danger-50 p-2.5">
                  <Textarea
                    id={`reject-reason-${item.productId}`}
                    label="Why can you not fulfil this?"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. damaged in storage, supplier out of stock"
                    description="The buyer is shown this. Stock is returned automatically."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button size="xs" variant="quiet" onClick={() => setRejecting(null)}>
                      Keep item
                    </Button>
                    <Button size="xs" variant="danger" onClick={() => handleReject(item)}>
                      Cancel this item
                    </Button>
                  </div>
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

// Booking with a courier, alongside the manual tracking-number path below.
//
// The manual path is deliberately NOT removed: a seller with no courier
// account connected, or one shipping through a channel we do not integrate
// with, still needs to record an AWB by hand. This section is the better path
// when it is available, not the only one.
function CourierSection({ account, orderShipments, onCreateShipment, onOpenShipment }) {
  const canBook = ['SELLER', 'PLATFORM'].includes(account.effectiveAccount) && !account.isUnhealthy

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Courier</h3>
        {canBook && onCreateShipment && (
          <Button size="xs" onClick={onCreateShipment}>
            {orderShipments.hasShipments ? 'Book another parcel' : 'Create shipment'}
          </Button>
        )}
      </div>

      {orderShipments.hasShipments ? (
        <div className="flex flex-col gap-2">
          {orderShipments.shipments.map((shipment) => {
            const presentation = shipmentStatusPresentation(shipment.status)
            return (
              <button
                key={shipment.id}
                type="button"
                onClick={() => onOpenShipment?.(shipment.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left text-xs transition-colors hover:bg-surface-muted"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono font-semibold text-slate-900">{shipment.id.slice(-8).toUpperCase()}</span>
                  <span className="text-2xs text-ink-subtle">
                    {shipment.awbCode ? `${shipment.courierName || 'Courier'} · ${shipment.awbCode}` : 'No AWB yet'}
                  </span>
                </div>
                <Badge tone={presentation.tone} size="sm" dot>
                  {presentation.label}
                </Badge>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-2xs text-ink-subtle">
          {canBook
            ? 'No parcel booked yet. Create a shipment to get an AWB and tracking automatically, or enter a tracking number by hand below.'
            : 'No courier account is available, so parcels cannot be booked automatically. Enter a tracking number by hand below.'}
        </p>
      )}
    </div>
  )
}
