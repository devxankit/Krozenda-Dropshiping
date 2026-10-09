import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Animated, PressableScale, enterFade } from '../../../../components/ui/motion'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { colors, shadows } from '../../../../theme'
import { useOrdersController } from '../../controllers/useOrdersController'

const PAYMENT_STATUS_COPY = {
  PAID: { label: 'Paid', color: colors.emerald[700] },
  PENDING: { label: 'Payable on delivery', color: colors.amber[700] },
  FAILED: { label: 'Payment failed', color: colors.red[700] },
  REFUNDED: { label: 'Refunded', color: colors.slate[700] },
}

// Order-placed confirmation: the tick springs in over an expanding halo. UI-thread only, skipped for reduced motion.
function SuccessMark() {
  const reduce = useReducedMotion()
  const scale = useSharedValue(reduce ? 1 : 0.4)
  const halo = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    scale.value = withSequence(withTiming(1.08, { duration: 200 }), withSpring(1, { damping: 10, stiffness: 200 }))
    halo.value = withDelay(120, withTiming(1, { duration: 520 }))
  }, [reduce, scale, halo])
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const haloStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 0 : 0.35 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 0.5 }],
  }))
  return (
    <View style={styles.markWrap}>
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.checkCircle, markStyle]}>
        <Icon name="HiCheck" size={56} color="#fff" />
      </Animated.View>
    </View>
  )
}

export function OrderPlacedScreen() {
  const router = useRouter()

  // The web screen receives the freshly-created order through router state and falls back to the
  // buyer's most recent order. Nothing in the app navigates here with state, so the most recent
  // order is used (same fallback).
  const { orders } = useOrdersController({ page: 1, limit: 1 })
  const order = orders[0] ?? null

  const orderRef = order?.id ? `#${order.id.slice(-10).toUpperCase()}` : null
  const amount = order?.total ?? null
  const paymentStatus = order ? PAYMENT_STATUS_COPY[order.paymentStatus] : null

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.card}>
        <SuccessMark />

        <Animated.View entering={enterFade(1)} style={{ gap: 8, alignItems: 'center' }}>
          <View style={styles.confirmPill}>
            <Text style={styles.confirmPillText}>ORDER CONFIRMED</Text>
          </View>
          <Text style={styles.h1}>Order placed successfully</Text>
          <Text style={styles.lead}>
            Thank you for shopping with Krozenda. We are preparing your order for dispatch and will notify you at every
            step.
          </Text>
        </Animated.View>

        {order ? (
          <Animated.View entering={enterFade(2)} style={styles.dl}>
            <View style={styles.dlRow}>
              <Text style={styles.dt}>Order reference</Text>
              <Text noTranslate style={styles.refValue}>
                {orderRef}
              </Text>
            </View>
            <View style={styles.dlRow}>
              <Text style={styles.dt}>Order total</Text>
              <Text noTranslate style={styles.totalValue}>
                {`₹${(amount ?? 0).toLocaleString('en-IN')}`}
              </Text>
            </View>
            {paymentStatus ? (
              <View style={styles.dlRow}>
                <Text style={styles.dt}>Payment</Text>
                <Text style={[styles.payValue, { color: paymentStatus.color }]}>{paymentStatus.label}</Text>
              </View>
            ) : null}
            <View style={[styles.dlRow, styles.dlLast]}>
              <Text style={styles.dt}>Delivery</Text>
              <View style={styles.deliveryVal}>
                <Icon name="HiTruck" size={16} color={colors.slate[700]} />
                <Text style={styles.deliveryText}>Tracking appears once dispatched</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Text style={styles.noOrder}>
            Your order has been placed. Open <Text style={{ fontWeight: '700', fontSize: 12, color: colors.slate[500] }}>My Orders</Text> to see its
            details and track it.
          </Text>
        )}

        <View style={styles.actions}>
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push(order ? userPath.order(order.id) : USER_ROUTES.ORDERS)}
            style={[styles.primaryBtn, { backgroundColor: colors.blue[700] }]}
          >
            <Text style={styles.primaryBtnText}>{order ? 'View order details' : 'View my orders'}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.navigate(USER_ROUTES.DASHBOARD)}
            style={[styles.secondaryBtn, { backgroundColor: '#fff' }]}
          >
            <Text style={styles.secondaryBtnText}>Continue shopping</Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingVertical: 32, justifyContent: 'center' },
  card: {
    gap: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 32,
    ...shadows.xl,
  },
  markWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 9999, backgroundColor: colors.emerald[400] },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 9999,
    backgroundColor: colors.emerald[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xl,
  },
  confirmPill: { backgroundColor: colors.emerald[100], paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  confirmPillText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.emerald[800], letterSpacing: 0.6 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.slate[900], textAlign: 'center' },
  lead: { fontSize: 12, lineHeight: 19.5, color: colors.slate[500], textAlign: 'center', maxWidth: 448 },
  dl: {
    alignSelf: 'stretch',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.slate[50],
    padding: 20,
  },
  dlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dlLast: { borderTopWidth: 1, borderTopColor: colors.slate[200], paddingTop: 8 },
  dt: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  refValue: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  totalValue: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.blue[700] },
  payValue: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  deliveryVal: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  deliveryText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700], flexShrink: 1, textAlign: 'right' },
  noOrder: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
    padding: 20,
    fontSize: 12,
    lineHeight: 16,
    color: colors.slate[500],
  },
  actions: { alignSelf: 'stretch', gap: 12, paddingTop: 8 },
  primaryBtn: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, minHeight: 48, borderRadius: 16, ...shadows.md },
  primaryBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  secondaryBtn: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[300],
    ...shadows.sm,
  },
  secondaryBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },
})
