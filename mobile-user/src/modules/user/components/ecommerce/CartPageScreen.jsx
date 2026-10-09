import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NAV_HEIGHT, Screen } from '../../../../components/layout/Screen'
import { EmptyResult } from '../../../../components/ui/AsyncBoundary'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, PressableScale, enterFade, fadeOut, smoothLayout } from '../../../../components/ui/motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { lineKey, MAX_LINE_QUANTITY, useCartStore } from '../../../../lib/cartStore'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

// Availability, as the server reports it.
const AVAILABILITY_NOTE = {
  UNAVAILABLE: {
    tone: { backgroundColor: colors.red[50], color: colors.red[700], borderColor: colors.red[200] },
    message: 'No longer available — remove it to continue.',
    blocking: true,
  },
  OUT_OF_STOCK: {
    tone: { backgroundColor: colors.red[50], color: colors.red[700], borderColor: colors.red[200] },
    message: 'Out of stock — remove it to continue.',
    blocking: true,
  },
  INSUFFICIENT_STOCK: {
    tone: { backgroundColor: colors.amber[50], color: colors.amber[800], borderColor: colors.amber[200] },
    message: null, // filled in per line, it needs the number
    blocking: true,
  },
  LOW_STOCK: {
    tone: { backgroundColor: colors.amber[50], color: colors.amber[800], borderColor: colors.amber[200] },
    message: null,
    blocking: false,
  },
}

