import { useEffect } from 'react'
import { HiArrowLeft, HiExclamationTriangle, HiMinus, HiPlus, HiShieldCheck, HiTrash } from 'react-icons/hi2'
import { Link, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { EmptyResult } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { MAX_LINE_QUANTITY, useCartStore } from '../../../../lib/cartStore'
import { usePageMeta } from '../../../../lib/usePageMeta'

// Availability, as the server reports it. The cart previously had no concept
// of this at all: every line rendered identically whether the product was in
// stock, nearly gone, sold out, or delisted — and the buyer only found out at
// checkout, after entering an address and picking a payment method.
const AVAILABILITY_NOTE = {
  UNAVAILABLE: {
    tone: 'bg-red-50 text-red-700 border-red-200',
    message: 'No longer available — remove it to continue.',
    blocking: true,
  },
  OUT_OF_STOCK: {
    tone: 'bg-red-50 text-red-700 border-red-200',
    message: 'Out of stock — remove it to continue.',
    blocking: true,
  },
  INSUFFICIENT_STOCK: {
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
    message: null, // filled in per line, it needs the number
    blocking: true,
  },
  LOW_STOCK: {
    tone: 'bg-amber-50 text-amber-800 border-amber-200',
    message: null,
    blocking: false,
  },
}

function formatPrice(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`
}

export function CartPageScreen() {
  const navigate = useNavigate()

  const cartItems = useCartStore((state) => state.items)
  const summary = useCartStore((state) => state.summary)
  const isSyncing = useCartStore((state) => state.isSyncing)
  const notice = useCartStore((state) => state.notice)
  const clearNotice = useCartStore((state) => state.clearNotice)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const hydrate = useCartStore((state) => state.hydrate)

  usePageMeta({ title: 'My Cart', noindex: true })

  // Re-read on mount: prices, stock and availability may all have moved since
  // the items went in, and this is the last screen before the buyer commits to
  // a total.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Totals come from the server when there is one (`summary`), and are only
  // computed locally for a signed-out cart. The cart page used to compute its
  // own total from locally-stored prices AND add a ₹49 "Secure Packaging" fee
  // that no checkout endpoint ever charged — so the "Total Amount" shown here
  // was never the amount the buyer paid.
  const subtotal = summary?.subtotal ?? cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const mrpTotal = summary?.mrpTotal ?? cartItems.reduce((s, i) => s + i.originalPrice * i.quantity, 0)
  const discount = Math.max(0, mrpTotal - subtotal)

  const blockingIssues = cartItems.filter(
    (item) => AVAILABILITY_NOTE[item.availability]?.blocking,
  )
  const unitCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-800 transition-colors hover:bg-slate-100"
          >
            <HiArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">
            My Cart{unitCount > 0 ? ` (${unitCount})` : ''}
          </h1>
        </div>
        {isSyncing && (
          <span className="text-[11px] font-semibold text-slate-400" role="status">
            Updating…
          </span>
        )}
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-4 pb-28 sm:px-6 md:pb-12">
        {/* Whatever the server had to adjust, said out loud rather than
            silently applied. */}
        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-800"
          >
            <HiExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={clearNotice}
              className="shrink-0 font-bold underline"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        )}

        {cartItems.length === 0 ? (
          <EmptyResult
            icon={'🛒'}
            title="Your cart is empty"
            description="Browse the catalog and add something you like — it will show up here."
            action={
              <Link
                to={USER_ROUTES.LISTING}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                Continue shopping
              </Link>
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {cartItems.map((item) => {
                const note = AVAILABILITY_NOTE[item.availability]
                const unavailable =
                  item.availability === 'UNAVAILABLE' || item.availability === 'OUT_OF_STOCK'
                // Cap the stepper at real stock so "+" cannot climb past what
                // exists. It used to increment without any bound at all.
                const maxQty = Math.min(item.stock ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY)

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border bg-white p-3.5 shadow-sm sm:p-4 ${
                      unavailable ? 'border-red-200' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        to={userPath.product(item.id)}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <SmartImage
                          src={item.image}
                          srcSet={item.imageSrcSet}
                          sizes="80px"
                          alt={item.name}
                          ratio="1 / 1"
                          className={`w-16 shrink-0 rounded-xl border border-slate-100 sm:w-20 ${
                            unavailable ? 'opacity-50' : ''
                          }`}
                        />

                        <div className="min-w-0 flex-1 space-y-0.5">
                          {/* Two lines then ellipsis — a long marketplace name
                              truncated to one line was unreadable. */}
                          <h2 className="line-clamp-2 text-xs font-bold text-slate-900 sm:text-sm">
                            {item.name}
                          </h2>
                          {item.variant && (
                            <p className="truncate text-[11px] font-medium text-slate-500">
                              {item.variant}
                            </p>
                          )}
                          <div className="flex flex-wrap items-baseline gap-x-2 pt-1">
                            <span className="text-xs font-black text-slate-900 sm:text-sm">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-[11px] text-slate-400">
                                {formatPrice(item.price)} each
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={unavailable}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40"
                          >
                            <HiMinus className="h-3.5 w-3.5" />
                          </button>
                          <span
                            className="min-w-6 px-1 text-center text-xs font-bold text-slate-900"
                            aria-label={`Quantity: ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={unavailable || item.quantity >= maxQty}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40"
                          >
                            <HiPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.name} from cart`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <HiTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Per-line status: availability first, then a price change */}
                    {note && (
                      <p
                        className={`mt-2.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${note.tone}`}
                      >
                        {item.availability === 'INSUFFICIENT_STOCK'
                          ? `Only ${item.stock} left — reduce the quantity to continue.`
                          : item.availability === 'LOW_STOCK'
                            ? `Only ${item.stock} left in stock.`
                            : note.message}
                      </p>
                    )}

                    {item.priceChanged && (
                      <p className="mt-2 text-[11px] font-semibold text-blue-700">
                        Price changed from {formatPrice(item.addedAtPrice)} since you added this.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-bold text-slate-900">Price Details</h2>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <dt>
                    Total MRP{' '}
                    <span className="text-slate-400">
                      ({unitCount} {unitCount === 1 ? 'item' : 'items'})
                    </span>
                  </dt>
                  <dd className="font-semibold text-slate-900">{formatPrice(mrpTotal)}</dd>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <dt>Discount</dt>
                    <dd>- {formatPrice(discount)}</dd>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <dt>Delivery</dt>
                  {/* Honest: the delivery option (and therefore its fee) is
                      chosen at the next step, and the total is computed by the
                      server from that choice. Showing "₹0 — free delivery!"
                      here, as this page used to, was a promise the checkout
                      did not keep. */}
                  <dd className="font-semibold text-slate-500">Calculated at checkout</dd>
                </div>

                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-900">
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
              </dl>

              {blockingIssues.length > 0 && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] font-bold text-red-700"
                >
                  {blockingIssues.length === 1
                    ? '1 item needs your attention before you can check out.'
                    : `${blockingIssues.length} items need your attention before you can check out.`}
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate(USER_ROUTES.CHECKOUT_ADDRESS)}
                disabled={blockingIssues.length > 0 || isSyncing}
                className="mt-2 w-full rounded-xl bg-blue-600 py-3.5 text-xs font-bold tracking-wide text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proceed to Checkout
              </button>

              <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-medium text-slate-500">
                <HiShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>Secure checkout. Final total confirmed before payment.</span>
              </p>
            </div>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
