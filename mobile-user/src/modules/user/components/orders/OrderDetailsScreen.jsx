import { useState } from 'react'
import { Alert, View, Pressable, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { toast } from '../../../../lib/toast'
import { colors, shadows } from '../../../../theme'
import { useCancelOrderController, useOrderController } from '../../controllers/useOrdersController'
import { reorderOrder } from '../../services/orderService'

const STATUS_META = {
  PENDING: { label: 'Pending', bg: colors.slate[100], fg: colors.slate[700], border: colors.slate[200] },
  PROCESSING: { label: 'Processing', bg: colors.amber[100], fg: colors.amber[800], border: colors.amber[200] },
  SHIPPED: { label: 'Shipped', bg: colors.blue[100], fg: colors.blue[800], border: colors.blue[200] },
  DELIVERED: { label: 'Delivered', bg: colors.emerald[100], fg: colors.emerald[800], border: colors.emerald[200] },
  CANCELLED: { label: 'Cancelled', bg: colors.red[100], fg: colors.red[800], border: colors.red[200] },
}

const PAYMENT_METHOD_LABEL = { COD: 'Cash on Delivery', WALLET: 'Krozenda Wallet', RAZORPAY: 'Online (Razorpay)' }

export function OrderDetailsScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams()
  const { order, isLoading, isError, error, refetch } = useOrderController(orderId)
  const { cancelOrder, isCancelling } = useCancelOrderController(orderId)
  const [reordering, setReordering] = useState(false)
  const [reorderMessage, setReorderMessage] = useState(null)

  const onBack = () => router.navigate(USER_ROUTES.ORDERS)
  const onDownloadInvoice = (o) => router.push(userPath.orderInvoice(o.id))
  const onTrackShipment = (o) => router.push(userPath.orderTrack(o.id))
  const onRequestReturn = (o) => router.push(`${USER_ROUTES.RETURNS}?orderId=${(o || order)?.id}`)

  const handleReorder = async () => {
    if (!order) return
    try {
      setReordering(true)
      setReorderMessage(null)
      const res = await reorderOrder(order.id)
      await useCartStore.getState().hydrate()
      if (res.data?.addedCount > 0) {
        toast.success('Items Added to Cart', `${res.data.addedCount} item(s) from this order added to your cart.`)
        router.push(USER_ROUTES.CART)
      } else {
        const msg = res.message || 'Items from this order are currently out of stock'
        setReorderMessage(msg)
        toast.warning('Reorder Unavailable', msg)
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not reorder items from this order'
      setReorderMessage(msg)
      toast.error('Reorder Failed', err)
    } finally {
      setReordering(false)
    }
  }

  const handleCancel = () => {
    const fee = order.cancellationFeePercent
    Alert.alert(
      'Cancel this order?',
      fee > 0 ? `A ${fee}% cancellation fee will be kept and the rest refunded to your wallet.` : 'This will cancel your order.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await cancelOrder()
              const kept = res?.data?.cancellationFee
              toast.success(
                'Order cancelled',
                kept > 0 ? `₹${res.data.refunded} refunded, ₹${kept} cancellation fee kept.` : 'Your order has been cancelled.',
              )
            } catch (err) {
              toast.error('Could not cancel', err)
            }
          },
        },
      ],
    )
  }

  if (isLoading) {
    return (
      <Screen nav contentStyle={{ padding: 24, gap: 12 }}>
        <Skeleton style={{ height: 112, borderRadius: 24, backgroundColor: colors.slate[200] }} />
        <Skeleton style={{ height: 192, borderRadius: 24, backgroundColor: colors.slate[200] }} />
        <Skeleton style={{ height: 128, borderRadius: 24, backgroundColor: colors.slate[200] }} />
      </Screen>
    )
  }

  // "Order not found" and "the request failed" are different situations.
  if (isError || !order) {
    const notFound = error?.status === 404
    return (
      <Screen nav contentStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <ErrorState
          error={error}
          title={notFound ? 'Order not found' : undefined}
          description={notFound ? 'This order does not exist, or it is not yours.' : undefined}
          onRetry={notFound ? undefined : refetch}
          style={{ width: '100%', maxWidth: 448 }}
        />
        <Pressable onPress={onBack}>
          <Text style={styles.backLink}>Back to my orders</Text>
        </Pressable>
      </Screen>
    )
  }

  const meta = STATUS_META[order.status] || STATUS_META.PENDING
  const address = order.shippingAddress
  const payStatusColor =
    order.paymentStatus === 'PAID' ? colors.emerald[600] : order.paymentStatus === 'FAILED' ? colors.red[600] : colors.amber[600]
  const payStatusLabel =
    order.paymentStatus === 'PAID'
      ? 'Paid'
      : order.paymentStatus === 'FAILED'
        ? 'Failed'
        : order.paymentMethod === 'COD'
          ? 'Pay on Delivery'
          : 'Pending'

  return (
    <Screen nav contentStyle={styles.content}>
      <View style={styles.stack}>
        {/* Header bar */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
              <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
            </Pressable>
            <View style={{ flexShrink: 1 }}>
              <View style={styles.titleRow}>
                <Text noTranslate numberOfLines={1} style={styles.title}>
                  {`Order #${order.id.slice(-8).toUpperCase()}`}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label.toUpperCase()}</Text>
                </View>
              </View>
              <Text noTranslate style={styles.placedOn}>
                {`Placed on ${new Date(order.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <Pressable
              onPress={handleReorder}
              disabled={reordering}
              style={[styles.hBtn, { backgroundColor: colors.emerald[600], opacity: reordering ? 0.5 : 1 }]}
            >
              <Icon name="HiShoppingCart" size={16} color="#fff" />
              <Text style={styles.hBtnTextLight}>{reordering ? 'Adding to Cart…' : 'Reorder Items'}</Text>
            </Pressable>

            {order.canCancel ? (
              <Pressable
                onPress={handleCancel}
                disabled={isCancelling}
                style={[styles.hBtn, { backgroundColor: colors.red[50], borderWidth: 1, borderColor: colors.red[200], opacity: isCancelling ? 0.5 : 1 }]}
              >
                <Text style={[styles.hBtnTextDark, { color: colors.red[700] }]}>{isCancelling ? 'Cancelling…' : 'Cancel Order'}</Text>
              </Pressable>
            ) : null}

            {order.status !== 'CANCELLED' ? (
              <Pressable onPress={() => onTrackShipment(order)} style={[styles.hBtn, { backgroundColor: colors.blue[600] }]}>
                <Icon name="HiTruck" size={16} color="#fff" />
                <Text style={styles.hBtnTextLight}>Track Package</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={() => onDownloadInvoice(order)} style={[styles.hBtn, styles.hBtnLight]}>
              <Icon name="HiArrowDownTray" size={16} color={colors.slate[800]} />
              <Text style={styles.hBtnTextDark}>Invoice</Text>
            </Pressable>

            {/* Server decides: delivered, in the return window, not dropship, and a returnable line. */}
            {order.canReturn ? (
              <Pressable onPress={() => onRequestReturn(order)} style={[styles.hBtn, styles.hBtnLight]}>
                <Icon name="HiArrowPath" size={16} color={colors.slate[800]} />
                <Text style={styles.hBtnTextDark}>Return</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {order.isDropship ? (
          <View style={styles.dropNote}>
            <Text style={styles.dropNoteText}>
              <Text style={{ fontWeight: '700', fontSize: 12, lineHeight: 16, color: colors.blue[900] }}>Dropshipping order.</Text> It ships
              directly from our supplier and cannot be cancelled, returned or replaced.
              {order.status === 'CANCELLED' && order.paymentStatus === 'REFUNDED'
                ? ' It was cancelled and the amount refunded to your original payment method.'
                : ''}
            </Text>
          </View>
        ) : null}

        {reorderMessage ? (
          <View style={styles.reorderMsg}>
            <Text style={styles.reorderMsgText}>{reorderMessage}</Text>
            <Pressable onPress={() => setReorderMessage(null)}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Purchased items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{`Purchased Items (${order.items.length})`}</Text>
          <View>
            {order.items.map((item, idx) => (
              <View key={idx} style={[styles.itemRow, idx > 0 && styles.itemDivider]}>
                <View style={styles.itemLeft}>
                  <View style={styles.imgBox}>
                    <SmartImage src={item.image} alt={item.name} ratio="1 / 1" style={{ width: '100%', height: '100%' }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text noTranslate style={styles.itemQty}>{`Quantity: ${item.quantity}`}</Text>
                  </View>
                </View>
                <Text noTranslate style={styles.itemPrice}>
                  {`₹${(item.price * item.quantity).toLocaleString('en-IN')}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {order.status === 'DELIVERED' && order.deliveredAt ? (
          <View style={styles.deliveredBanner}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="deliveredGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.emerald[800]} />
                  <Stop offset="1" stopColor={colors.emerald[900]} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#deliveredGrad)" />
            </Svg>
            <Text style={styles.deliveredLabel}>DELIVERED</Text>
            <Text noTranslate style={styles.deliveredTitle}>
              {`Delivered on ${new Date(order.deliveredAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`}
            </Text>
          </View>
        ) : null}

        {order.b2b?.isB2B ? (
          <View style={[styles.card, { borderColor: 'rgba(191,219,254,0.9)', gap: 12 }]}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadLeft}>
                <Icon name="HiBuildingOffice2" size={16} color={colors.blue[700]} />
                <Text style={styles.cardHeadText}>B2B Tax Invoice</Text>
              </View>
              <View style={styles.itcBadge}>
                <Text style={styles.itcBadgeText}>ITC Eligible</Text>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text noTranslate style={styles.b2bName}>
                {order.b2b.companyName || address.fullName}
              </Text>
              <Text style={styles.b2bGstin}>
                Buyer GSTIN:{' '}
                <Text noTranslate style={{ fontWeight: '700', fontSize: 11, color: colors.blue[700] }}>
                  {order.b2b.gstin}
                </Text>
              </Text>
              <Text style={styles.b2bNote}>
                Input Tax Credit (ITC) has been claimed for this transaction under GST regulations.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { gap: 16 }]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Icon name="HiMapPin" size={16} color={colors.blue[700]} />
              <Text style={styles.cardHeadText}>Shipping Address</Text>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text noTranslate style={styles.addrName}>
              {address.fullName}
            </Text>
            <Text noTranslate style={styles.addrLine}>
              {`${[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - ${address.pincode}`}
            </Text>
            <Text noTranslate style={styles.addrPhone}>
              {address.phone}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { gap: 16 }]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Icon name="HiCreditCard" size={16} color={colors.blue[700]} />
              <Text style={styles.cardHeadText}>Payment Details</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Payment Mode</Text>
              <Text style={styles.payStrong}>{PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}</Text>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Items Subtotal</Text>
              <Text noTranslate style={styles.payValue}>{`₹${order.subtotal.toLocaleString('en-IN')}`}</Text>
            </View>
            {order.discountAmount > 0 ? (
              <View style={styles.payRow}>
                <Text noTranslate style={styles.discountText}>{`Discount ${order.couponCode ? `(${order.couponCode})` : ''}`}</Text>
                <Text noTranslate style={styles.discountText}>{`- ₹${order.discountAmount.toLocaleString('en-IN')}`}</Text>
              </View>
            ) : null}
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Shipping Fee</Text>
              <Text style={styles.payValue}>
                {order.shippingFee > 0 ? `₹${order.shippingFee.toLocaleString('en-IN')}` : 'FREE'}
              </Text>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Status</Text>
              <Text style={[styles.payStatus, { color: payStatusColor }]}>{payStatusLabel}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text noTranslate style={styles.totalValue}>{`₹${order.total.toLocaleString('en-IN')}`}</Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  stack: { gap: 24 },
  backLink: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
  headerCard: {
    gap: 16,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    ...shadows.xs,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, borderRadius: 9999 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900], flexShrink: 1 },
  statusPill: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
  statusText: { fontSize: 10, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5 },
  placedOn: { marginTop: 2, fontSize: 11, lineHeight: 16.5, color: colors.slate[500] },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  hBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows.xs,
  },
  hBtnLight: { backgroundColor: colors.slate[100], borderWidth: 1, borderColor: colors.slate[200] },
  hBtnTextLight: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  hBtnTextDark: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },
  dropNote: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.xs,
  },
  dropNoteText: { fontSize: 12, lineHeight: 16, color: colors.blue[900] },
  reorderMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.xs,
  },
  reorderMsgText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.amber[800] },
  dismissText: { marginLeft: 12, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.amber[900] },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 20,
    gap: 16,
    ...shadows.xs,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.slate[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 12,
  },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeadText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[700] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 16 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  imgBox: {
    width: 56,
    height: 56,
    backgroundColor: colors.slate[50],
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  itemQty: { marginTop: 2, fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.slate[400] },
  itemPrice: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  deliveredBanner: { borderRadius: 24, padding: 20, overflow: 'hidden', ...shadows.md },
  deliveredLabel: { fontSize: 10, lineHeight: 15, fontWeight: '800', color: colors.emerald[200], letterSpacing: 1.5 },
  deliveredTitle: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: '#fff' },
  itcBadge: { backgroundColor: colors.emerald[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  itcBadgeText: { fontSize: 10, fontWeight: '800', color: colors.emerald[800] },
  b2bName: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  b2bGstin: { fontSize: 11, lineHeight: 16.5, fontWeight: '500', color: colors.slate[700] },
  b2bNote: { fontSize: 10, lineHeight: 15, color: colors.slate[500], paddingTop: 4 },
  addrName: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  addrLine: { fontSize: 12, lineHeight: 19.5, color: colors.slate[600] },
  addrPhone: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[800], paddingTop: 4 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  payLabel: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  payStrong: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  payValue: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  payStatus: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  discountText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.emerald[600] },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  totalLabel: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  totalValue: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.blue[700] },
})
