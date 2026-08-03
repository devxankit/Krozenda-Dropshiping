import React, { useState } from 'react'
import { HiMagnifyingGlass, HiAdjustmentsHorizontal, HiChevronRight, HiTruck, HiCheckCircle, HiArrowPath } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function OrderListScreen({ onSelectOrder = () => {} }) {
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const tabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

  const orders = [
    {
      id: 'KRO1234567890',
      date: 'Placed on 12 May 2024',
      status: 'Delivered',
      statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      itemsCount: 3,
      totalAmount: 49347,
      items: ['Samsung Galaxy S23 5G', 'boAt Airdopes 141', 'Portronics Power Bank'],
      thumbnails: ['/images/samsung_s23.png', '/images/boat_airdopes.png'],
    },
    {
      id: 'KRO1234567889',
      date: 'Placed on 08 May 2024',
      status: 'Shipped',
      statusColor: 'bg-amber-100 text-amber-800 border-amber-200',
      itemsCount: 2,
      totalAmount: 15999,
      items: ['iPhone 14 Protective Case', 'boAt Airdopes 141'],
      thumbnails: ['/images/boat_airdopes.png'],
    },
  ]

  const filteredOrders = orders.filter(
    (order) => activeTab === 'All' || order.status === activeTab
  )

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Header & Tabs */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">My Orders History</h1>
              <p className="text-xs text-slate-500 mt-1">Track pan-India shipments, download GST tax invoices, and request returns.</p>
            </div>

            {/* Order Search Bar */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2.5 w-full sm:w-72">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID or product..."
                className="w-full px-2 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center space-x-2 border-t border-slate-100 pt-3 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List Grid */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-4 overflow-hidden"
            >
              <div className="flex flex-row items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-slate-900 block truncate">Order #{order.id}</span>
                  <span className="text-[11px] text-slate-500 font-semibold block truncate">{order.date}</span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border ${order.statusColor}`}>
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Order Thumbnails & Description (Strict Flexbox Truncation Protection) */}
              <div className="flex items-center space-x-3 py-1 min-w-0 w-full">
                <div className="flex -space-x-2 overflow-hidden shrink-0">
                  {order.thumbnails.map((img, i) => (
                    <div key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      <img src={img} alt="Product" className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{order.items.join(', ')}</p>
                  <span className="text-[11px] text-slate-500 font-medium">{order.itemsCount} Items in Package</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                  <span className="text-sm sm:text-base font-black text-blue-700">₹{order.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform shrink-0">
                  <span className="hidden sm:inline">View Order Details</span>
                  <span className="sm:hidden">Details</span>
                  <HiChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
