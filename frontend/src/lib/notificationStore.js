// Shared buyer-app notification feed. There's no backend notification
// service yet, so this is still seeded data — but it's shared state now,
// which means the header bell dot reflects real unread count and clears
// when the user actually reads their notifications, instead of a bell dot
// that was hardcoded to always show regardless of what happened.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SEED_NOTIFICATIONS = [
  {
    id: 1,
    type: 'order',
    title: 'Order Delivered',
    message: 'Your order #KRO1234567890 (Samsung S23 5G) has been delivered successfully.',
    time: '10 mins ago',
    isUnread: true,
    actionLabel: 'View Order',
  },
  {
    id: 2,
    type: 'offer',
    title: 'Flash Sale Live 🔥',
    message: 'Get up to 60% OFF on B2B electronics bulk orders. Code: KROZ10.',
    time: '2 hours ago',
    isUnread: true,
    actionLabel: 'View Deals',
  },
  {
    id: 3,
    type: 'system',
    title: 'Cashback Credited',
    message: '₹250 promo cashback credited to your KroZenda Wallet.',
    time: 'Yesterday',
    isUnread: false,
    actionLabel: 'Check Wallet',
  },
  {
    id: 4,
    type: 'order',
    title: 'Shipment Dispatched',
    message: 'Package containing boAt Airdopes 141 has been dispatched via Delhivery Air.',
    time: '2 days ago',
    isUnread: false,
    actionLabel: 'Track Package',
  },
]

export const useNotificationStore = create(
  persist(
    (set) => ({
      notifications: SEED_NOTIFICATIONS,

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, isUnread: false } : n)),
        }))
      },

      markAllRead: () => {
        set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, isUnread: false })) }))
      },

      remove: (id) => {
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }))
      },

      clear: () => set({ notifications: [] }),
    }),
    { name: 'krozenda.notifications' },
  ),
)

export const useUnreadNotificationCount = () =>
  useNotificationStore((state) => state.notifications.filter((n) => n.isUnread).length)
