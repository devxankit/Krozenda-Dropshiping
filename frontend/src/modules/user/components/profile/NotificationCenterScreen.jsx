import { useEffect, useState } from 'react'
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
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { EmptyResult, ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useNotificationStore } from '../../../../lib/notificationStore'
import { usePageMeta } from '../../../../lib/usePageMeta'

const TYPE_ICON = {
  ORDER: { Icon: HiTruck, iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  OFFER: { Icon: HiTag, iconColor: 'bg-amber-50 text-amber-600 border border-amber-200' },
  WALLET: { Icon: HiWallet, iconColor: 'bg-indigo-50 text-indigo-600 border border-indigo-200' },
  SYSTEM: { Icon: HiSparkles, iconColor: 'bg-blue-50 text-blue-600 border border-blue-200' },
}

const ACTION_LABEL = { ORDER: 'View order', WALLET: 'Check wallet' }

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

export function NotificationCenterScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All')
  const notifications = useNotificationStore((state) => state.notifications)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const pagination = useNotificationStore((state) => state.pagination)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const hydrate = useNotificationStore((state) => state.hydrate)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const deleteNotification = useNotificationStore((state) => state.remove)

  usePageMeta({ title: 'Notifications', noindex: true })

  useEffect(() => {
    hydrate({ page: 1 })
  }, [hydrate])

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'Orders') return item.type === 'ORDER'
    if (activeTab === 'Promotions') return item.type === 'OFFER'
    if (activeTab === 'Wallet') return item.type === 'WALLET'
    return true
  })

  // Tapping a notification takes the buyer to the thing it is ABOUT, using the
  // id the notification carries — previously every order notification dumped
  // them on the order LIST and left them to find it. This is also what makes a
  // push-notification deep link land somewhere useful (§126).
  //
  // The id is never trusted: it is a path parameter on a route whose data the
  // API scopes to the authenticated buyer, so a notification naming somebody
  // else's order resolves to a 404, not their order.
  const handleAction = (item) => {
    markAsRead(item.id)
    if (item.actionType === 'ORDER') {
      navigate(item.actionRefId ? userPath.order(item.actionRefId) : USER_ROUTES.ORDERS)
    } else if (item.actionType === 'WALLET') {
      navigate(USER_ROUTES.PROFILE)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-5">
        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            >
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
        {isLoading && notifications.length === 0 ? (
          <ListSkeleton count={4} />
        ) : filteredNotifications.length === 0 ? (
          <EmptyResult
            icon={'\uD83D\uDD14'}
            title={activeTab === 'All' ? 'No notifications yet' : `No ${activeTab.toLowerCase()} notifications`}
            description={
              activeTab === 'All'
                ? 'Order updates, shipping alerts and offers will appear here.'
                : 'Try a different tab to see your other notifications.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => {
              const { Icon: NotificationIcon, iconColor } = TYPE_ICON[item.type] || TYPE_ICON.SYSTEM
              const actionLabel = ACTION_LABEL[item.actionType]
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex items-start justify-between gap-3 ${
                    !item.isRead ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      <NotificationIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-xs font-bold text-slate-900">{item.title}</h2>
                        <time
                          dateTime={item.createdAt}
                          className="shrink-0 text-[10px] font-medium text-slate-400"
                        >
                          {formatTime(item.createdAt)}
                        </time>
                      </div>
                      <p className="text-xs leading-normal text-slate-600">{item.message}</p>
                      <div className="flex items-center gap-3 pt-1">
                        {actionLabel && (
                          <button
                            type="button"
                            onClick={() => handleAction(item)}
                            className="inline-flex items-center space-x-0.5 text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            <span>{actionLabel}</span>
                            <HiChevronRight className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(item.id)}
                            className="text-[11px] font-bold text-slate-500 hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteNotification(item.id)}
                    aria-label={`Delete notification: ${item.title}`}
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <HiTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Paged rather than "the most recent 100, take it or leave it". */}
        {pagination?.hasNextPage && (
          <button
            type="button"
            onClick={() => hydrate({ page: pagination.page + 1 })}
            disabled={isLoading}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : 'Load older notifications'}
          </button>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
