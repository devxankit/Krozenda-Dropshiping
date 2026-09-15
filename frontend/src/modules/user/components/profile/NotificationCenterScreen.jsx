import React, { useEffect, useState } from 'react'
import {
  HiArrowLeft,
  HiTruck,
  HiTag,
  HiCheckCircle,
  HiSparkles,
  HiTrash,
  HiChevronRight,
  HiWallet,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'
import { useNotificationStore } from '../../../../lib/notificationStore'

const TYPE_ICON = {
  ORDER: { Icon: HiTruck, iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  OFFER: { Icon: HiTag, iconColor: 'bg-amber-50 text-amber-600 border border-amber-200' },
  WALLET: { Icon: HiWallet, iconColor: 'bg-indigo-50 text-indigo-600 border border-indigo-200' },
  SYSTEM: { Icon: HiSparkles, iconColor: 'bg-blue-50 text-blue-600 border border-blue-200' },
}

const ACTION_LABEL = { ORDER: 'View Orders', WALLET: 'Check Wallet' }

function formatTime(iso) {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function NotificationCenterScreen({ onBack = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All')
  const notifications = useNotificationStore((state) => state.notifications)
  const hydrate = useNotificationStore((state) => state.hydrate)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const deleteNotification = useNotificationStore((state) => state.remove)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'Orders') return item.type === 'ORDER'
    if (activeTab === 'Promotions') return item.type === 'OFFER'
    if (activeTab === 'Wallet') return item.type === 'WALLET'
    return true
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleAction = (item) => {
    markAsRead(item.id)
    if (item.actionType === 'ORDER') navigate(USER_ROUTES.ROOT + '/orders')
    else if (item.actionType === 'WALLET') navigate(USER_ROUTES.ROOT + '/profile')
  }

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

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1"
            >
              <HiCheckCircle className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          )}
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
              const { Icon: NotificationIcon, iconColor } = TYPE_ICON[item.type] || TYPE_ICON.SYSTEM
              const actionLabel = ACTION_LABEL[item.actionType]
              return (
                <div
                  key={item.id}
                  onClick={() => !item.isRead && markAsRead(item.id)}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    !item.isRead ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      <NotificationIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">{formatTime(item.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-normal">{item.message}</p>
                      {actionLabel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAction(item)
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:underline pt-1 inline-flex items-center space-x-0.5"
                        >
                          <span>{actionLabel}</span>
                          <HiChevronRight className="w-3 h-3" />
                        </button>
                      )}
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
