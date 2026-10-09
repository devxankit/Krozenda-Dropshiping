import { useEffect, useRef, useState } from 'react'
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Animated, PressableScale, enterFade, fadeIn, smoothLayout } from '../../../../components/ui/motion'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { toast } from '../../../../lib/toast'
import { USER_ROUTES } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { useCheckoutStore } from '../../../../lib/checkoutStore'
import { colors, shadows } from '../../../../theme'
import { useShippingQuoteController } from '../../controllers/useShippingQuoteController'
import { useCheckoutController } from '../../controllers/useCheckoutController'
import { useWalletController } from '../../controllers/useWalletController'
import { useProfileController } from '../../controllers/useProfileController'
import { usePaymentMethodsController } from '../../controllers/usePaymentMethodsController'
import { CheckoutStepper } from './CheckoutStepper'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function AnimatedMethod({ index, children }) {
  return (
    <Animated.View entering={enterFade(index)} layout={smoothLayout}>
      {children}
    </Animated.View>
  )
}

export function PaymentScreen() {
  const router = useRouter()

  const { profile } = useProfileController()
  const { balance: walletBalance } = useWalletController()

  const cartItems = useCartStore((s) => s.items)
  const cartSummary = useCartStore((s) => s.summary)
  const hydrateCart = useCartStore((s) => s.hydrate)

  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const chosenMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)
  const b2b = useCheckoutStore((s) => s.b2b)
  const resetCheckout = useCheckoutStore((s) => s.reset)

  const { payAndPlaceOrder, isPlacingOrder, error } = useCheckoutController()
  const [selectedMethod, setSelectedMethod] = useState(chosenMethod || 'RAZORPAY')
  const { methods: enabledMethods } = usePaymentMethodsController()

  // The amount is derived from the cart and the persisted checkout selections, so it survives a
  // background/foreground cycle and a return from a UPI app.
  const cartSubtotal = cartSummary?.subtotal ?? cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartDiscount = appliedCoupon?.discountAmount || 0
  const { quote, isLoading: isQuoteLoading } = useShippingQuoteController({
    addressId: selectedAddressId,
    paymentMethod: selectedMethod,
    couponCode: appliedCoupon?.code,
  })
  const shippingFee = quote?.shippingFee ?? 0
  // Breakdown from the same quote as the amount, so the lines add up to it.
  const subtotal = quote?.tax?.listSubtotal ?? quote?.subtotal ?? cartSubtotal
  const gstAdded = quote?.tax?.gstAdded ?? 0
  const platformFee = quote?.platformFee ?? 0
  const discount = quote?.discountAmount ?? cartDiscount
  const amount = quote?.total ?? Math.max(0, subtotal - discount + shippingFee)

  useEffect(() => {
    hydrateCart()
  }, [hydrateCart])

  // Set the moment an order is placed. Placing empties the cart, and without this the redirect
  // below sent the buyer to the (now empty) cart instead of their orders.
  const placedRef = useRef(false)
  // Synchronous double-tap guard: isPlacingOrder only flips after a re-render, a second tap can slip in before it.
  const payingRef = useRef(false)

  useEffect(() => {
    if (placedRef.current) return
    if (cartItems.length === 0) {
      router.replace(USER_ROUTES.CART)
    } else if (!selectedAddressId) {
      router.replace(USER_ROUTES.CHECKOUT_ADDRESS)
    }
  }, [cartItems.length, selectedAddressId, router])

  const paymentMethods = [
    { id: 'RAZORPAY', name: 'Pay Online (Card / UPI / Netbanking)', icon: 'HiCreditCard', badge: 'RECOMMENDED' },
    {
      id: 'WALLET',
      name: 'Krozenda Wallet',
      icon: 'HiWallet',
      tag: `Balance: ₹${walletBalance.toLocaleString('en-IN')}`,
      disabled: walletBalance < amount,
      disabledReason: 'Insufficient wallet balance',
    },
    { id: 'COD', name: 'Cash on Delivery', icon: 'HiTruck' },
  ]
    .filter((method) => !enabledMethods || enabledMethods[method.id] !== false)
    // A dropshipping item in the cart: online payment only (the server refuses COD and wallet for it).
    .filter((method) => !quote?.onlineOnly || method.id === 'RAZORPAY')

  // If the method the buyer had selected got switched off admin-side, fall onto the first one still
  // allowed. Derived at render rather than synced back — a tap is still what commits a real choice.
  const activeMethod = paymentMethods.some((m) => m.id === selectedMethod)
    ? selectedMethod
    : paymentMethods[0]?.id || 'RAZORPAY'

  const handlePay = async () => {
    // Frontend guard only — the real protection is the idempotency key the controller sends.
    if (isPlacingOrder || payingRef.current) return
    payingRef.current = true

    try {
      const order = await payAndPlaceOrder({
        addressId: selectedAddressId,
        paymentMethod: activeMethod,
        couponCode: appliedCoupon?.code || undefined,
        b2b,
        prefill: { name: profile?.name, email: profile?.email, contact: profile?.mobileNumber },
      })

      // `undefined` means the call was swallowed as a duplicate of one already in flight.
      if (!order) return

      placedRef.current = true
      toast.success('Order Placed Successfully!', 'Your order has been confirmed.')
      router.replace(USER_ROUTES.ORDERS)
      // The cart is emptied server-side by the order endpoint; clear locally to keep the view in step.
      useCartStore.setState({ items: [], summary: null })
      resetCheckout()
    } catch (err) {
      // A stock/availability failure means the cart moved under the buyer; re-read it.
      if (err?.code === 'INSUFFICIENT_STOCK' || err?.code === 'CART_ITEM_UNAVAILABLE') {
        hydrateCart()
      }
      toast.error('Payment Failed', err)
    } finally {
      payingRef.current = false
    }
  }

  const payDisabled = isPlacingOrder || isQuoteLoading || amount <= 0

  return (
    <Screen nav contentStyle={styles.content}>
      <CheckoutStepper current={3} />

      <View style={styles.stack}>
        <View style={styles.headerCard}>
          <Pressable
            onPress={() => router.navigate(USER_ROUTES.CHECKOUT_SUMMARY)}
            accessibilityLabel="Back to order summary"
            style={styles.backBtn}
          >
            <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
          </Pressable>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title}>Select Payment Method</Text>
            <Text style={styles.subtitle}>Choose your payment mode to complete the order</Text>
          </View>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          {paymentMethods.map((method, index) => {
            const isSelected = activeMethod === method.id
            const methodRow = quote?.methods?.[method.id] ?? null

            return (
              <AnimatedMethod key={method.id} index={index}>
              <PressableScale
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: !!method.disabled }}
                disabled={method.disabled}
                onPress={() => {
                  setSelectedMethod(method.id)
                  setPaymentMethod(method.id)
                }}
                style={[
                  styles.methodCard,
                  method.disabled ? styles.methodDisabled : isSelected ? styles.methodSelected : styles.methodIdle,
                ]}
              >
                <View style={styles.methodRow}>
                  <View style={styles.methodLeft}>
                    <View style={[styles.methodIcon, isSelected ? styles.methodIconOn : styles.methodIconOff]}>
                      <Icon name={method.icon} size={20} color={isSelected ? '#fff' : colors.slate[600]} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.methodNameRow}>
                        <Text style={styles.methodName}>{method.name}</Text>
                        {method.badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{method.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      {method.tag ? (
                        <Text
                          noTranslate={!method.disabled}
                          style={[styles.methodTag, { color: method.disabled ? colors.red[500] : colors.emerald[600] }]}
                        >
                          {method.disabled ? method.disabledReason : method.tag}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {methodRow ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      {methodRow.isFree ? (
                        <View style={styles.freePill}>
                          <Text style={styles.freePillText}>FREE Delivery</Text>
                        </View>
                      ) : (
                        <>
                          <Text noTranslate style={styles.methodFee}>
                            {inr(methodRow.shippingFee)}
                          </Text>
                          <Text style={styles.methodFeeLabel}>DELIVERY</Text>
                        </>
                      )}
                    </View>
                  ) : null}

                  <View style={[styles.radio, isSelected ? styles.radioOn : styles.radioOff]}>
                    {isSelected ? <Animated.View entering={fadeIn} style={styles.radioDot} /> : null}
                  </View>
                </View>
              </PressableScale>
              </AnimatedMethod>
            )
          })}
        </View>

        {activeMethod === 'RAZORPAY' ? (
          <Text style={styles.gatewayNote}>
            You may be taken to your bank or UPI app to complete the payment. Come back to this app afterwards — your
            order is only confirmed once we have verified the payment with the gateway.
          </Text>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>

          <View style={styles.dl}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Subtotal</Text>
              <Text noTranslate style={styles.sumValue}>{`₹${subtotal.toLocaleString('en-IN')}`}</Text>
            </View>
            {gstAdded > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>GST (added on items)</Text>
                <Text noTranslate style={styles.sumValue}>{`+ ₹${gstAdded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</Text>
              </View>
            ) : null}
            {discount > 0 ? (
              <View style={styles.sumRow}>
                <Text noTranslate style={styles.discountText}>{`Coupon (${quote?.couponCode || appliedCoupon?.code})`}</Text>
                <Text noTranslate style={styles.discountText}>{`- ₹${discount.toLocaleString('en-IN')}`}</Text>
              </View>
            ) : null}
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Shipping</Text>
              <Text noTranslate={shippingFee !== 0} style={shippingFee === 0 ? styles.freeText : styles.sumValue}>
                {shippingFee === 0 ? 'FREE' : inr(shippingFee)}
              </Text>
            </View>
            {platformFee > 0 ? (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Platform Fee</Text>
                <Text noTranslate style={styles.sumValue}>
                  {inr(platformFee)}
                </Text>
              </View>
            ) : null}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Grand Total</Text>
              {isQuoteLoading ? (
                <Skeleton style={{ height: 16, width: 64, backgroundColor: colors.blue[100] }} />
              ) : (
                <Text noTranslate style={styles.grandValue}>
                  {inr(amount)}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.taxNote}>
            Inclusive of all taxes. The final amount is recalculated and verified by our servers before your order is
            created.
          </Text>

          <View style={styles.secureNote}>
            <Icon name="HiShieldCheck" size={20} color={colors.emerald[600]} />
            <Text style={styles.secureText}>Payments are encrypted and verified server-side before confirmation.</Text>
          </View>

          {error ? (
            <Animated.View entering={fadeIn} accessibilityRole="alert" style={styles.errorToast}>
              <Text style={styles.errorToastText}>
                {error?.message || 'Payment could not be completed. Please try again.'}
              </Text>
            </Animated.View>
          ) : null}

          <PressableScale
            onPress={handlePay}
            disabled={payDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: payDisabled, busy: isPlacingOrder }}
            style={[styles.cta, { backgroundColor: colors.blue[600], opacity: payDisabled ? 0.6 : 1 }]}
          >
            {isPlacingOrder ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.ctaText}>
              {isPlacingOrder
                ? 'Processing…'
                : activeMethod === 'COD'
                  ? `Place Order • ${inr(amount)}`
                  : `Pay ${inr(amount)}`}
            </Text>
            {!isPlacingOrder ? <Icon name="HiChevronRight" size={16} color="#fff" /> : null}
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
    gap: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    ...shadows.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900] },
  subtitle: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  methodCard: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16 },
  methodDisabled: { borderColor: colors.slate[200], backgroundColor: colors.slate[50], opacity: 0.6 },
  methodSelected: { borderColor: colors.blue[600], backgroundColor: 'rgba(239,246,255,0.4)', ...shadows.md },
  methodIdle: { borderColor: colors.slate[200], backgroundColor: '#fff' },
  methodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodIconOn: { backgroundColor: colors.blue[600], ...shadows.xs },
  methodIconOff: { backgroundColor: colors.slate[100] },
  methodNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  methodName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  badge: { backgroundColor: colors.amber[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  badgeText: { fontSize: 9, fontWeight: '800', color: colors.amber[800] },
  methodTag: { marginTop: 2, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  freePill: {
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  freePillText: { fontSize: 10, fontWeight: '700', color: colors.emerald[700] },
  methodFee: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  methodFeeLabel: { fontSize: 9, fontWeight: '700', color: colors.slate[400], letterSpacing: -0.2 },
  radio: { width: 20, height: 20, borderRadius: 9999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.blue[600], backgroundColor: colors.blue[600] },
  radioOff: { borderColor: colors.slate[300] },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: '#fff' },
  gatewayNote: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 11,
    lineHeight: 17.9,
    fontWeight: '500',
    color: colors.slate[500],
  },
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
  dl: {
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    backgroundColor: colors.slate[50],
    padding: 16,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sumLabel: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  sumValue: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  discountText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.emerald[600] },
  freeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[600] },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    paddingTop: 8,
  },
  grandLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  grandValue: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.blue[700] },
  taxNote: { fontSize: 11, lineHeight: 17.9, fontWeight: '500', color: colors.slate[500] },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.emerald[100],
    backgroundColor: colors.emerald[50],
    padding: 14,
  },
  secureText: { flex: 1, fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.emerald[800] },
  errorToast: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: colors.red[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.raised,
  },
  errorToastText: { fontSize: 14, lineHeight: 20, color: colors.red[700] },
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
