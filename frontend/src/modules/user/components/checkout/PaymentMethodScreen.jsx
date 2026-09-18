import {
  HiArrowLeft,
  HiArrowRight,
  HiBanknotes,
  HiCheckCircle,
  HiCreditCard,
  HiMapPin,
  HiShieldCheck,
  HiTruck,
  HiWallet,
} from 'react-icons/hi2'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { CheckoutStepper } from './CheckoutStepper'
import { PAYMENT_METHODS, useCheckoutStore } from '../../../../lib/checkoutStore'
import { useAddressesController } from '../../controllers/useAddressesController'
import { useShippingQuoteController } from '../../controllers/useShippingQuoteController'
import { usePaymentMethodsController } from '../../controllers/usePaymentMethodsController'
import { USER_ROUTES } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'

// Checkout step 2: how you pay, and what that costs to deliver.
//
// Payment method is the real variable. A courier charges more to collect cash,
// so COD genuinely costs more to deliver, and that belongs next to the choice
// rather than as a surprise on the summary screen.

const ICONS = { RAZORPAY: HiCreditCard, WALLET: HiWallet, COD: HiBanknotes }

const METHOD_DETAILS = {
  RAZORPAY: {
    subtitle: 'UPI, Credit/Debit Card, Netbanking & Wallets',
  },
  WALLET: {
    subtitle: 'Pay instantly from your Krozenda wallet balance',
  },
  COD: {
    subtitle: 'Pay with cash or UPI when the courier delivers',
  },
}

