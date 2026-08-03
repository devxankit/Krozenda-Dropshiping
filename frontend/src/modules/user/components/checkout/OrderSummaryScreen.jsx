import React from 'react'
import { HiArrowLeft, HiShieldCheck, HiPencilSquare, HiMapPin, HiTruck } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function OrderSummaryScreen({ onBack = () => {}, onEditCart = () => {}, onProceedToPayment = () => {} }) {
  const cartItems = [
    { id: 1, name: 'Samsung Galaxy S23 5G', subtitle: 'Phantom Black, 128GB', price: 49999, qty: 1, image: '/images/samsung_s23.png' },
    { id: 2, name: 'boAt Airdopes 141', subtitle: 'Wireless Earbuds', price: 1299, qty: 1, image: '/images/boat_airdopes.png' },
    { id: 3, name: 'Portronics Power Bank', subtitle: '10000mAh', price: 1199, qty: 1, image: '/images/iphone_14.png' },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Stepper */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 mb-6 shadow-xs">
          <div className="flex items-center justify-around max-w-2xl mx-auto text-xs font-bold">
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
              <span className="font-extrabold">Summary</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">4</span>
              <span>Payment</span>
            </div>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-3">
                <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg md:text-xl font-black text-slate-900">Review Order Details</h1>
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
                <p className="text-xs font-bold text-slate-900">Rahul Sharma (Home)</p>
                <p className="text-xs text-slate-500">123, Sunrise Apartments, SG Highway, Ahmedabad, 380051</p>
                <p className="text-xs font-semibold text-slate-700 pt-1">+91 98765 43210</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1 shadow-xs">
                <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs mb-1">
                  <HiTruck className="w-4 h-4" />
                  <span>Delivery Speed</span>
                </div>
                <p className="text-xs font-bold text-slate-900">Standard Express Delivery</p>
                <p className="text-xs text-slate-500">Expected arrival in 3-5 business days</p>
                <span className="inline-block mt-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  FREE SHIPPING
                </span>
              </div>
            </div>

            {/* Itemized Order List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Order Items ({cartItems.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {cartItems.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-14 h-14 bg-slate-50 rounded-xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                        <span className="text-xs text-slate-400 font-semibold">Qty: {item.qty}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900 shrink-0">
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column Price Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Final Payment Breakdown
              </h3>

              <div className="space-y-3 text-xs font-medium text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal (3 Items)</span>
                  <span className="font-bold text-slate-900">₹52,497</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Special Wholesale Discount</span>
                  <span className="font-bold">- ₹3,199</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span>Secure Packaging</span>
                  <span className="font-bold text-slate-900">₹49</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Payable</span>
                  <span className="text-blue-700 text-lg">₹49,347</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex items-center space-x-2 text-[11px] font-semibold text-slate-600">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Protected by KroZenda Buyer Protection</span>
              </div>

              <button
                onClick={onProceedToPayment}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Proceed to Payment →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
