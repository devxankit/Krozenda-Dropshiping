import React from 'react'
import { HiArrowLeft, HiArrowDownTray, HiPhone, HiTruck, HiShieldCheck, HiMapPin, HiCreditCard } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function OrderDetailsScreen({
  order = {
    id: 'KRO1234567890',
    date: 'Placed on 12 May 2024 at 10:30 AM',
    status: 'Delivered',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    totalAmount: 49347,
  },
  onBack = () => {},
  onDownloadInvoice = () => {},
  onTrackShipment = () => {},
}) {
  const items = [
    { id: 1, name: 'Samsung Galaxy S23 5G', subtitle: '(128GB, Phantom Black)', qty: 1, price: 49999, image: '/images/samsung_s23.png' },
    { id: 2, name: 'boAt Airdopes 141', subtitle: 'Wireless Earbuds', qty: 1, price: 1299, image: '/images/boat_airdopes.png' },
    { id: 3, name: 'Portronics Power Bank', subtitle: '10000mAh', qty: 1, price: 1199, image: '/images/iphone_14.png' },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 font-mono">Order #{order.id}</h1>
                <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${order.statusColor}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{order.date}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onTrackShipment}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <HiTruck className="w-4 h-4" />
              <span>Track Package</span>
            </button>

            <button
              onClick={onDownloadInvoice}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 border border-slate-200"
            >
              <HiArrowDownTray className="w-4 h-4" />
              <span>GST Tax Invoice</span>
            </button>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Order Items & Delivery Tracking */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Purchased Items ({items.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-xs text-slate-500 font-medium truncate">{item.subtitle}</p>
                        <span className="text-xs text-slate-400 font-semibold block mt-0.5">Quantity: {item.qty}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Courier Status Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-6 shadow-md flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-blue-300 font-extrabold uppercase tracking-widest block">Shiprocket Courier Partner</span>
                <h4 className="text-lg font-black">Delhivery Air Express (#DEL9847291)</h4>
                <p className="text-xs text-blue-200">Package delivered on 15 May 2024 at 02:45 PM</p>
              </div>
              <button
                onClick={onTrackShipment}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl transition-all shadow-md shrink-0"
              >
                Track Live
              </button>
            </div>
          </div>

          {/* Right Column: Address & Payment Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Shipping & Payment Details
              </h3>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-1 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center space-x-1">
                    <HiMapPin className="w-3.5 h-3.5" />
                    <span>Shipping Address</span>
                  </span>
                  <p className="font-bold text-slate-900 text-sm">Rahul Sharma</p>
                  <p className="text-slate-600 leading-relaxed">123, Sunrise Apartments, SG Highway, Ahmedabad, Gujarat - 380051</p>
                  <p className="font-semibold text-slate-800 pt-1">+91 98765 43210</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center space-x-1">
                    <HiCreditCard className="w-3.5 h-3.5" />
                    <span>Payment Method</span>
                  </span>
                  <p className="font-bold text-slate-900">UPI (Google Pay)</p>
                  <div className="border-t border-slate-200/60 pt-2 space-y-1.5 text-slate-600">
                    <div className="flex justify-between"><span>Items Total</span><span className="font-bold text-slate-900">₹52,497</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Discount</span><span className="font-bold">- ₹3,199</span></div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                      <span>Total Paid</span>
                      <span className="text-blue-700">₹{order.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
