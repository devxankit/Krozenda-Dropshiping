import { HiArrowLeft, HiBanknotes, HiCheckCircle, HiCreditCard, HiTruck, HiWallet } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { CheckoutStepper } from './CheckoutStepper'
import { PAYMENT_METHODS, useCheckoutStore } from '../../../../lib/checkoutStore'
import { useAddressesController } from '../../controllers/useAddressesController'
import { useShippingQuoteController } from '../../controllers/useShippingQuoteController'
import { USER_ROUTES } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'

// Checkout step 2: how you pay, and what that costs to deliver.
//
// This replaces a "Choose Shipping Speed" screen offering Standard / Express /
// Priority at ₹0 / ₹99 / ₹199. Those were invented: nothing checked whether a
// courier could do "next business day" to the buyer's PIN code, and the fee
// the client picked was accepted by the server.
//
// Payment method is the real variable. A courier charges more to collect cash,
// so COD genuinely costs more to deliver, and that belongs next to the choice
// rather than as a surprise on the summary screen.

const ICONS = { RAZORPAY: HiCreditCard, WALLET: HiWallet, COD: HiBanknotes }

const money = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function PaymentMethodScreen() {
  const navigate = useNavigate()
  const { addresses } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentMethod = useCheckoutStore((s) => s.setPaymentMethod)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)

  usePageMeta({ title: 'Payment & Delivery', noindex: true })

  const address = addresses.find((a) => a.id === selectedAddressId) || null

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

      <div className="mx-auto w-full max-w-6xl flex-1 pb-24 md:px-6 md:py-6">
        <CheckoutStepper current={2} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
              <button
                type="button"
                onClick={() => navigate(USER_ROUTES.CHECKOUT_ADDRESS)}
                className="rounded-full p-1.5 text-slate-700 transition-colors hover:bg-slate-100"
                aria-label="Back to address"
              >
                <HiArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-base font-bold text-slate-900">Payment & Delivery</h2>
            </div>

            {address && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivering to</p>
                  <p className="truncate text-xs font-bold text-slate-900">
                    {address.fullName} — {address.city} {address.pincode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(USER_ROUTES.CHECKOUT_ADDRESS)}
                  className="shrink-0 text-xs font-bold text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {quote && quote.amountToFreeShipping > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                <HiTruck className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-800">
                  Add {money(quote.amountToFreeShipping)} more for free delivery
                </p>
              </div>
            )}

            {PAYMENT_METHODS.map((method) => {
              const Icon = ICONS[method.id] || HiCreditCard
              const selected = paymentMethod === method.id
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
                    selected ? 'border-blue-600 ring-1 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-blue-600' : 'border-slate-300'
                    }`}
                  >
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
                  </span>
                  <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{method.label}</span>
                      {method.badge && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-700">
                          {method.badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-500">{method.description}</span>
                  </span>

                  {/* The delivery charge for THIS method, only on the selected
                      one — quoting all three would mean three carrier calls
                      for a choice the buyer makes once. */}
                  {selected && (
                    <span className="shrink-0 text-right">
                      {isLoading ? (
                        <span className="text-[11px] font-semibold text-slate-400">Checking…</span>
                      ) : quote ? (
                        <>
                          <span
                            className={`block text-sm font-extrabold ${quote.isFree ? 'text-emerald-600' : 'text-slate-900'}`}
                          >
                            {quote.isFree ? 'FREE' : money(quote.shippingFee)}
                          </span>
                          <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            delivery
                          </span>
                        </>
                      ) : null}
                    </span>
                  )}
                </button>
              )
            })}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
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

          <aside className="h-fit space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-slate-900">Order Total</h3>

            {quote ? (
              <dl className="space-y-2 text-xs">
                <Row label="Subtotal" value={money(quote.subtotal)} />
                {quote.discountAmount > 0 && (
                  <Row label="Discount" value={`− ${money(quote.discountAmount)}`} tone="text-emerald-600" />
                )}
                <Row
                  label={quote.parcelCount > 1 ? `Delivery (${quote.parcelCount} parcels)` : 'Delivery'}
                  value={quote.isFree ? 'FREE' : money(quote.shippingFee)}
                  tone={quote.isFree ? 'text-emerald-600' : undefined}
                />
                {quote.isFree && quote.carrierCost > 0 && (
                  <p className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <HiCheckCircle className="h-3.5 w-3.5" />
                    We are covering {money(quote.carrierCost)} of delivery
                  </p>
                )}
                {quote.estimatedDeliveryDays && (
                  <p className="text-[10px] text-slate-500">
                    Arrives in about {quote.estimatedDeliveryDays} business day
                    {quote.estimatedDeliveryDays === 1 ? '' : 's'}
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <dt className="text-sm font-bold text-slate-900">Total</dt>
                  <dd className="text-base font-extrabold text-slate-900">{money(quote.total)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-slate-500">{isLoading ? 'Working out delivery…' : 'Select a payment method.'}</p>
            )}

            <button
              type="button"
              disabled={!canContinue}
              onClick={() => navigate(USER_ROUTES.CHECKOUT_SUMMARY)}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-xs font-extrabold tracking-wide text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to Order Summary
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
