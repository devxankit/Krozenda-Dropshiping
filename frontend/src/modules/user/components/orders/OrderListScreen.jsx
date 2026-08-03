import React, { useState } from 'react'
import { HiMagnifyingGlass, HiAdjustmentsHorizontal, HiChevronRight } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function OrderListScreen({ onSelectOrder = () => {} }) {
  const [activeTab, setActiveTab] = useState('All')
  const tabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
  const orders = [
    { id: 'KRO1234567890', date: 'Placed on 12 May 2024', status: 'Delivered', statusColor: 'bg-emerald-100 text-emerald-700', itemsCount: 3, totalAmount: 49298, thumbnails: ['/images/samsung_s23.png', '/images/boat_airdopes.png'] },
    { id: 'KRO1234567889', date: 'Placed on 08 May 2024', status: 'Shipped', statusColor: 'bg-amber-100 text-amber-700', itemsCount: 2, totalAmount: 15999, thumbnails: ['/images/boat_airdopes.png'] },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex justify-between items-center"><h2 className="text-base font-bold">My Orders</h2></div>
        <div className="bg-white border-b px-4 py-2 flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-1 text-xs font-bold ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>{tab}</button>
          ))}
        </div>
        <div className="p-4 space-y-3">
          {orders.map((order) => (
            <div key={order.id} onClick={() => onSelectOrder(order)} className="bg-white rounded-2xl border p-4 shadow-xs space-y-3 cursor-pointer">
              <div className="flex justify-between"><div><span className="text-xs font-black">{order.id}</span><p className="text-[10px] text-slate-400">{order.date}</p></div><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.statusColor}`}>{order.status}</span></div>
              <div className="flex justify-between text-xs font-bold text-blue-600"><span>View Details</span><HiChevronRight className="w-4 h-4" /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}
