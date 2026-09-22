import { HiCheck, HiTruck } from 'react-icons/hi2'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrdersController } from '../../controllers/useOrdersController'

const PAYMENT_STATUS_COPY = {
  PAID: { label: 'Paid', className: 'text-emerald-700' },
  PENDING: { label: 'Payable on delivery', className: 'text-amber-700' },
  FAILED: { label: 'Payment failed', className: 'text-red-700' },
  REFUNDED: { label: 'Refunded', className: 'text-slate-700' },
}

export function OrderPlacedScreen() {
  const navigate = useNavigate()
  const location = useLocation()

  // The freshly-created order arrives in router state. A WebView reload on
  // this screen loses it, so the buyer's most recent order is used as the
  // fallback rather than showing "Order Confirmed / ₹0" with a dead
  // "View Order Details" button.
  const orderFromState = location.state?.order
  const { orders } = useOrdersController({ page: 1, limit: 1 })
  const order = orderFromState ?? orders[0] ?? null

  usePageMeta({ title: 'Order Placed', noindex: true })

  const orderRef = order?.id ? `#${order.id.slice(-10).toUpperCase()}` : null
  const amount = order?.total ?? null
  const paymentStatus = order ? PAYMENT_STATUS_COPY[order.paymentStatus] : null

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="w-full space-y-6 rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl md:p-12">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
            <HiCheck className="h-14 w-14 stroke-[3]" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800">
              Order confirmed
            </span>
            <h1 className="text-2xl font-black text-slate-900 md:text-4xl">
              Order placed successfully
            </h1>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-500 md:text-sm">
              Thank you for shopping with Krozenda. We are preparing your order for dispatch and
              will notify you at every step.
            </p>
          </div>

          {order ? (
            <dl className="mx-auto max-w-md space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="font-medium text-slate-500">Order reference</dt>
                <dd className="font-mono text-sm font-black text-slate-900">{orderRef}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium text-slate-500">Order total</dt>
                <dd className="text-base font-black text-blue-700">
                  {'₹'}
                  {(amount ?? 0).toLocaleString('en-IN')}
                </dd>
              </div>
              {paymentStatus && (
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Payment</dt>
                  <dd className={`font-bold ${paymentStatus.className}`}>{paymentStatus.label}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <dt className="font-medium text-slate-500">Delivery</dt>
                {/* No fabricated date: there is no courier integration behind
                    this order, so the honest answer is that tracking appears
                    once the seller dispatches it. */}
                <dd className="flex items-center gap-1 font-bold text-slate-700">
                  <HiTruck className="h-4 w-4" aria-hidden="true" />
                  <span>Tracking appears once dispatched</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">
              Your order has been placed. Open <span className="font-bold">My Orders</span> to see
              its details and track it.
            </p>
          )}

          <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(order ? userPath.order(order.id) : USER_ROUTES.ORDERS)}
              className="w-full rounded-2xl bg-blue-700 px-5 py-3.5 text-xs font-bold tracking-wide text-white shadow-md transition-all hover:bg-blue-800 active:scale-[0.98] sm:w-1/2"
            >
              {order ? 'View order details' : 'View my orders'}
            </button>
            <Link
              to={USER_ROUTES.DASHBOARD}
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-center text-xs font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] sm:w-1/2"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
