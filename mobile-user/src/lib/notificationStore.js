// Shared buyer-app notification feed, backed by the real /user/notifications
// API — mirrors cartStore/wishlistStore's pattern (local state + hydrate on
// auth + optimistic local update alongside the backend call) rather than
// the zod/react-query layering modules/user/ uses, since this is consumed
// from the shared WebHeader (outside modules/user) exactly like cart/wishlist
// counts are.
import { create } from 'zustand'
import { api } from './axios'
import { useAuthStore } from './authStore'

import { registerForPush } from './push'

// Best-effort: a declined permission or a device that already registered this token must never
// surface as an error - push is a nice-to-have on top of the in-app feed.
async function registerPushToken() {
  try {
    await registerForPush()
  } catch {
    // Ignored.
  }
}

// Asks for notification permission and registers the device token (native FCM token).
export function enablePush() {
  return registerPushToken()
}

let pushRefreshed = false
function refreshPushToken() {
  if (pushRefreshed) return
  pushRefreshed = true
  registerPushToken()
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
    refreshPushToken()
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

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useNotificationStore.getState().hydrate()
  }
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    // Sign-out must not leave the previous buyer's notifications (or their
    // unread badge) on the device.
    useNotificationStore.setState({ notifications: [], unreadCount: 0, pagination: null })
    pushRefreshed = false
  }
})
