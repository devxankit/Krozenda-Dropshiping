import { View, Pressable, Linking, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, enterFade } from '../../../../components/ui/motion'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { toast } from '../../../../lib/toast'
import { colors, shadows } from '../../../../theme'
import { useOrderController, useOrderTrackingController } from '../../controllers/useOrdersController'

const FLOW = [
  { status: 'PENDING', title: 'Order Confirmed' },
  { status: 'PROCESSING', title: 'Processing' },
  { status: 'SHIPPED', title: 'Shipped' },
  { status: 'DELIVERED', title: 'Delivered' },
]

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TrackShipmentScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams()
  const { order, isLoading, isError, error, refetch } = useOrderController(orderId)
  // Loaded separately: an order exists for a while before any parcel does, and a failure to load
  // tracking must not hide the order itself.
  const { parcels, hasShipments } = useOrderTrackingController(orderId)

  const onBack = () => (router.canGoBack() ? router.back() : router.replace(USER_ROUTES.DASHBOARD))
  const onViewDetails = (o) => router.push(userPath.order(o.id))

  const header = (
    <View style={styles.headerBar}>
      <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
        <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
      </Pressable>
      <Text style={styles.headerTitle}>Track Shipment</Text>
    </View>
  )

  if (isLoading) {
    return (
      <Screen nav activeTab="orders" contentStyle={{ padding: 24, gap: 12 }}>
        <Skeleton style={{ height: 96, borderRadius: 24, backgroundColor: colors.slate[200] }} />
        <Skeleton style={{ height: 256, borderRadius: 24, backgroundColor: colors.slate[200] }} />
      </Screen>
    )
  }

  // "Loading" and "this failed" are different screens.
  if (isError || !order) {
    return (
      <Screen nav activeTab="orders" contentStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 }}>
        <ErrorState
          error={error}
          title={error?.status === 404 ? 'Order not found' : undefined}
          description={error?.status === 404 ? 'This order does not exist, or it is not yours.' : undefined}
          onRetry={error?.status === 404 ? undefined : refetch}
          style={{ width: '100%', maxWidth: 448 }}
        />
        <Pressable onPress={() => router.navigate(USER_ROUTES.ORDERS)}>
          <Text style={styles.backLink}>Back to my orders</Text>
        </Pressable>
      </Screen>
    )
  }

  const historyByStatus = new Map(order.statusHistory.map((entry) => [entry.status, entry.at]))
  const currentIndex = FLOW.findIndex((step) => step.status === order.status)
  const cancelled = order.status === 'CANCELLED'

  return (
    <Screen nav activeTab="orders" header={header} contentStyle={styles.content}>
      <View style={styles.orderCard}>
        <View style={styles.orderCardTop}>
          <Text noTranslate style={styles.orderNo}>{`Order #${order.id.slice(-8).toUpperCase()}`}</Text>
          <View style={[styles.statusPill, { backgroundColor: cancelled ? colors.red[100] : colors.blue[100] }]}>
            <Text noTranslate style={[styles.statusPillText, { color: cancelled ? colors.red[700] : colors.blue[700] }]}>
              {order.status}
            </Text>
          </View>
        </View>
        <Text noTranslate style={styles.orderMeta}>
          {`${order.items.length} item(s) · ₹${order.total.toLocaleString('en-IN')}`}
        </Text>
      </View>

      {/* Real courier scans, when there are any. The order-level flow below stays for the window
          before a parcel exists, and for sellers shipping by hand. */}
      {hasShipments
        ? parcels.map((parcel, index) => <ParcelCard key={parcel.id} parcel={parcel} index={index} total={parcels.length} />)
        : null}

      {cancelled ? (
        <View style={styles.cancelCard}>
          <Icon name="HiXCircle" size={32} color={colors.red[500]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cancelTitle}>This order was cancelled</Text>
            <Text noTranslate style={styles.cancelSub}>
              {`Cancelled on ${formatTime(historyByStatus.get('CANCELLED') || order.createdAt)}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SHIPMENT STATUS</Text>

          <View style={styles.timeline}>
            <View style={styles.timelineLine} />

            {FLOW.map((step, idx) => {
              const at = historyByStatus.get(step.status)
              const isCompleted = currentIndex > idx || (currentIndex === idx && step.status === 'DELIVERED')
              const isActive = currentIndex === idx && step.status !== 'DELIVERED'

              return (
                <Animated.View key={step.status} entering={enterFade(idx)} style={styles.stepRow}>
                  <View style={styles.dotSlot}>
                    {isCompleted ? (
                      <View style={[styles.dot, { backgroundColor: colors.emerald[500], ...shadows.xs }]}>
                        <Icon name="HiCheck" size={14} color="#fff" />
                      </View>
                    ) : isActive ? (
                      <View style={[styles.dot, styles.dotActive]}>
                        <Icon name="HiTruck" size={12} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.dot, styles.dotIdle]} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: isCompleted || isActive ? colors.slate[900] : colors.slate[400] }]}>
                      {step.title}
                    </Text>
                    <Text noTranslate={!!at} style={styles.stepTime}>
                      {at ? formatTime(at) : 'Pending'}
                    </Text>
                  </View>
                </Animated.View>
              )
            })}
          </View>
        </View>
      )}

      <Pressable onPress={() => onViewDetails(order)} style={styles.detailsBtn}>
        <Text style={styles.detailsBtnText}>View Order Details</Text>
      </Pressable>
    </Screen>
  )
}

// One parcel, with the courier's own scans. A multi-vendor order arrives in pieces, so each parcel
// is its own card with its own progress.
function ParcelCard({ parcel, index, total }) {
  const isDelivered = parcel.status === 'DELIVERED'
  const isCancelled = parcel.status === 'CANCELLED'
  const pill = isDelivered
    ? { bg: colors.emerald[100], fg: colors.emerald[700] }
    : isCancelled
      ? { bg: colors.red[100], fg: colors.red[700] }
      : { bg: colors.blue[100], fg: colors.blue[700] }

  const openTracking = async () => {
    try {
      await Linking.openURL(parcel.trackingUrl)
    } catch {
      toast.error('Could not open the courier site')
    }
  }

  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View style={styles.parcelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{total > 1 ? `PARCEL ${index + 1} OF ${total}` : 'YOUR PARCEL'}</Text>
          <Text noTranslate style={styles.parcelItems}>
            {parcel.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text noTranslate style={[styles.statusPillText, { color: pill.fg }]}>
            {parcel.status}
          </Text>
        </View>
      </View>

      {parcel.awbCode ? (
        <View style={styles.awbRow}>
          <Text noTranslate style={styles.courier}>
            {parcel.courierName || 'Courier'}
          </Text>
          <Text noTranslate style={styles.awb}>
            {parcel.awbCode}
          </Text>
          {parcel.trackingUrl ? (
            <Pressable onPress={openTracking}>
              <Text style={styles.trackLink}>Track on courier site</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {parcel.estimatedDeliveryAt && !isDelivered ? (
        <Text noTranslate style={styles.expected}>{`Expected by ${formatTime(parcel.estimatedDeliveryAt)}`}</Text>
      ) : null}

      {parcel.events.length === 0 ? (
        <Text style={styles.noEvents}>No courier updates yet. The first one usually appears once the parcel is collected.</Text>
      ) : (
        <View style={[styles.timeline, { paddingTop: 4, gap: 16 }]}>
          <View style={styles.timelineLine} />
          {/* Newest first: where the parcel is now is what a buyer opened this screen to find out. */}
          {[...parcel.events].reverse().map((event, idx) => (
            <Animated.View key={`${event.occurredAt}-${idx}`} entering={enterFade(idx)} style={styles.stepRow}>
              <View style={styles.dotSlot}>
                <View style={[styles.dot, idx === 0 ? styles.dotActive : styles.dotIdle]}>
                  {idx === 0 ? <Icon name="HiTruck" size={12} color="#fff" /> : null}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                {/* The courier's own wording — it is what a buyer recognises from their SMS. */}
                <Text noTranslate style={[styles.stepTitle, { color: idx === 0 ? colors.slate[900] : colors.slate[600] }]}>
                  {event.carrierStatus}
                </Text>
                <Text noTranslate style={styles.stepTime}>
                  {formatTime(event.occurredAt)}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.xs,
  },
  backBtn: { padding: 6, borderRadius: 9999 },
  headerTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  backLink: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
  content: { padding: 16, gap: 16 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    gap: 8,
    ...shadows.xs,
  },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNo: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  orderMeta: { paddingTop: 4, fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  statusPill: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2 },
  statusPillText: { fontSize: 10, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    gap: 16,
    ...shadows.xs,
  },
  cardTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900], letterSpacing: 0.6 },
  cancelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[100],
    borderRadius: 16,
    padding: 20,
  },
  cancelTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.red[800] },
  cancelSub: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.red[600] },
  timeline: { paddingLeft: 24, gap: 24 },
  timelineLine: { position: 'absolute', top: 8, bottom: 8, left: 9, width: 2, backgroundColor: colors.slate[200] },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dotSlot: { position: 'absolute', left: -24, top: 2 },
  dot: { width: 20, height: 20, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  dotActive: {
    backgroundColor: colors.emerald[600],
    borderWidth: 4,
    borderColor: colors.emerald[100],
    width: 28,
    height: 28,
    marginLeft: -4,
    marginTop: -4,
    ...shadows.xs,
  },
  dotIdle: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.slate[300] },
  stepTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  stepTime: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.slate[500] },
  parcelTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  parcelItems: { marginTop: 2, fontSize: 11, lineHeight: 16.5, color: colors.slate[600] },
  awbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: 8,
  },
  courier: { fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.slate[900] },
  awb: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },
  trackLink: { fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.blue[600] },
  expected: { fontSize: 11, lineHeight: 16.5, color: colors.slate[600] },
  noEvents: { fontSize: 11, lineHeight: 16.5, color: colors.slate[500] },
  detailsBtn: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.blue[600],
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.xs,
  },
  detailsBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
})
