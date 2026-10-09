import { useEffect, useState } from 'react'
import { View, Pressable, TextInput, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { PressableScale } from '../../../../components/ui/motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { useCartStore } from '../../../../lib/cartStore'
import { useCheckoutStore } from '../../../../lib/checkoutStore'
import { toast } from '../../../../lib/toast'
import { USER_ROUTES } from '../../../../config/routes'
import { colors, fonts, shadows } from '../../../../theme'
import { useShippingQuoteController } from '../../controllers/useShippingQuoteController'
import { useAddressesController } from '../../controllers/useAddressesController'
import { useApplyCouponController } from '../../controllers/useCouponsController'
import { CheckoutStepper } from './CheckoutStepper'

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function OrderSummaryScreen() {
  const router = useRouter()
  const cartItems = useCartStore((s) => s.items)
  const summary = useCartStore((s) => s.summary)
  const hydrateCart = useCartStore((s) => s.hydrate)
  const { addresses } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)
  const setAppliedCoupon = useCheckoutStore((s) => s.setAppliedCoupon)
  const clearCoupon = useCheckoutStore((s) => s.clearCoupon)

  const { applyCoupon, isApplying, error: couponError, reset: resetCouponError } = useApplyCouponController()
  const [couponInput, setCouponInput] = useState('')

  // Last stop before payment: re-read the cart so a price change, a stock drop or a delisting
  // that happened while the buyer was picking an address is reflected in the total.
  useEffect(() => {
    hydrateCart()
  }, [hydrateCart])

  const onBack = () => router.navigate(USER_ROUTES.CHECKOUT_ADDRESS)
  const onEditCart = () => router.navigate(USER_ROUTES.CART)

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  // The server quotes the price; this screen displays it.
  const { quote } = useShippingQuoteController({
    addressId: selectedAddressId,
    paymentMethod,
    couponCode: appliedCoupon?.code,
  })
  const shippingFee = quote?.shippingFee ?? 0

  const subtotal =
    quote?.subtotal ?? summary?.subtotal ?? cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const discount = quote?.discountAmount ?? (appliedCoupon?.discountAmount || 0)
  const couponLabel = quote?.couponCode || appliedCoupon?.code || ''
  const platformFee = quote?.platformFee ?? 0
  const tax = quote?.tax ?? null
  const listSubtotal = tax?.listSubtotal ?? subtotal
  const gstAdded = tax?.gstAdded ?? 0
  const gstIncluded = tax?.gstIncluded ?? 0
  const taxByLine = new Map((tax?.lines || []).map((line) => [`${line.productId}::${line.variantId ?? ''}`, line]))
  const finalTotal = quote?.total ?? Math.max(0, subtotal - discount + shippingFee)

  // Anything that will make the order endpoint refuse, surfaced before the payment step.
  const blockedItems = cartItems.filter(
    (item) =>
      item.availability === 'UNAVAILABLE' ||
      item.availability === 'OUT_OF_STOCK' ||
      item.availability === 'INSUFFICIENT_STOCK',
  )
  const priceChangedItems = cartItems.filter((item) => item.priceChanged)

  // Arriving without the earlier steps (deep link, address deleted, emptied cart) has nothing to summarise.
  useEffect(() => {
    if (cartItems.length === 0) {
      router.replace(USER_ROUTES.CART)
    } else if (!selectedAddressId) {
      router.replace(USER_ROUTES.CHECKOUT_ADDRESS)
    }
  }, [cartItems.length, selectedAddressId, router])

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    resetCouponError()
    try {
      const result = await applyCoupon(couponInput.trim())
      setAppliedCoupon(result)
      toast.success('Coupon Applied', `Code ${result.code} applied! Saved ₹${result.discountAmount.toLocaleString('en-IN')}`)
    } catch (err) {
      toast.error('Invalid Coupon', err)
    }
  }

  const canProceed = !(cartItems.length === 0 || !selectedAddress || blockedItems.length > 0)

  return (
    <Screen nav contentStyle={styles.content} keyboard>
      <CheckoutStepper current={2} />

      <View style={styles.stack}>
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={6}>
              <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
            </Pressable>
            <Text style={styles.title}>Review Order Details</Text>
          </View>
          <Pressable onPress={onEditCart} style={styles.editBtn}>
            <Icon name="HiPencilSquare" size={16} color={colors.blue[600]} />
            <Text style={styles.editBtnText}>Edit Items</Text>
          </Pressable>
        </View>

        {/* Shipping & Delivery Address Summary Cards */}
        <View style={styles.infoCard}>
          <View style={styles.infoHead}>
            <Icon name="HiMapPin" size={16} color={colors.blue[700]} />
            <Text style={styles.infoHeadText}>Deliver To</Text>
          </View>
          {selectedAddress ? (
            <>
              <Text style={styles.infoStrong}>{`${selectedAddress.fullName} (${selectedAddress.type})`}</Text>
              <Text style={styles.infoMuted}>
                {`${selectedAddress.line1}, ${selectedAddress.city}, ${selectedAddress.pincode}`}
              </Text>
              <Text style={styles.infoPhone}>{selectedAddress.phone}</Text>
            </>
          ) : (
            <Text style={styles.infoMuted}>No address selected</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHead}>
            <Icon name="HiTruck" size={16} color={colors.blue[700]} />
            <Text style={styles.infoHeadText}>Delivery</Text>
          </View>
          <Text style={styles.infoStrong}>
            {quote?.estimatedDeliveryDays
              ? `Arrives in about ${quote.estimatedDeliveryDays} business day${quote.estimatedDeliveryDays === 1 ? '' : 's'}`
              : 'Delivery estimate confirmed at dispatch'}
          </Text>
          {quote?.parcelCount > 1 ? (
            <Text style={styles.infoMuted}>{`Arriving as ${quote.parcelCount} separate parcels from different sellers`}</Text>
          ) : null}
          <View style={styles.shipPill}>
            <Text style={styles.shipPillText}>{shippingFee === 0 ? 'FREE SHIPPING' : `₹${shippingFee} SHIPPING`}</Text>
          </View>
        </View>

        {/* Itemized Order List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{`Order Items (${cartItems.length})`}</Text>
          {cartItems.length === 0 ? (
            <Text style={[styles.infoMuted, { paddingVertical: 16 }]}>Your cart is empty.</Text>
          ) : (
            <View>
              {cartItems.map((item, index) => {
                const line = taxByLine.get(`${item.id}::${item.variantId ?? ''}`)
                return (
                  <View
                    key={`${item.id}::${item.variantId ?? ''}`}
                    style={[styles.itemRow, index > 0 && styles.itemRowDivider]}
                  >
                    <View style={styles.itemLeft}>
                      <SmartImage src={item.image} alt={item.name} ratio="1 / 1" style={styles.itemImage} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={styles.itemName}>
                          {item.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.itemVariant}>
                          {item.variant}
                        </Text>
                        <Text style={styles.itemQty}>{`Qty: ${item.quantity}`}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text noTranslate style={styles.itemPrice}>
                        {`₹${(item.price * item.quantity).toLocaleString('en-IN')}`}
                      </Text>
                      {line && line.gstRate > 0 ? (
                        <Text noTranslate style={styles.itemGst}>
                          {line.gstInclusive
                            ? `Incl. ${line.gstRate}% GST (${money(line.gstAmount)})`
                            : `+ ${line.gstRate}% GST (${money(line.gstAmount)})`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Coupon Code */}
        <View style={[styles.sectionCard, { gap: 12 }]}>
          <View style={styles.couponHead}>
            <Icon name="HiTag" size={16} color={colors.blue[600]} />
            <Text style={styles.couponTitle}>Have a Coupon Code?</Text>
          </View>

          {appliedCoupon ? (
            <View style={styles.appliedBox}>
              <Text noTranslate style={styles.appliedText}>
                {`“${appliedCoupon.code}” applied — you saved ₹${appliedCoupon.discountAmount.toLocaleString('en-IN')}`}
              </Text>
              <Pressable
                onPress={() => {
                  clearCoupon()
                  toast.info('Coupon Removed', 'Coupon discount was removed.')
                }}
                hitSlop={8}
              >
                <Icon name="HiXMark" size={16} color={colors.emerald[700]} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponRow}>
              <TextInput
                value={couponInput}
                onChangeText={(text) => setCouponInput(text.toUpperCase())}
                placeholder="Enter coupon code"
                placeholderTextColor={colors.slate[400]}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.couponInput}
              />
              <Pressable
                onPress={handleApplyCoupon}
                disabled={isApplying || !couponInput.trim()}
                style={[styles.applyBtn, { opacity: isApplying || !couponInput.trim() ? 0.6 : 1 }]}
              >
                <Text style={styles.applyBtnText}>{isApplying ? 'Applying...' : 'Apply'}</Text>
              </Pressable>
            </View>
          )}
          {couponError ? <Text style={styles.couponError}>{couponError.message}</Text> : null}
        </View>

        {/* Final payment breakdown */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Final Payment Breakdown</Text>

          <View style={{ gap: 10 }}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Items Subtotal</Text>
              <Text noTranslate style={styles.sumValue}>
                {money(listSubtotal)}
              </Text>
            </View>
            {gstAdded > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>GST (added on items)</Text>
                <Text noTranslate style={styles.sumValue}>{`+ ${money(gstAdded)}`}</Text>
              </View>
            ) : null}
            {discount > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.discountText}>{`Coupon Discount${couponLabel ? ` (${couponLabel})` : ''}`}</Text>
                <Text noTranslate style={styles.discountText}>{`- ${money(discount)}`}</Text>
              </View>
            ) : null}
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Shipping Fee</Text>
              <Text
                noTranslate={shippingFee !== 0}
                style={shippingFee === 0 ? styles.freeText : styles.sumValue}
              >
                {shippingFee === 0 ? 'FREE' : `₹${Number(shippingFee).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            {platformFee > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Platform Fee</Text>
                <Text noTranslate style={styles.sumValue}>
                  {money(platformFee)}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount Payable</Text>
              <Text noTranslate style={styles.totalValue}>
                {`₹${Number(finalTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            {tax?.gstTotal > 0 ? (
              <Text noTranslate style={styles.gstNote}>
                {`Total GST in this order: ${money(tax.gstTotal)}`}
                {gstIncluded > 0 && gstAdded > 0 ? ` (${money(gstIncluded)} included in prices)` : ''}
                {gstIncluded > 0 && gstAdded === 0 ? ' (included in item prices)' : ''}
              </Text>
            ) : null}
          </View>

          {priceChangedItems.length > 0 ? (
            <Text style={styles.priceChanged}>
              {priceChangedItems.length === 1
                ? 'The price of one item changed since you added it. The total above is current.'
                : `Prices changed on ${priceChangedItems.length} items since you added them. The total above is current.`}
            </Text>
          ) : null}

          {blockedItems.length > 0 ? (
            <View accessibilityRole="alert" style={styles.blockedBox}>
              <Icon name="HiExclamationTriangle" size={16} color={colors.red[700]} style={{ marginTop: 2 }} />
              <Text style={styles.blockedText}>
                {blockedItems.length === 1
                  ? `"${blockedItems[0].name}" can no longer be ordered as-is. `
                  : `${blockedItems.length} items can no longer be ordered as-is. `}
                <Text onPress={onEditCart} style={styles.blockedLink}>
                  Review your cart
                </Text>
              </Text>
            </View>
          ) : null}

          <PressableScale
            onPress={() => router.push(USER_ROUTES.CHECKOUT_PAYMENT)}
            disabled={!canProceed}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: colors.blue[600], opacity: canProceed ? 1 : 0.5 }]}
          >
            <Text style={styles.ctaText}>Proceed to Payment</Text>
            <Icon name="HiChevronRight" size={16} color="#fff" />
          </PressableScale>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  stack: { gap: 16 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    ...shadows.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  backBtn: { padding: 6, borderRadius: 9999 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900], flexShrink: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    gap: 4,
    ...shadows.xs,
  },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoHeadText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[700] },
  infoStrong: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  infoMuted: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  infoPhone: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700], paddingTop: 4 },
  shipPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: colors.emerald[200],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  shipPillText: { fontSize: 10, fontWeight: '800', color: colors.emerald[700] },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    gap: 16,
    ...shadows.xs,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.slate[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 12 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  itemImage: {
    width: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: '#fff',
  },
  itemName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  itemVariant: { fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  itemQty: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[400] },
  itemPrice: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  itemGst: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.slate[500] },
  couponHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  appliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: colors.emerald[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  appliedText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[800] },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    fontSize: 12,
    fontFamily: fonts[700],
    color: colors.slate[900],
  },
  applyBtn: { backgroundColor: colors.blue[600], paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  applyBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  couponError: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.red[600] },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 20,
    gap: 20,
    ...shadows.md,
  },
  summaryTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.slate[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 12,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sumLabel: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  sumValue: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  discountText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.emerald[600] },
  freeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[600] },
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
  gstNote: { fontSize: 11, lineHeight: 16, color: colors.slate[500], textAlign: 'right' },
  priceChanged: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '600',
    color: colors.blue[800],
  },
  blockedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.red[200],
    backgroundColor: colors.red[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blockedText: { flex: 1, fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.red[700] },
  blockedLink: { fontWeight: '700', textDecorationLine: 'underline', color: colors.red[700] },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    ...shadows.md,
  },
  ctaText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
})
