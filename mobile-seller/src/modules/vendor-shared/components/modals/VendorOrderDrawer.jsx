import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Drawer } from '../../../../components/admin/overlay'
import { Badge, Button, Input, Text, Textarea } from '../../../../components/ui'
import { MoneyCell, StatusPill } from '../../../../components/admin/display/cells'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'
import { toast } from '../../../../lib/toast'
import { useOrderShipmentsController, useShippingIntegrationController } from '../../controllers/useShippingController'
import { shipmentStatusPresentation } from '../../../../lib/shipping/presentation'
import { colors, fontFamilyFor, radius } from '../../../../theme'

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
  const [busyItem, setBusyItem] = useState(null)
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

    setBusyItem(item.productId)
    try {
      await onUpdateItemStatus(order.orderId, item.productId, { status: 'CANCELLED', reason })
      toast.success('Item cancelled', 'The buyer has been notified and the stock returned.')
      setRejecting(null)
      setRejectReason('')
    } catch (err) {
      toast.error('Could not cancel item', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setBusyItem(null)
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

    setBusyItem(item.productId)
    try {
      await onUpdateItemStatus(order.orderId, item.productId, payload)
      toast.success('Item updated', `"${item.name}" is now ${nextStatus.toLowerCase()}.`)
    } catch (err) {
      toast.error('Could not update item', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setBusyItem(null)
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${order.id.slice(-8).toUpperCase()}`}
      description={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')}`}
      width="lg"
    >
      <View style={styles.body}>
        <View style={styles.summary}>
          <View>
            <Text style={styles.eyebrow}>Status</Text>
            <View style={{ marginTop: 4 }}>
              <StatusPill status={order.status} tones={VENDOR_ORDER_STATUS_TONE} size="md" />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.eyebrow}>Your Items Value</Text>
            <View style={{ marginTop: 4 }}>
              <MoneyCell amount={order.itemsValue} compact style={{ color: colors.success[600], fontSize: 16, lineHeight: 24, fontWeight: '700' }} />
            </View>
          </View>
        </View>

        <CourierSection
          account={account}
          orderShipments={orderShipments}
          onCreateShipment={onCreateShipment ? () => onCreateShipment(order) : null}
          onOpenShipment={onOpenShipment}
        />

        <View style={{ gap: 8 }}>
          <Text style={styles.heading}>Your Items</Text>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.itemCard}>
              <View style={styles.rowBetween}>
                <Text style={[styles.itemName, { flex: 1 }]}>
                  {item.name}
                  {item.variant ? ` · ${item.variant}` : ''}
                </Text>
                <Text noTranslate style={styles.itemName}>
                  Qty: {item.quantity}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <MoneyCell amount={item.price} compact muted style={{ fontWeight: '400', fontSize: 12, lineHeight: 16 }} />
                <StatusPill status={item.status} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />
              </View>

              {item.trackingNumber ? (
                <View style={{ alignItems: 'flex-start' }}>
                  <Badge tone="success" size="sm">
                    {`${item.courierName ? `${item.courierName} · ` : ''}AWB ${item.trackingNumber}`}
                  </Badge>
                </View>
              ) : null}

              {/* Already rejected - show why, so the seller and support can
                  see what was told to the buyer. */}
              {item.status === 'CANCELLED' && item.rejectionReason ? (
                <View style={styles.rejectedBox}>
                  <Text style={styles.rejectedText}>
                    <Text style={[styles.rejectedText, { fontWeight: '600' }]}>Cancelled: </Text>
                    {item.rejectionReason}
                  </Text>
                </View>
              ) : null}

              {NEXT_STATUS[item.status] ? (
                <View style={{ gap: 8, paddingTop: 4 }}>
                  {NEXT_STATUS[item.status] === 'SHIPPED' ? (
                    <>
                      <Input
                        label="Tracking number"
                        placeholder="AWB / tracking ID"
                        autoCapitalize="characters"
                        autoCorrect={false}
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
                  ) : null}
                  <View style={styles.actionRow}>
                    <Button size="xs" onPress={() => handleAdvance(item)} isLoading={busyItem === item.productId && rejecting !== item.productId}>
                      {NEXT_LABEL[NEXT_STATUS[item.status]]}
                    </Button>

                    {/* Rejecting is only possible before the parcel moves -
                        mirrors VALID_FROM_STATUSES on the server. */}
                    {['PENDING', 'PROCESSING'].includes(item.status) && rejecting !== item.productId ? (
                      <Button
                        size="xs"
                        variant="dangerOutline"
                        onPress={() => {
                          setRejecting(item.productId)
                          setRejectReason('')
                        }}
                      >
                        Cannot fulfil
                      </Button>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {rejecting === item.productId ? (
                <View style={styles.rejectForm}>
                  <Textarea
                    label="Why can you not fulfil this?"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. damaged in storage, supplier out of stock"
                    description="The buyer is shown this. Stock is returned automatically."
                  />
                  <View style={[styles.actionRow, { justifyContent: 'flex-end' }]}>
                    <Button size="xs" variant="quiet" onPress={() => setRejecting(null)}>
                      Keep item
                    </Button>
                    <Button size="xs" variant="danger" onPress={() => handleReject(item)} isLoading={busyItem === item.productId}>
                      Cancel this item
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.heading}>Delivery Address</Text>
          <View style={[styles.itemCard, { gap: 4 }]}>
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] }}>
              {order.shippingAddress?.fullName}
            </Text>
            <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>
              {order.shippingAddress?.phone}
            </Text>
            <Text noTranslate style={{ marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
              {order.shippingAddress?.line1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
            </Text>
          </View>
        </View>
      </View>
    </Drawer>
  )
}

// Booking with a courier, alongside the manual tracking-number path below.
//
// The manual path is deliberately NOT removed: a seller with no courier
// account connected, or one shipping through a channel we do not integrate
// with, still needs to record an AWB by hand.
function CourierSection({ account, orderShipments, onCreateShipment, onOpenShipment }) {
  const canBook = ['SELLER', 'PLATFORM'].includes(account.effectiveAccount) && !account.isUnhealthy

  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.rowBetween, { gap: 12 }]}>
        <Text style={styles.heading}>Courier</Text>
        {canBook && onCreateShipment ? (
          <Button size="xs" onPress={onCreateShipment}>
            {orderShipments.hasShipments ? 'Book another parcel' : 'Create shipment'}
          </Button>
        ) : null}
      </View>

      {orderShipments.hasShipments ? (
        <View style={{ gap: 8 }}>
          {orderShipments.shipments.map((shipment) => {
            const presentation = shipmentStatusPresentation(shipment.status)
            return (
              <Pressable
                key={shipment.id}
                onPress={() => onOpenShipment?.(shipment.id)}
                style={({ pressed }) => [styles.shipmentRow, pressed && { backgroundColor: colors.surface.muted }]}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text noTranslate style={styles.mono}>
                    {shipment.id.slice(-8).toUpperCase()}
                  </Text>
                  <Text noTranslate={Boolean(shipment.awbCode)} style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
                    {shipment.awbCode ? `${shipment.courierName || 'Courier'} · ${shipment.awbCode}` : 'No AWB yet'}
                  </Text>
                </View>
                <Badge tone={presentation.tone} size="sm" dot>
                  {presentation.label}
                </Badge>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <View style={styles.dashedNote}>
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
            {canBook
              ? 'No parcel booked yet. Create a shipment to get an AWB and tracking automatically, or enter a tracking number by hand below.'
              : 'No courier account is available, so parcels cannot be booked automatically. Enter a tracking number by hand below.'}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: 14, padding: 14 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.surface.muted,
    padding: 12,
  },
  eyebrow: { fontSize: 10, lineHeight: 15, fontWeight: '600', textTransform: 'uppercase', color: colors.ink.faint },
  heading: { fontSize: 12, lineHeight: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.slate[900] },
  itemCard: {
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rejectedBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger[200],
    backgroundColor: colors.danger[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rejectedText: { fontSize: 11, lineHeight: 16, color: colors.danger[700] },
  rejectForm: {
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger[200],
    backgroundColor: colors.danger[50],
    padding: 10,
  },
  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: 12,
  },
  mono: { fontFamily: fontFamilyFor('600'), fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  dashedNote: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.DEFAULT,
    padding: 12,
  },
})
