import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiBell,
  HiTruck,
  HiTag,
  HiCheckCircle,
  HiSparkles,
} from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function NotificationCenterScreen({
  onBack = () => {},
}) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'order',
      title: 'Order Delivered Successfully!',
      message: 'Your order #KRO1234567890 with Samsung S23 has been delivered.',
      time: '10 mins ago',
      isUnread: true,
      group: 'Today',
      Icon: HiTruck,
      iconColor: 'bg-emerald-100 text-emerald-600',
    },
    {
      id: 2,
      type: 'offer',
      title: 'Flash Sale Live Now! 🔥',
      message: 'Get up to 60% OFF on B2B bulk orders. Limited time deal.',
      time: '2 hours ago',
      isUnread: true,
      group: 'Today',
      Icon: HiTag,
      iconColor: 'bg-amber-100 text-amber-600',
    },
    {
      id: 3,
      type: 'system',
      title: 'Wallet Cashback Credited',
      message: '₹250 cashback credited to your Krozenda Wallet.',
      time: 'Yesterday, 4:30 PM',
      isUnread: false,
      group: 'Yesterday',
      Icon: HiSparkles,
      iconColor: 'bg-purple-100 text-purple-600',
    },
    {
      id: 4,
      type: 'order',
      title: 'Shipment Out for Delivery',
      message: 'Agent Rajesh will deliver your package today between 3-6 PM.',
      time: '12 May 2024',
      isUnread: false,
      group: 'Earlier',
      Icon: HiCheckCircle,
      iconColor: 'bg-blue-100 text-blue-600',
    },
  ])

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isUnread: false })))
  }

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
            <h2 className="text-base font-bold text-slate-900">Notifications</h2>
          </div>
          <button
            onClick={markAllRead}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Mark all read
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex space-x-2 text-xs font-bold">
          <button className="px-3 py-1 rounded-full bg-blue-600 text-white shadow-xs">All</button>
          <button className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">Orders</button>
          <button className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">Offers</button>
          <button className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">Updates</button>
        </div>

        {/* Notification List */}
        <div className="p-4 space-y-3">
          {notifications.map((item) => {
            const IconComp = item.Icon

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  item.isUnread
                    ? 'bg-white border-blue-200 shadow-xs ring-1 ring-blue-500/10'
                    : 'bg-white/80 border-slate-200/70'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.iconColor}`}>
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      {item.isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-2" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium mt-1.5 block">
                      {item.time}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
