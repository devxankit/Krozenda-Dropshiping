import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiTruck,
  HiTag,
  HiCheckCircle,
  HiSparkles,
  HiTrash,
  HiChevronRight,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { useNotificationStore } from '../../../../lib/notificationStore'

const TYPE_ICON = {
  order: { Icon: HiTruck, iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  offer: { Icon: HiTag, iconColor: 'bg-amber-50 text-amber-600 border border-amber-200' },
  system: { Icon: HiSparkles, iconColor: 'bg-blue-50 text-blue-600 border border-blue-200' },
}

export function NotificationCenterScreen({ onBack = () => {} }) {
  const [activeTab, setActiveTab] = useState('All')
  const notifications = useNotificationStore((state) => state.notifications)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const deleteNotification = useNotificationStore((state) => state.remove)

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'Orders') return item.type === 'order'
    if (activeTab === 'Promotions') return item.type === 'offer'
    if (activeTab === 'Wallet') return item.type === 'system'
    return true
  })

  const unreadCount = notifications.filter((n) => n.isUnread).length

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-5">
        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Order updates, shipping alerts and offers</p>
            </div>
          </div>

          <button
            onClick={markAllRead}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1"
          >
            <HiCheckCircle className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
          {['All', 'Orders', 'Promotions', 'Wallet'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications Feed */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <p className="text-xs font-bold text-slate-500">No notifications in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => {
              const { Icon: NotificationIcon, iconColor } = TYPE_ICON[item.type] || TYPE_ICON.system
              return (
                <div
                  key={item.id}
                  onClick={() => item.isUnread && markAsRead(item.id)}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    item.isUnread ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      <NotificationIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-normal">{item.message}</p>
                      <button className="text-[11px] font-bold text-blue-600 hover:underline pt-1 inline-flex items-center space-x-0.5">
                        <span>{item.actionLabel}</span>
                        <HiChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(item.id)
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg shrink-0 mt-0.5"
                  >
                    <HiTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
