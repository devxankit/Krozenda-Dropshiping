import React from 'react'
import { HiArrowLeft, HiArrowDownTray, HiPhone } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function OrderDetailsScreen({
  order = {
    id: 'KRO1234567890',
    date: 'Placed on 12 May 2024 at 10:30 AM',
    status: 'Delivered',
    statusColor: 'bg-emerald-100 text-emerald-700',
    totalAmount: 49298,
  },
  onBack = () => {},
  onDownloadInvoice = () => {},
  onTrackShipment = () => {},
}) {
  const items = [
    {
      id: 1,
      name: 'Samsung Galaxy S23 5G',
      subtitle: '(128GB, Phantom Black)',
      qty: 1,
      price: 49999,
      image: '/images/samsung_s23.png',
    },
    {
      id: 2,
      name: 'boAt Airdopes 141',
      subtitle: 'Wireless Earbuds',
      qty: 1,
      price: 1299,
      image: '/images/boat_airdopes.png',
    },
    {
      id: 3,
      name: 'Portronics Power Bank',
      subtitle: '10000mAh',
      qty: 1,
      price: 1199,
      image: '/images/iphone_14.png',
    },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Order Details</h2>
          </div>
          <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
            <HiPhone className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Order Header Card */}
          <div
            onClick={onTrackShipment}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2 cursor-pointer hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Order ID</span>
                <h3 className="text-sm font-black text-slate-900">{order.id}</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${order.statusColor}`}>
                {order.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">{order.date}</p>
          </div>

          {/* Order Summary Total Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Order Summary</span>
            <span className="text-sm font-black text-slate-900">
              ₹{order.totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Order Items Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Order Items
            </h3>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl p-1 shrink-0 flex items-center justify-center border border-slate-100">
                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{item.subtitle}</p>
                      <span className="text-[10px] text-slate-500 font-semibold">Qty: {item.qty}</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-900 ml-2">
                    ₹{item.price.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2">
              <button className="text-xs font-bold text-blue-600 hover:underline">
                View All Items
              </button>
            </div>
          </div>

          {/* Pricing Details Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Order Amount</span>
              <span className="font-semibold text-slate-900">₹52,497</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Discount</span>
              <span>- ₹3,000</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span className="font-bold text-emerald-600 uppercase">FREE</span>
            </div>
            <div className="border-t border-slate-100 pt-2.5 flex justify-between items-baseline font-bold">
              <span className="text-xs text-slate-900">Total Amount</span>
              <span className="text-sm font-black text-slate-900">₹49,298</span>
            </div>
          </div>

          {/* Download Invoice Button */}
          <button
            onClick={onDownloadInvoice}
            className="w-full bg-white hover:bg-slate-50 text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-600 shadow-xs transition-colors text-xs flex items-center justify-center space-x-2"
          >
            <HiArrowDownTray className="w-4 h-4" />
            <span>Download Invoice</span>
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}
