// Shared buyer-app wishlist. Persisted locally so a heart tapped on the
// dashboard shows up on the Wishlist page instantly, and synced to the
// backend (debounced) for signed-in users so it survives across devices.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './axios'
import { useAuthStore } from './authStore'
import { keyedDebounce } from './debounce'

const MONGO_ID_RE = /^[0-9a-fA-F]{24}$/

// Rapid double/triple taps on the same heart collapse into a single
// network call carrying whichever state the product ended up in — not one
// call per click.
const syncWishlistToggle = keyedDebounce((productId, shouldBeLiked) => {
  if (!useAuthStore.getState().isAuthenticated) return
  if (!MONGO_ID_RE.test(productId)) return // demo/fallback items aren't real products

  const request = shouldBeLiked
    ? api.post(`/user/wishlist/${productId}`)
    : api.delete(`/user/wishlist/${productId}`)

  request.catch(() => {
    // Best-effort — local state stays the source of truth for the UI even
    // if the background sync fails; it'll catch up on the next toggle.
  })
}, 500)

export const useWishlistStore = create(
  persist(
    (set, get) => ({
      items: [],

      isWishlisted: (id) => get().items.some((item) => item.id === id),

      toggleItem: (product) => {
        const id = product.id ?? product._id
        const wasLiked = get().items.some((item) => item.id === id)

        if (wasLiked) {
          set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
        } else {
          set((state) => ({
            items: [
              ...state.items,
              {
                id,
                name: product.name,
                subtitle: product.subtitle ?? '',
                image: product.image,
                price: Number(product.price ?? product.salePrice ?? 0),
                stock: product.stock ?? 'In Stock',
              },
            ],
          }))
        }

        syncWishlistToggle(id, !wasLiked)
      },

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
        syncWishlistToggle(id, false)
      },

      clear: () => set({ items: [] }),

      // Pulls the signed-in user's server-side wishlist and replaces local
      // state with it — called on login and on app boot when already
      // authenticated, so a device switch shows the real list.
      hydrate: async () => {
        if (!useAuthStore.getState().isAuthenticated) return
        try {
          const { data } = await api.get('/user/wishlist')
          if (data?.data?.items) set({ items: data.data.items })
        } catch {
          // Keep whatever local state exists (e.g. guest-accumulated) if the fetch fails
        }
      },
    }),
    { name: 'krozenda.wishlist' },
  ),
)

export const useWishlistCount = () => useWishlistStore((state) => state.items.length)

if (useAuthStore.getState().isAuthenticated) {
  useWishlistStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useWishlistStore.getState().hydrate()
  }
})
