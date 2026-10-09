// Boot sequence: load tokens from SecureStore, then (when signed in) warm the server-owned stores.
// Replaces the web app's top-level "if authenticated, hydrate()" statements, which run at import time
// there because localStorage is synchronous.
import { bootstrapStorage } from './storage'
import { useAuthStore } from './authStore'
import { useCartStore } from './cartStore'
import { useWishlistStore } from './wishlistStore'
import { useNotificationStore } from './notificationStore'

let booted = false

export async function bootstrapSession() {
  if (booted) return
  booted = true
  await bootstrapStorage()
  useAuthStore.getState().hydrateAuth()
  if (useAuthStore.getState().isAuthenticated) {
    useCartStore.getState().hydrate()
    useWishlistStore.getState().hydrate()
    useNotificationStore.getState().hydrate()
  }
}

// Sign-in: the cart/wishlist stores merge themselves (they subscribe to the auth store); the
// notification feed is hydrated here so the unread badge is live straight away.
useAuthStore.subscribe((state, prev) => {
  if (state.isAuthenticated && !prev.isAuthenticated) useNotificationStore.getState().hydrate()
})
