import { HiArrowLeft, HiCheck, HiTruck, HiXCircle } from 'react-icons/hi2'
import { useNavigate, useParams } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrderController, useOrderTrackingController } from '../../controllers/useOrdersController'

const FLOW = [
  { status: 'PENDING', title: 'Order Confirmed' },
  { status: 'PROCESSING', title: 'Processing' },
  { status: 'SHIPPED', title: 'Shipped' },
  { status: 'DELIVERED', title: 'Delivered' },
]

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function TrackShipmentScreen() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { order, isLoading, isError, error, refetch } = useOrderController(orderId)
  // Loaded separately: an order exists for a while before any parcel does, and
  // a failure to load tracking must not hide the order itself.
  const { parcels, hasShipments } = useOrderTrackingController(orderId)

  usePageMeta({ title: 'Track Shipment', noindex: true })

  const onBack = () => navigate(-1)
  const onViewDetails = (o) => navigate(userPath.order(o.id))

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 p-6" aria-busy="true" aria-label="Loading shipment">
          <div className="h-24 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
        </main>
      </div>
    )
  }

  // "Loading" and "this failed" used to be the same screen, which told a buyer
  // with a dropped connection that they had no order.
  if (isError || !order) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>
        <div className="flex flex-1 items-center justify-center p-6">
          <ErrorState
            error={error}
            title={error?.status === 404 ? 'Order not found' : undefined}
            description={error?.status === 404 ? 'This order does not exist, or it is not yours.' : undefined}
            onRetry={error?.status === 404 ? undefined : refetch}
            className="max-w-md"
          />
        </div>
        <div className="p-6 text-center">
          <button onClick={() => navigate(USER_ROUTES.ORDERS)} className="text-xs font-bold text-blue-600 hover:underline">
            Back to my orders
          </button>
        </div>
      </div>
    )
  }

  const historyByStatus = new Map(order.statusHistory.map((entry) => [entry.status, entry.at]))
  const currentIndex = FLOW.findIndex((step) => step.status === order.status)

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>

      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Track Shipment</h2>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {order.status}
              </span>
            </div>
            <div className="text-xs text-slate-600 pt-1">
              {order.items.length} item(s) · ₹{order.total.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Real courier scans, when there are any. The order-level flow below
              stays for the window before a parcel exists — and for sellers
              shipping by hand, who have no carrier scans at all. */}
          {hasShipments && parcels.map((parcel, index) => (
            <ParcelCard key={parcel.id} parcel={parcel} index={index} total={parcels.length} />
          ))}

          {order.status === 'CANCELLED' ? (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center space-x-3">
              <HiXCircle className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800">This order was cancelled</h3>
                <p className="text-xs text-red-600 mt-0.5">
                  Cancelled on {formatTime(historyByStatus.get('CANCELLED') || order.createdAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Shipment Status</h3>

              <div className="relative pl-6 space-y-6">
                <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-slate-200 -translate-x-1/2" />

                {FLOW.map((step, idx) => {
                  const at = historyByStatus.get(step.status)
                  const isCompleted = currentIndex > idx || (currentIndex === idx && step.status === 'DELIVERED')
                  const isActive = currentIndex === idx && step.status !== 'DELIVERED'

                  return (
                    <div key={step.status} className="relative flex items-start space-x-3">
                      <div className="absolute -left-6 top-0.5">
                        {isCompleted ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                            <HiCheck className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs ring-4 ring-emerald-100">
                            <HiTruck className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-300" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h4 className={`text-xs font-bold ${isCompleted || isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {at ? formatTime(at) : 'Pending'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => onViewDetails(order)}
            className="w-full bg-white hover:bg-slate-50 text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-600 shadow-xs transition-colors text-xs"
          >
            View Order Details
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}

// One parcel, with the courier's own scans.
//
// A multi-vendor order genuinely arrives in pieces, so each parcel is its own
// card with its own progress — collapsing them into one tracker would make a
// partial delivery look like a lost order.
function ParcelCard({ parcel, index, total }) {
  const isDelivered = parcel.status === 'DELIVERED'
  const isCancelled = parcel.status === 'CANCELLED'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {total > 1 ? `Parcel ${index + 1} of ${total}` : 'Your parcel'}
          </h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {parcel.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            isDelivered ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {parcel.status}
        </span>
      </div>

      {parcel.awbCode && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
          <span className="text-[11px] font-semibold text-slate-900">{parcel.courierName || 'Courier'}</span>
          <span className="font-mono text-[10px] text-slate-500">{parcel.awbCode}</span>
          {parcel.trackingUrl && (
            <a
              href={parcel.trackingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] font-bold text-blue-600 hover:underline"
            >
              Track on courier site
            </a>
          )}
        </div>
      )}

      {parcel.estimatedDeliveryAt && !isDelivered && (
        <p className="text-[11px] text-slate-600">Expected by {formatTime(parcel.estimatedDeliveryAt)}</p>
      )}

      {parcel.events.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          No courier updates yet. The first one usually appears once the parcel is collected.
        </p>
      ) : (
        <ol className="relative space-y-4 pl-6 pt-1">
          <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-slate-200 -translate-x-1/2" />
          {/* Newest first: where the parcel is now is what a buyer opened this
              screen to find out. */}
          {[...parcel.events].reverse().map((event, idx) => (
            <li key={`${event.occurredAt}-${idx}`} className="relative flex items-start space-x-3">
              <div className="absolute -left-6 top-0.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                    idx === 0 ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-white border-2 border-slate-300'
                  }`}
                >
                  {idx === 0 && <HiTruck className="w-3 h-3" />}
                </div>
              </div>
              <div className="flex-1">
                {/* The courier's own wording — it is what a buyer recognises
                    from their SMS. `event.status` is ours and may be null. */}
                <h4 className={`text-xs font-bold ${idx === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                  {event.carrierStatus}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  {formatTime(event.occurredAt)}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
