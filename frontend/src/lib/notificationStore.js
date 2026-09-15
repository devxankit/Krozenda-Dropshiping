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
      await api.post('/user/notifications/fcm-token', { token })
      watchForegroundPush()
    }
  } catch {
    // Ignored — see comment above.
  }
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  hydrate: async () => {
    if (!useAuthStore.getState().isAuthenticated) return
    try {
      const { data } = await api.get('/user/notifications')
      if (data?.data?.items) set({ notifications: data.data.items })
    } catch {
      // Keep whatever was loaded before if the refresh fails.
    }
    registerPushToken()
  },

  markAsRead: (id) => {
    const target = get().notifications.find((n) => n.id === id)
    if (!target || target.isRead) return
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    }))
    api.patch(`/user/notifications/${id}/read`).catch(() => {})
  },

  markAllRead: () => {
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, isRead: true })) }))
    api.patch('/user/notifications/read-all').catch(() => {})
  },

  remove: (id) => {
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }))
    api.delete(`/user/notifications/${id}`).catch(() => {})
  },
}))

export const useUnreadNotificationCount = () =>
  useNotificationStore((state) => state.notifications.filter((n) => !n.isRead).length)

if (useAuthStore.getState().isAuthenticated) {
  useNotificationStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useNotificationStore.getState().hydrate()
  }
})
