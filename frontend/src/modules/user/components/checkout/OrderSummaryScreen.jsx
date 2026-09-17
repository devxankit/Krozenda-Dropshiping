import { useEffect, useState } from 'react'
import { HiArrowLeft, HiShieldCheck, HiPencilSquare, HiMapPin, HiTruck, HiChevronRight, HiTag, HiXMark, HiExclamationTriangle } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { useCartStore } from '../../../../lib/cartStore'
import { SHIPPING_OPTIONS, useCheckoutStore } from '../../../../lib/checkoutStore'
import { USER_ROUTES } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useAddressesController } from '../../controllers/useAddressesController'
import { useApplyCouponController } from '../../controllers/useCouponsController'

export function OrderSummaryScreen() {
  const navigate = useNavigate()
  const cartItems = useCartStore((s) => s.items)
  const summary = useCartStore((s) => s.summary)
  const hydrateCart = useCartStore((s) => s.hydrate)
  const { addresses } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const shippingFee = useCheckoutStore((s) => s.shippingFee)
  const appliedCoupon = useCheckoutStore((s) => s.appliedCoupon)
  const setAppliedCoupon = useCheckoutStore((s) => s.setAppliedCoupon)
  const clearCoupon = useCheckoutStore((s) => s.clearCoupon)

  const { applyCoupon, isApplying, error: couponError, reset: resetCouponError } = useApplyCouponController()
  const [couponInput, setCouponInput] = useState('')

  usePageMeta({ title: 'Order Summary', noindex: true })

  // Last stop before payment: re-read the cart so a price change, a stock drop
  // or a delisting that happened while the buyer was picking an address is
  // reflected in the total they are about to agree to.
  useEffect(() => {
    hydrateCart()
  }, [hydrateCart])

  const onBack = () => navigate(USER_ROUTES.CHECKOUT_DELIVERY)
  const onEditCart = () => navigate(USER_ROUTES.CART)

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.fee === shippingFee) || SHIPPING_OPTIONS[0]

  // Server-computed when signed in. The figures below are a PREVIEW — the
  // order endpoint recomputes every one of them from the buyer's own cart,
  // address and coupon before anything is charged, and refuses a mismatch.
  const subtotal = summary?.subtotal ?? cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const discount = appliedCoupon?.discountAmount || 0
  const finalTotal = Math.max(0, subtotal - discount + shippingFee)

  // Anything that will make the order endpoint refuse, surfaced here rather
  // than after the buyer has chosen a payment method.
  const blockedItems = cartItems.filter(
    (item) =>
      item.availability === 'UNAVAILABLE' ||
      item.availability === 'OUT_OF_STOCK' ||
      item.availability === 'INSUFFICIENT_STOCK',
  )
  const priceChangedItems = cartItems.filter((item) => item.priceChanged)

  // Arriving without the earlier steps (deep link, reload after the address
  // was deleted, an emptied cart) has nothing to summarise.
  useEffect(() => {
    if (cartItems.length === 0) {
      navigate(USER_ROUTES.CART, { replace: true })
    } else if (!selectedAddressId) {
      navigate(USER_ROUTES.CHECKOUT_ADDRESS, { replace: true })
    }
  }, [cartItems.length, selectedAddressId, navigate])

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    resetCouponError()
    try {
      const result = await applyCoupon(couponInput.trim())
      setAppliedCoupon(result)
    } catch {
      // couponError below already surfaces the backend's message
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Responsive Stepper */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Mobile Stepper */}
          <div className="sm:hidden flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="text-blue-700 font-black">Step 3 of 4: Order Summary</span>
            <span className="text-slate-400">Next: Payment</span>
          </div>

          {/* Desktop Stepper */}
          <div className="hidden sm:flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Address</span>
            </div>
            <div className="h-0.5 bg-emerald-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Delivery</span>
            </div>
            <div className="h-0.5 bg-blue-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-blue-700">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px]">3</span>
              <span className="font-black">Summary</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">4</span>
              <span>Payment</span>
            </div>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-3">
                <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base sm:text-xl font-black text-slate-900">Review Order Details</h1>
              </div>
              <button onClick={onEditCart} className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1">
                <HiPencilSquare className="w-4 h-4" />
                <span>Edit Items</span>
              </button>
            </div>

            {/* Shipping & Delivery Address Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1 shadow-xs">
                <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs mb-1">
                  <HiMapPin className="w-4 h-4" />
                  <span>Deliver To</span>
                </div>
                {selectedAddress ? (
                  <>
                    <p className="text-xs font-bold text-slate-900">
                      {selectedAddress.fullName} ({selectedAddress.type})
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.pincode}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 pt-1">{selectedAddress.phone}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">No address selected</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1 shadow-xs">
                <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs mb-1">
                  <HiTruck className="w-4 h-4" />
                  <span>Delivery Speed</span>
                </div>
                <p className="text-xs font-bold text-slate-900">{shippingOption.label}</p>
                <p className="text-xs text-slate-500">{shippingOption.description}</p>
                <span className="inline-block mt-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {shippingFee === 0 ? 'FREE SHIPPING' : `₹${shippingFee} SHIPPING`}
                </span>
              </div>
            </div>

            {/* Itemized Order List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Order Items ({cartItems.length})
              </h3>
              {cartItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">Your cart is empty.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <SmartImage
                          src={item.image}
                          srcSet={item.imageSrcSet}
                          sizes="56px"
                          alt={item.name}
                          ratio="1 / 1"
                          className="w-14 shrink-0 rounded-xl border border-slate-100"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{item.variant}</p>
                          <span className="text-xs text-slate-400 font-semibold">Qty: {item.quantity}</span>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coupon Code */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <HiTag className="w-4 h-4 text-blue-600" />
                <span>Have a Coupon Code?</span>
              </h3>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-xs font-bold text-emerald-800">
                    {'“'}{appliedCoupon.code}{'”'} applied — you saved ₹{appliedCoupon.discountAmount.toLocaleString('en-IN')}
                  </span>
                  <button onClick={clearCoupon} className="text-emerald-700 hover:text-emerald-900">
                    <HiXMark className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isApplying || !couponInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shrink-0"
                  >
                    {isApplying ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-xs font-semibold text-red-600">{couponError.message}</p>}
            </div>
          </div>

          {/* Right Column Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-md space-y-5 lg:sticky lg:top-24">
              <h3 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Final Payment Breakdown
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Coupon Discount ({appliedCoupon.code})</span>
                    <span>- ₹{discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Fee</span>
                  <span className={shippingFee === 0 ? 'font-bold text-emerald-600' : 'font-semibold text-slate-900'}>
                    {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount Payable</span>
                  <span className="text-base text-blue-700">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-100 flex items-center space-x-2 text-[11px] font-semibold text-blue-800">
                <HiShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <span>GST Tax Invoice included for input tax credit claiming</span>
              </div>

              {priceChangedItems.length > 0 && (
                <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800">
                  {priceChangedItems.length === 1
                    ? 'The price of one item changed since you added it. The total above is current.'
                    : `Prices changed on ${priceChangedItems.length} items since you added them. The total above is current.`}
                </p>
              )}

              {blockedItems.length > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700"
                >
                  <HiExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {blockedItems.length === 1
                      ? `"${blockedItems[0].name}" can no longer be ordered as-is.`
                      : `${blockedItems.length} items can no longer be ordered as-is.`}{' '}
                    <button type="button" onClick={onEditCart} className="font-bold underline">
                      Review your cart
                    </button>
                  </span>
                </div>
              )}

              <button
                onClick={() => navigate(USER_ROUTES.CHECKOUT_PAYMENT)}
                disabled={cartItems.length === 0 || !selectedAddress || blockedItems.length > 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <span>Proceed to Payment</span>
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