const money = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function PaymentMethodScreen() {
  const navigate = useNavigate()
  const { addresses } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)

  usePageMeta({ title: 'Payment & Delivery - Checkout', noindex: true })

  const address = addresses.find((a) => a.id === selectedAddressId) || null

  const { methods: enabledMethods } = usePaymentMethodsController()
  const availableMethods = enabledMethods
    ? PAYMENT_METHODS.filter((method) => enabledMethods[method.id] !== false)
    : PAYMENT_METHODS

  // If the method the buyer had selected got switched off admin-side between
  // visits, move them onto the first one that is still allowed rather than
  // letting them continue toward an order createOrder will reject.
  useEffect(() => {
    if (!enabledMethods) return
    if (enabledMethods[paymentMethod] === false) {
      setPaymentMethod(availableMethods[0]?.id || 'RAZORPAY')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledMethods])

  const { quote, isLoading, error } = useShippingQuoteController({
    addressId: selectedAddressId,
    paymentMethod,
    couponCode: appliedCoupon?.code,
  })

  const canContinue = Boolean(quote) && !isLoading && !error

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-28 md:px-6 md:py-6">
        <CheckoutStepper current={2} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {/* Header with Navigation */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(USER_ROUTES.CHECKOUT_ADDRESS)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 active:scale-95"
                  aria-label="Back to address"
                >
                  <HiArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-base font-black text-slate-900 sm:text-lg">Payment & Delivery</h1>
                  <p className="text-xs text-slate-500">Select your payment method to view delivery charges</p>
                </div>
              </div>
            </div>

            {/* Delivery Address Card */}
            {address && (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <HiMapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        Deliver To
                      </span>
                      <span className="truncate text-xs font-bold text-slate-900">{address.fullName}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {address.line1 ? `${address.line1}, ` : ''}{address.city} — <span className="font-semibold text-slate-800">{address.pincode}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(USER_ROUTES.CHECKOUT_ADDRESS)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50 hover:border-blue-200"
                >
                  Change
                </button>
              </div>
            )}

            {quote && quote.amountToFreeShipping > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-xs">
                <HiTruck className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-800">
                  Add {money(quote.amountToFreeShipping)} more for free delivery
                </p>
              </div>
            )}

            {/* Payment & Delivery Options */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Choose Payment Option
              </h2>

              {availableMethods.map((method) => {
                const Icon = ICONS[method.id] || HiCreditCard
                const details = METHOD_DETAILS[method.id]
                const selected = paymentMethod === method.id
                const row = quote?.methods?.[method.id] ?? null

                const cheapest = Math.min(
                  ...Object.values(quote?.methods ?? {})
                    .filter((m) => m.available)
                    .map((m) => m.shippingFee)
                    .concat(Number.POSITIVE_INFINITY)
                )
                const extra =
                  row?.available && Number.isFinite(cheapest)
                    ? Math.round((row.shippingFee - cheapest) * 100) / 100
                    : 0
                const isCheapest = row?.available && extra === 0
                const savesMoney = Object.values(quote?.methods ?? {}).some(
                  (m) => m.available && m.shippingFee > cheapest
                )

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => row?.available !== false && setPaymentMethod(method.id)}
                    disabled={row?.available === false}
                    className={`group relative flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-150 ${
                      selected
                        ? 'border-blue-600 bg-blue-50/20 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                    } ${row?.available === false ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {/* Radio Indicator */}
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? 'border-blue-600' : 'border-slate-300 group-hover:border-slate-400'
                      }`}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                    </span>

                    {/* Method Icon */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        selected ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Title & Description */}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{method.label}</span>
                        {isCheapest && savesMoney && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-800">
                            LOWEST DELIVERY
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {details?.subtitle || method.description}
                      </span>
                    </span>

                    {/* Delivery Rate on Right */}
                    <span className="shrink-0 text-right">
                      {isLoading ? (
                        <span className="inline-block h-4 w-12 animate-pulse rounded bg-slate-200" />
                      ) : !row ? null : row.available === false ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-400">
                          Unavailable
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          {row.isFree ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-black text-emerald-700">
                              FREE DELIVERY
                            </span>
                          ) : (
                            <>
                              <span className="block text-sm sm:text-base font-black text-slate-900">
                                {money(row.shippingFee)}
                              </span>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Delivery
                              </span>
                            </>
                          )}
                          {extra > 0 && (
                            <span className="mt-1 inline-block rounded-md bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              +{money(extra)} COD fee
                            </span>
                          )}
                        </div>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-xs">
                <p className="text-xs font-bold text-red-700">
                  {error?.code === 'NOT_SERVICEABLE'
                    ? 'We cannot deliver this order to that address yet.'
                    : error?.message || 'We could not work out delivery charges just now.'}
                </p>
                <p className="mt-1 text-[11px] text-red-600">
                  {error?.code === 'NOT_SERVICEABLE'
                    ? 'Try a different delivery address.'
                    : 'Please try again in a moment.'}
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar: Order Summary */}
          <aside className="h-fit space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs lg:sticky lg:top-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 sm:text-base">Order Total</h3>
              {quote?.parcelCount && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {quote.parcelCount > 1 ? `${quote.parcelCount} parcels` : '1 parcel'}
                </span>
              )}
            </div>

            {quote ? (
              <div className="space-y-3">
                <dl className="space-y-2.5 text-xs">
                  <Row label="Subtotal" value={money(quote.subtotal)} />
                  {quote.discountAmount > 0 && (
                    <Row label="Discount" value={`− ${money(quote.discountAmount)}`} tone="text-emerald-600 font-bold" />
                  )}
                  <Row
                    label="Delivery Fee"
                    value={quote.isFree ? 'FREE' : money(quote.shippingFee)}
                    tone={quote.isFree ? 'text-emerald-600 font-bold' : 'text-slate-900 font-bold'}
                  />
                  {quote.isFree && quote.carrierCost > 0 && (
                    <p className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2 font-medium">
                      <HiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                      Free delivery promotion applied ({money(quote.carrierCost)} saved)
                    </p>
                  )}
                  {quote.estimatedDeliveryDays && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2">
                      <HiTruck className="h-4 w-4 shrink-0 text-blue-600" />
                      <span>
                        Arrives in about <strong className="text-slate-800">{quote.estimatedDeliveryDays} business days</strong>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div>
                      <dt className="text-sm font-black text-slate-900">Total</dt>
                      <p className="text-[10px] text-slate-400 font-medium">Inclusive of all taxes</p>
                    </div>
                    <dd className="text-lg font-black text-blue-700">{money(quote.total)}</dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-[10px] font-medium text-slate-600">
                  <HiShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Encrypted checkout & verified courier delivery</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">
                {isLoading ? 'Calculating delivery charges…' : 'Select a payment method.'}
              </p>
            )}

            <button
              type="button"
              disabled={!canContinue}
              onClick={() => navigate(USER_ROUTES.CHECKOUT_SUMMARY)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-xs font-black tracking-wide text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Continue to Order Summary</span>
              <HiArrowRight className="h-4 w-4" />
            </button>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="cart" />
      </div>
    </div>
  )
}

function Row({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}

