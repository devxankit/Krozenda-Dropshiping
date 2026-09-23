import { useState } from 'react'
import {
  HiArrowLeft,
  HiArrowDownTray,
  HiTruck,
  HiMapPin,
  HiCreditCard,
  HiArrowPath,
  HiShoppingCart,
  HiBuildingOffice2,
} from 'react-icons/hi2'
import { useNavigate, useParams } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrderController } from '../../controllers/useOrdersController'
import { reorderOrder } from '../../services/orderService'
import { useCartStore } from '../../../../lib/cartStore'

const STATUS_META = {
  PENDING: { label: 'Pending', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  PROCESSING: { label: 'Processing', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  SHIPPED: { label: 'Shipped', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
}

const PAYMENT_METHOD_LABEL = { COD: 'Cash on Delivery', WALLET: 'Krozenda Wallet', RAZORPAY: 'Online (Razorpay)' }

export function OrderDetailsScreen() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { order, isLoading, isError, error, refetch } = useOrderController(orderId)
  const [reordering, setReordering] = useState(false)
  const [reorderMessage, setReorderMessage] = useState(null)

  usePageMeta({ title: order ? `Order #${order.id.slice(-8).toUpperCase()}` : 'Order', noindex: true })

  const onBack = () => navigate(USER_ROUTES.ORDERS)
  const onDownloadInvoice = (o) => navigate(userPath.orderInvoice(o.id))
  const onTrackShipment = (o) => navigate(userPath.orderTrack(o.id))
  const onRequestReturn = () => navigate(USER_ROUTES.RETURNS)

  const handleReorder = async () => {
    if (!order) return
    try {
      setReordering(true)
      setReorderMessage(null)
      const res = await reorderOrder(order.id)
      await useCartStore.getState().hydrate()
      if (res.data?.addedCount > 0) {
        navigate(USER_ROUTES.CART)
      } else {
        setReorderMessage(res.message || 'Items from this order are currently out of stock')
      }
    } catch (err) {
      setReorderMessage(err?.response?.data?.message || 'Could not reorder items from this order')
    } finally {
      setReordering(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <div className="hidden md:block"><WebHeader /></div>
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-3 p-6" aria-busy="true" aria-label="Loading order">
          <div className="h-28 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-48 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
        </main>
      </div>
    )
  }

  // "Order not found" and "the request failed" are different situations, and
  // telling someone with a dropped connection that their order does not exist
  // is both wrong and alarming.
  if (isError || !order) {
    const notFound = error?.status === 404
    return (
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <div className="hidden md:block"><WebHeader /></div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <ErrorState
            error={error}
            title={notFound ? 'Order not found' : undefined}
            description={notFound ? 'This order does not exist, or it is not yours.' : undefined}
            onRetry={notFound ? undefined : refetch}
            className="w-full max-w-md"
          />
          <button onClick={onBack} className="text-xs font-bold text-blue-600 hover:underline">
            Back to my orders
          </button>
        </div>
      </div>
    )
  }

  const meta = STATUS_META[order.status] || STATUS_META.PENDING
  const address = order.shippingAddress

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700 shrink-0">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-base sm:text-2xl font-black text-slate-900 font-mono truncate">
                  Order #{order.id.slice(-8).toUpperCase()}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-black uppercase tracking-wider ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 flex-wrap gap-y-2">
            <button
              onClick={handleReorder}
              disabled={reordering}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <HiShoppingCart className="w-4 h-4" />
              <span>{reordering ? 'Adding to Cart…' : 'Reorder Items'}</span>
            </button>

            {order.status !== 'CANCELLED' && (
              <button
                onClick={() => onTrackShipment(order)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <HiTruck className="w-4 h-4" />
                <span>Track Package</span>
              </button>
            )}

            <button
              onClick={() => onDownloadInvoice(order)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 border border-slate-200"
            >
              <HiArrowDownTray className="w-4 h-4" />
              <span className="hidden sm:inline">Tax Invoice</span>
              <span className="sm:hidden">Invoice</span>
            </button>

            {order.status === 'DELIVERED' && (
              <button
                onClick={() => onRequestReturn(order)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 border border-slate-200"
              >
                <HiArrowPath className="w-4 h-4" />
                <span className="hidden sm:inline">Return / Replace</span>
                <span className="sm:hidden">Return</span>
              </button>
            )}
          </div>
        </div>

        {reorderMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <span>{reorderMessage}</span>
            <button onClick={() => setReorderMessage(null)} className="text-amber-900 font-bold ml-3 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <h3 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Purchased Items ({order.items.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                        <SmartImage
                          src={item.image}
                          alt={item.name}
                          sizes="64px"
                          ratio="1 / 1"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                        <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">Quantity: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {order.status === 'DELIVERED' && order.deliveredAt && (
              <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-3xl p-5 sm:p-6 shadow-md">
                <span className="text-[10px] text-emerald-200 font-extrabold uppercase tracking-widest block">Delivered</span>
                <h4 className="text-base sm:text-lg font-black">
                  Delivered on {new Date(order.deliveredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </h4>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {order.b2b?.isB2B && (
              <div className="bg-white rounded-3xl border border-blue-200/90 p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs">
                    <HiBuildingOffice2 className="w-4 h-4" />
                    <span>B2B Tax Invoice</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                    ITC Eligible
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="font-black text-slate-900 text-sm">
                    {order.b2b.companyName || address.fullName}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Buyer GSTIN: <span className="font-mono font-bold text-blue-700">{order.b2b.gstin}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 pt-1 leading-normal">
                    Input Tax Credit (ITC) has been claimed for this transaction under GST regulations.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs border-b border-slate-100 pb-3">
                <HiMapPin className="w-4 h-4" />
                <span>Shipping Address</span>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <p className="font-bold text-slate-900 text-sm">{address.fullName}</p>
                <p className="leading-relaxed">
                  {[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - {address.pincode}
                </p>
                <p className="font-semibold text-slate-800 pt-1">{address.phone}</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs border-b border-slate-100 pb-3">
                <HiCreditCard className="w-4 h-4" />
                <span>Payment Details</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Payment Mode</span>
                  <span className="font-bold text-slate-900">{PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900">₹{order.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                    <span>- ₹{order.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Fee</span>
                  <span className="font-semibold text-slate-900">
                    {order.shippingFee > 0 ? `₹${order.shippingFee.toLocaleString('en-IN')}` : 'FREE'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Status</span>
                  <span className={`font-bold ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : order.paymentStatus === 'FAILED' ? 'text-red-600' : 'text-amber-600'}`}>
                    {order.paymentStatus === 'PAID' ? 'Paid' : order.paymentStatus === 'FAILED' ? 'Failed' : order.paymentMethod === 'COD' ? 'Pay on Delivery' : 'Pending'}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount</span>
                  <span className="text-base text-blue-700">₹{order.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
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
