import { useEffect, useState } from 'react'
import { HiArrowLeft, HiChevronRight, HiCreditCard, HiShieldCheck, HiTruck, HiWallet } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { Toast } from '../../../../components/ui'
import { USER_ROUTES } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { useShippingQuoteController } from '../../controllers/useShippingQuoteController'
import { useCheckoutStore } from '../../../../lib/checkoutStore'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useCheckoutController } from '../../controllers/useCheckoutController'
import { useWalletController } from '../../controllers/useWalletController'
import { useProfileController } from '../../controllers/useProfileController'
import { CheckoutStepper } from './CheckoutStepper'

export function PaymentScreen() {
  const navigate = useNavigate()

  const { profile } = useProfileController()
  const { balance: walletBalance } = useWalletController()

  const cartItems = useCartStore((s) => s.items)
  const cartSummary = useCartStore((s) => s.summary)
  const hydrateCart = useCartStore((s) => s.hydrate)

  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const chosenMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)
  const resetCheckout = useCheckoutStore((s) => s.reset)

  const { payAndPlaceOrder, isPlacingOrder, error } = useCheckoutController()
  const [selectedMethod, setSelectedMethod] = useState(chosenMethod || 'RAZORPAY')

  usePageMeta({ title: 'Payment - Checkout', noindex: true })

  // The amount used to come from `location.state.total`, which meant a WebView
  // reload — routine on Android, and guaranteed on the way back from a UPI app
  // — produced a ₹0 total and a permanently disabled "Pay" button with no way
  // forward. It is now derived from the cart and the persisted checkout
  // selections, so it survives a reload, a background/foreground cycle and a
  // deep link (§111, §112).
  const subtotal = cartSummary?.subtotal ?? cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const discount = appliedCoupon?.discountAmount || 0
  const { quote } = useShippingQuoteController({
    addressId: selectedAddressId,
    paymentMethod: selectedMethod,
    couponCode: appliedCoupon?.code,
  })
  const shippingFee = quote?.shippingFee ?? 0
  const amount = quote?.total ?? Math.max(0, subtotal - discount + shippingFee)

  useEffect(() => {
    hydrateCart()
  }, [hydrateCart])

  // Nothing to pay for: send the buyer back to the step that is actually
  // missing rather than showing a dead screen.
  useEffect(() => {
    if (cartItems.length === 0) {
      navigate(USER_ROUTES.CART, { replace: true })
    } else if (!selectedAddressId) {
      navigate(USER_ROUTES.CHECKOUT_ADDRESS, { replace: true })
    }
  }, [cartItems.length, selectedAddressId, navigate])

  const paymentMethods = [
    { id: 'RAZORPAY', name: 'Pay Online (Card / UPI / Netbanking)', icon: HiCreditCard, badge: 'RECOMMENDED' },
    {
      id: 'WALLET',
      name: 'Krozenda Wallet',
      icon: HiWallet,
      tag: `Balance: ₹${walletBalance.toLocaleString('en-IN')}`,
      disabled: walletBalance < amount,
      disabledReason: 'Insufficient wallet balance',
    },
    { id: 'COD', name: 'Cash on Delivery', icon: HiTruck },
  ]

  const handlePay = async () => {
    // Frontend guard only — the real protection is the idempotency key the
    // controller sends, which the backend keys on so a double submission
    // resolves to one order (§59: frontend-only protection is insufficient).
    if (isPlacingOrder) return

    try {
      const order = await payAndPlaceOrder({
        addressId: selectedAddressId,
        paymentMethod: selectedMethod,
        couponCode: appliedCoupon?.code || undefined,
        prefill: { name: profile?.name, email: profile?.email, contact: profile?.mobileNumber },
      })

      // `undefined` means the call was swallowed as a duplicate of one already
      // in flight — the first one will navigate.
      if (!order) return

      // The cart is emptied server-side by the order endpoint; clearing here
      // keeps the local view in step without a second round trip.
      useCartStore.setState({ items: [], summary: null })
      resetCheckout()
      navigate(USER_ROUTES.CHECKOUT_SUCCESS, { state: { order }, replace: true })
    } catch (err) {
      // A stock/availability failure at this point means the cart moved under
      // the buyer; re-read it so the cart screen can explain what changed.
      if (err?.code === 'INSUFFICIENT_STOCK' || err?.code === 'CART_ITEM_UNAVAILABLE') {
        hydrateCart()
      }
      // Everything else is surfaced by the Toast below.
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-4 pb-28 sm:px-6 md:py-8 md:pb-12 lg:px-8">
        <CheckoutStepper current={3} />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(USER_ROUTES.CHECKOUT_SUMMARY)}
                  aria-label="Back to order summary"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-base font-black text-slate-900 sm:text-xl">
                    Select Payment Method
                  </h1>
                  <p className="text-xs text-slate-500">Choose your payment mode to complete the order</p>
                </div>
              </div>
            </div>

            {/* A radiogroup, not a list of divs — this is a single choice, and
                it has to be reachable and operable by keyboard and screen
                reader, not just by tap. */}
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              {paymentMethods.map((method) => {
                const IconComponent = method.icon
                const isSelected = selectedMethod === method.id
                const methodRow = quote?.methods?.[method.id] ?? null

                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={method.disabled}
                    onClick={() => {
                      setSelectedMethod(method.id)
                      setPaymentMethod(method.id)
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                      method.disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                        : isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <IconComponent className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="text-xs font-bold text-slate-900 sm:text-sm">
                              {method.name}
                            </h2>
                            {method.badge && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-800">
                                {method.badge}
                              </span>
                            )}
                          </div>
                          {method.tag && (
                            <p
                              className={`mt-0.5 text-xs font-semibold ${
                                method.disabled ? 'text-red-500' : 'text-emerald-600'
                              }`}
                            >
                              {method.disabled ? method.disabledReason : method.tag}
                            </p>
                          )}
                        </div>
                      </div>

                      {methodRow && (
                        <div className="text-right shrink-0">
                          {methodRow.isFree ? (
                            <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                              FREE Delivery
                            </span>
                          ) : (
                            <div className="text-right">
                              <span className="block text-xs sm:text-sm font-black text-slate-900">
                                ₹{Number(methodRow.shippingFee).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-tight">Delivery</span>
                            </div>
                          )}
                        </div>
                      )}

                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedMethod === 'RAZORPAY' && (
              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-medium text-slate-500">
                You may be taken to your bank or UPI app to complete the payment. Come back to this
                app afterwards — your order is only confirmed once we have verified the payment with
                the gateway.
              </p>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-md sm:p-6 lg:sticky lg:top-24">
              <h2 className="border-b border-slate-100 pb-3 text-sm font-black text-slate-900 sm:text-base">
                Payment Summary
              </h2>

              <dl className="space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-xs">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold text-slate-900">
                    {'₹'}
                    {subtotal.toLocaleString('en-IN')}
                  </dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <dt>Coupon ({appliedCoupon.code})</dt>
                    <dd>
                      - {'₹'}
                      {discount.toLocaleString('en-IN')}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <dt>Shipping</dt>
                  <dd className={shippingFee === 0 ? 'font-bold text-emerald-600' : 'font-semibold text-slate-900'}>
                    {shippingFee === 0 ? 'FREE' : `₹${Number(shippingFee).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-700">
                  <dt>Grand Total</dt>
                  <dd className="text-sm font-black text-blue-700">
                    {'₹'}
                    {Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] font-medium text-slate-500">
                Inclusive of all taxes. The final amount is recalculated and verified by our servers
                before your order is created.
              </p>

              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 text-[11px] font-semibold text-emerald-800">
                <HiShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>Payments are encrypted and verified server-side before confirmation.</span>
              </div>

              {error && (
                <Toast
                  tone="danger"
                  message={error?.message || 'Payment could not be completed. Please try again.'}
                />
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={isPlacingOrder || amount <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-xs font-bold tracking-wide text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                <span>
                  {isPlacingOrder
                    ? 'Processing…'
                    : selectedMethod === 'COD'
                      ? `Place Order • ₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                      : `Pay ₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                </span>
                {!isPlacingOrder && <HiChevronRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
