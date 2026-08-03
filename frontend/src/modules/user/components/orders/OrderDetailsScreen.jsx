import React from 'react'
import { HiArrowLeft, HiArrowDownTray, HiPhone, HiTruck, HiShieldCheck, HiMapPin, HiCreditCard } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

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
    { id: 3, name: 'Portronics Power Bank', subtitle: '10000mAh', qty: 1, price: 1199, image: '/images/boat_airdopes.png' },
  ]

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
                <h1 className="text-base sm:text-2xl font-black text-slate-900 font-mono truncate">Order #{order.id}</h1>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-black uppercase tracking-wider ${order.statusColor}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{order.date}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <button
              onClick={onTrackShipment}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <HiTruck className="w-4 h-4" />
              <span>Track Package</span>
            </button>

            <button
              onClick={onDownloadInvoice}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 border border-slate-200"
            >
              <HiArrowDownTray className="w-4 h-4" />
              <span className="hidden sm:inline">GST Tax Invoice</span>
              <span className="sm:hidden">Invoice</span>
            </button>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Left Column: Order Items & Delivery Tracking */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <h3 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Purchased Items ({items.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-2xl p-1 shrink-0 border border-slate-100 flex items-center justify-center">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-[11px] text-slate-500 font-medium truncate">{item.subtitle}</p>
                        <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">Quantity: {item.qty}</span>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Courier Status Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest block">Shiprocket Courier Partner</span>
                <h4 className="text-base sm:text-lg font-black">Delhivery Air Express (#DEL9847291)</h4>
                <p className="text-xs text-blue-200">Package delivered on 15 May 2024 at 02:45 PM</p>
              </div>
              <button
                onClick={onTrackShipment}
                className="bg-white text-blue-900 font-bold text-xs px-4 py-2 rounded-xl shadow-sm self-start sm:self-auto shrink-0"
              >
                Track Live →
              </button>
            </div>
          </div>

          {/* Right Column: Address & Payment Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs border-b border-slate-100 pb-3">
                <HiMapPin className="w-4 h-4" />
                <span>Shipping Address</span>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <p className="font-bold text-slate-900 text-sm">Rahul Sharma</p>
                <p className="leading-relaxed">123, Sunrise Apartments, SG Highway, Ahmedabad, Gujarat - 380051</p>
                <p className="font-semibold text-slate-800 pt-1">+91 98765 43210</p>
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
                  <span className="font-bold text-slate-900">UPI (Google Pay)</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Status</span>
                  <span className="font-bold text-emerald-600">Paid & Verified</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount Paid</span>
                  <span className="text-base text-blue-700">₹{order.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
