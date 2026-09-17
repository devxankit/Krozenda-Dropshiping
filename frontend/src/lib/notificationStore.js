// Shared buyer-app notification feed, backed by the real /user/notifications
// API — mirrors cartStore/wishlistStore's pattern (local state + hydrate on
// auth + optimistic local update alongside the backend call) rather than
// the zod/react-query layering modules/user/ uses, since this is consumed
// from the shared WebHeader (outside modules/user) exactly like cart/wishlist
// counts are.
import { create } from 'zustand'
import { api } from './axios'
import { useAuthStore } from './authStore'
import { onForegroundMessage, requestPushToken } from './firebase'

// FCM only invokes the service worker's background handler when the tab is
// NOT focused — a push that arrives while the buyer is looking at the page
// has to be surfaced by hand, once per session.
let listeningForPush = false

function watchForegroundPush() {
  if (listeningForPush) return
  listeningForPush = true
  onForegroundMessage((payload) => {
    const { title, body } = payload.notification || {}
    if (title && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/images/logo.png' })
    }
  })
}

// Best-effort: a declined permission, an unsupported browser, or a device
// that already registered this token must never surface as an error — push
// is a nice-to-have on top of the in-app feed, not a login requirement.
async function registerPushToken() {
  try {
    const token = await requestPushToken()
    if (token) {
      await api.post('/fcm-token', { token, deviceType: 'app' })
      watchForegroundPush()
    }
  } catch {
    // Ignored — see comment above.
  }
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  // Reported by the server across the WHOLE feed, not derived from the page
  // that happens to be loaded — the header badge was previously counting
  // unread items among whichever 100 rows had been fetched.
  unreadCount: 0,
  pagination: null,
  isLoading: false,

  hydrate: async ({ page = 1 } = {}) => {
    if (!useAuthStore.getState().isAuthenticated) return
    set({ isLoading: true })
    try {
      const { data } = await api.get('/user/notifications', { params: { page, limit: 20 } })
      const payload = data?.data
      if (payload?.items) {
        set((state) => ({
          // Page 1 replaces; later pages append, so "load more" accumulates.
          notifications: page === 1 ? payload.items : [...state.notifications, ...payload.items],
          unreadCount: payload.unreadCount ?? 0,
          pagination: data.pagination ?? null,
        }))
      }
    } catch {
      // Keep whatever was loaded before if the refresh fails.
    } finally {
      set({ isLoading: false })
    }
    registerPushToken()
  },

  markAsRead: (id) => {
    const target = get().notifications.find((n) => n.id === id)
    if (!target || target.isRead) return
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
    api.patch(`/user/notifications/${id}/read`).catch(() => {})
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }))
    api.patch('/user/notifications/read-all').catch(() => {})
  },

  remove: (id) => {
    set((state) => {
      const target = state.notifications.find((n) => n.id === id)
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      }
    })
    api.delete(`/user/notifications/${id}`).catch(() => {})
  },
}))

export const useUnreadNotificationCount = () => useNotificationStore((state) => state.unreadCount)

if (useAuthStore.getState().isAuthenticated) {
  useNotificationStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useNotificationStore.getState().hydrate()
  }
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    // Sign-out must not leave the previous buyer's notifications (or their
    // unread badge) on the device.
    useNotificationStore.setState({ notifications: [], unreadCount: 0, pagination: null })
  }
})
