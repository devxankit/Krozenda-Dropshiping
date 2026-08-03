import React, { useState } from 'react'
import { HiMagnifyingGlass, HiAdjustmentsHorizontal, HiChevronRight, HiTruck, HiCheckCircle, HiArrowPath } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

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
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header & Tabs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">My Orders History</h1>
              <p className="text-xs text-slate-500 mt-1">Track pan-India shipments, download GST tax invoices, and request returns.</p>
            </div>

            {/* Order Search Bar */}
            <div className="relative w-full sm:w-80">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by Order ID or Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-2 border-t border-slate-100 pt-3 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Order Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-black text-slate-900 block">{order.id}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{order.date}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${order.statusColor}`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center space-x-3 py-1">
                  <div className="flex -space-x-2 overflow-hidden">
                    {order.thumbnails.map((img, i) => (
                      <div key={i} className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        <img src={img} alt="Product" className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{order.items.join(', ')}</p>
                    <span className="text-[11px] text-slate-500 font-medium">{order.itemsCount} Items in Package</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                  <span className="text-base font-black text-blue-700">₹{order.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                  <span>View Order Details</span>
                  <HiChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