function formatPrice(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`
}

export function CartPageScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const cartItems = useCartStore((state) => state.items)
  const summary = useCartStore((state) => state.summary)
  const isSyncing = useCartStore((state) => state.isSyncing)
  const notice = useCartStore((state) => state.notice)
  const clearNotice = useCartStore((state) => state.clearNotice)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const hydrate = useCartStore((state) => state.hydrate)
  const [refreshing, setRefreshing] = useState(false)

  // Re-read on mount: prices, stock and availability may all have moved since the items went in,
  // and this is the last screen before the buyer commits to a total.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await hydrate()
    } finally {
      setRefreshing(false)
    }
  }

  // Totals come from the server when there is one (`summary`), and are only computed locally for
  // a signed-out cart.
  const subtotal = summary?.subtotal ?? cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const mrpTotal = summary?.mrpTotal ?? cartItems.reduce((s, i) => s + i.originalPrice * i.quantity, 0)
  const discount = Math.max(0, mrpTotal - subtotal)

  const blockingIssues = cartItems.filter((item) => AVAILABILITY_NOTE[item.availability]?.blocking)
  const unitCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const hasDropship = cartItems.some((item) => item.isDropship)
  const hasStandard = cartItems.some((item) => !item.isDropship)

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          hitSlop={4}
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.slate[100] }]}
        >
          <Icon name="HiArrowLeft" size={20} color={colors.slate[800]} />
        </Pressable>
        <Text noTranslate={unitCount > 0} style={styles.h1}>
          {unitCount > 0 ? `My Cart (${unitCount})` : 'My Cart'}
        </Text>
      </View>
      {isSyncing ? (
        <Text accessibilityRole="alert" style={styles.syncing}>
          Updating…
        </Text>
      ) : null}
    </View>
  )

  return (
    <Screen
      nav
      header={header}
      contentStyle={[styles.content, { paddingBottom: NAV_HEIGHT + insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Whatever the server had to adjust, said out loud rather than silently applied. */}
      {notice ? (
        <View style={styles.notice}>
          <Icon name="HiExclamationTriangle" size={16} color={colors.amber[800]} style={{ marginTop: 2 }} />
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={clearNotice} accessibilityLabel="Dismiss message">
            <Text style={styles.noticeDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Said here, before checkout, so the payment step holds no surprise. */}
      {hasDropship ? (
        <View style={styles.dropshipNote}>
          <Text style={styles.dropshipNoteText}>
            <Text style={{ fontWeight: '700', color: colors.blue[900] }}>Your cart has a dropshipping item.</Text>
            {' This order can only be paid online, and dropshipping items cannot be cancelled or returned.'}
            {hasStandard ? ' Your items will be placed as two separate orders, paid in one payment.' : ''}
          </Text>
        </View>
      ) : null}

      {cartItems.length === 0 ? (
        <EmptyResult
          icon={'🛒'}
          title="Your cart is empty"
          description="Browse the catalog and add something you like — it will show up here."
          action={
            <Pressable onPress={() => router.push(USER_ROUTES.LISTING)} style={styles.primarySmall}>
              <Text style={styles.primarySmallText}>Continue shopping</Text>
            </Pressable>
          }
        />
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {cartItems.map((item) => {
              const note = AVAILABILITY_NOTE[item.availability]
              const unavailable = item.availability === 'UNAVAILABLE' || item.availability === 'OUT_OF_STOCK'
              // Cap the stepper at real stock so "+" cannot climb past what exists.
              const maxQty = Math.min(item.stock ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY)

              // Keyed by LINE, not product: the same product can be in the cart as two variants.
              const key = lineKey(item.id, item.variantId)

              return (
                <Animated.View
                  key={key}
                  entering={enterFade(0)}
                  exiting={fadeOut}
                  layout={smoothLayout}
                  style={[styles.itemCard, shadows.sm, { borderColor: unavailable ? colors.red[200] : 'rgba(226,232,240,0.8)' }]}
                >
                  <View style={styles.itemRow}>
                    <Pressable onPress={() => router.push(userPath.product(item.id))} style={styles.itemLink}>
                      <View style={[styles.thumb, unavailable && { opacity: 0.5 }]}>
                        <SmartImage src={item.image} srcSet={item.imageSrcSet} displayWidth={80} alt={item.name} ratio="1 / 1" />
                      </View>

                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text noTranslate numberOfLines={2} style={styles.itemName}>
                          {item.name}
                        </Text>
                        {item.variant ? (
                          <Text noTranslate numberOfLines={1} style={styles.itemVariant}>
                            {item.variant}
                          </Text>
                        ) : null}
                        <View style={styles.priceRow}>
                          <Text noTranslate style={styles.itemPrice}>
                            {formatPrice(item.price * item.quantity)}
                          </Text>
                          {item.quantity > 1 ? (
                            <Text noTranslate style={styles.each}>{`${formatPrice(item.price)} each`}</Text>
                          ) : null}
                          {/* Says WHY the unit price is what it is. */}
                          {item.appliedTier ? (
                            <Text style={styles.bulk}>{`Bulk price (${item.appliedTier.minQty}+)`}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>

                    <View style={styles.controls}>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => updateQuantity(key, -1)}
                          disabled={unavailable}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease quantity of ${item.name}`}
                          style={[styles.stepBtn, unavailable && { opacity: 0.4 }]}
                        >
                          <Icon name="HiMinus" size={14} color={colors.slate[600]} />
                        </Pressable>
                        <Text noTranslate style={styles.qty} accessibilityLabel={`Quantity: ${item.quantity}`}>
                          {item.quantity}
                        </Text>
                        <Pressable
                          onPress={() => updateQuantity(key, 1)}
                          disabled={unavailable || item.quantity >= maxQty}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase quantity of ${item.name}`}
                          style={[styles.stepBtn, (unavailable || item.quantity >= maxQty) && { opacity: 0.4 }]}
                        >
                          <Icon name="HiPlus" size={14} color={colors.slate[600]} />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => {
                          removeItem(key)
                          toast.info(`Removed ${item.name} from cart`)
                        }}
                        accessibilityLabel={`Remove ${item.name} from cart`}
                        style={({ pressed }) => [styles.trash, pressed && { backgroundColor: colors.red[50] }]}
                      >
                        {({ pressed }) => (
                          <Icon name="HiTrash" size={16} color={pressed ? colors.red[500] : colors.slate[400]} />
                        )}
                      </Pressable>
                    </View>
                  </View>

                  {/* Below the seller's minimum: the cart holds it, but checkout will refuse. */}
                  {item.moq > 1 && item.quantity < item.moq ? (
                    <Text style={styles.moqNote}>
                      {`Minimum order is ${item.moq} - add ${item.moq - item.quantity} more to check out.`}
                    </Text>
                  ) : null}

                  {/* The next quantity break, when there is one. */}
                  {item.nextTier ? (
                    <Text style={styles.nextTier}>
                      {`Add ${item.nextTier.addMore} more to pay ${formatPrice(item.nextTier.price)} each.`}
                    </Text>
                  ) : null}

                  {/* Per-line status: availability first, then a price change */}
                  {note ? (
                    <Text
                      style={[
                        styles.availability,
                        { backgroundColor: note.tone.backgroundColor, borderColor: note.tone.borderColor, color: note.tone.color },
                      ]}
                    >
                      {item.availability === 'INSUFFICIENT_STOCK'
                        ? `Only ${item.stock} left — reduce the quantity to continue.`
                        : item.availability === 'LOW_STOCK'
                          ? `Only ${item.stock} left in stock.`
                          : note.message}
                    </Text>
                  ) : null}

                  {item.priceChanged ? (
                    <Text style={styles.priceChanged}>
                      {`Price changed from ${formatPrice(item.addedAtPrice)} since you added this.`}
                    </Text>
                  ) : null}
                </Animated.View>
              )
            })}
          </View>

          <View style={[styles.summary, shadows.sm]}>
            <Text style={styles.summaryTitle}>Price Details</Text>

            <View style={{ gap: 8 }}>
              <View style={styles.sumRow}>
                <View style={{ flexDirection: 'row', gap: 4, flexShrink: 1 }}>
                  <Text style={styles.sumLabel}>Total MRP</Text>
                  <Text style={[styles.sumLabel, { color: colors.slate[400] }]}>
                    {`(${unitCount} ${unitCount === 1 ? 'item' : 'items'})`}
                  </Text>
                </View>
                <Text noTranslate style={styles.sumValue}>
                  {formatPrice(mrpTotal)}
                </Text>
              </View>

              {discount > 0 ? (
                <View style={styles.sumRow}>
                  <Text style={[styles.sumLabel, { fontWeight: '600', color: colors.emerald[600] }]}>Discount</Text>
                  <Text noTranslate style={[styles.sumLabel, { fontWeight: '600', color: colors.emerald[600] }]}>
                    {`- ${formatPrice(discount)}`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Delivery</Text>
                {/* The delivery option (and its fee) is chosen at the next step. */}
                <Text style={[styles.sumLabel, { fontWeight: '600', color: colors.slate[500] }]}>Calculated at checkout</Text>
              </View>

              <View style={[styles.sumRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text noTranslate style={styles.totalLabel}>
                  {formatPrice(subtotal)}
                </Text>
              </View>
            </View>

            {blockingIssues.length > 0 ? (
              <Text accessibilityRole="alert" style={styles.blocking}>
                {blockingIssues.length === 1
                  ? '1 item needs your attention before you can check out.'
                  : `${blockingIssues.length} items need your attention before you can check out.`}
              </Text>
            ) : null}

            <PressableScale
              onPress={() => router.push(USER_ROUTES.CHECKOUT_ADDRESS)}
              disabled={blockingIssues.length > 0 || isSyncing}
              scaleTo={0.98}
              accessibilityRole="button"
              style={[styles.checkoutBtn, shadows.md, (blockingIssues.length > 0 || isSyncing) && { opacity: 0.5 }]}
            >
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </PressableScale>

            <View style={styles.secure}>
              <Icon name="HiShieldCheck" size={16} color={colors.emerald[600]} />
              <Text style={styles.secureText}>Secure checkout. Final total confirmed before payment.</Text>
            </View>
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  h1: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  syncing: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[400] },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.amber[200],
    backgroundColor: colors.amber[50],
    padding: 14,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.amber[800] },
  noticeDismiss: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.amber[800], textDecorationLine: 'underline' },
  dropshipNote: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
    padding: 14,
  },
  dropshipNoteText: { fontSize: 12, lineHeight: 16, color: colors.blue[900] },
  primarySmall: { borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  primarySmallText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },

  itemCard: { borderRadius: radius['2xl'], borderWidth: 1, backgroundColor: '#fff', padding: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 64,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  itemName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  itemVariant: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, paddingTop: 4 },
  itemPrice: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  each: { fontSize: 11, lineHeight: 16, color: colors.slate[400] },
  bulk: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.emerald[600] },
  controls: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
    padding: 4,
  },
  stepBtn: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  qty: { minWidth: 24, paddingHorizontal: 4, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  trash: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  moqNote: {
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.amber[200],
    backgroundColor: colors.amber[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.amber[700],
  },
  nextTier: { marginTop: 10, fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.emerald[700] },
  availability: {
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  priceChanged: { marginTop: 8, fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.blue[700] },

  summary: {
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 16,
  },
  summaryTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sumLabel: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  sumValue: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 8 },
  totalLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  blocking: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.red[200],
    backgroundColor: colors.red[50],
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.red[700],
  },
  checkoutBtn: { marginTop: 8, alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingVertical: 14 },
  checkoutText: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.3, color: '#fff' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 4 },
  secureText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
})
