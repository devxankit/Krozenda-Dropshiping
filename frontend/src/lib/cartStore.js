// Shared buyer-app cart. Persisted locally so the count in the header, the
// bottom nav, and the Cart page itself never drift apart, and synced to the
// backend (debounced) for signed-in users so it survives across devices.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './axios'
import { useAuthStore } from './authStore'
import { keyedDebounce } from './debounce'

const MONGO_ID_RE = /^[0-9a-fA-F]{24}$/

// A burst of +/- taps (or repeated "Add to Cart" clicks) on the same
// product collapses into one network call that reconciles the server to
// whatever the local quantity settled on — not one call per click. The
// PUT endpoint is an idempotent upsert-by-quantity, so this same call
// covers "new item", "quantity changed" and (via the missing-item branch
// below) "removed" uniformly.
const syncCartItem = keyedDebounce((productId) => {
  if (!useAuthStore.getState().isAuthenticated) return
  if (!MONGO_ID_RE.test(productId)) return // demo/fallback items aren't real products

  const item = useCartStore.getState().items.find((i) => i.id === productId)

  const request = item
    ? api.put(`/user/cart/items/${productId}`, { quantity: item.quantity, variant: item.variant })
    : api.delete(`/user/cart/items/${productId}`)

  request.catch(() => {
    // Best-effort — local state stays the source of truth for the UI even
    // if the background sync fails; it'll catch up on the next change.
  })
}, 500)

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, qty = 1) => {
        const id = product.id ?? product._id
        set((state) => {
          const existing = state.items.find((item) => item.id === id)
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.id === id ? { ...item, quantity: item.quantity + qty } : item,
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                id,
                name: product.name,
                variant: product.variant ?? product.subtitle ?? '',
                image: product.image,
                price: Number(product.price ?? product.salePrice ?? 0),
                originalPrice: Number(product.originalPrice ?? product.price ?? product.salePrice ?? 0),
                quantity: qty,
              },
            ],
          }
        })
        syncCartItem(id)
      },

      updateQuantity: (id, delta) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
          ),
        }))
        syncCartItem(id)
      },

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
        syncCartItem(id)
      },

      clearCart: () => {
        set({ items: [] })
        if (useAuthStore.getState().isAuthenticated) {
          api.delete('/user/cart').catch(() => {})
        }
      },

      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      // Pulls the signed-in user's server-side cart and replaces local
      // state with it — called on login and on app boot when already
      // authenticated, so a device switch shows the real cart.
      hydrate: async () => {
        if (!useAuthStore.getState().isAuthenticated) return
        try {
          const { data } = await api.get('/user/cart')
          if (data?.data?.items) set({ items: data.data.items })
        } catch {
          // Keep whatever local state exists (e.g. guest-accumulated) if the fetch fails
        }
      },
    }),
    { name: 'krozenda.cart' },
  ),
)

export const useCartCount = () =>
  useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0))

if (useAuthStore.getState().isAuthenticated) {
  useCartStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useCartStore.getState().hydrate()
  }
})
