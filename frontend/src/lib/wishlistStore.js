// Shared buyer-app wishlist. Same ownership rule as cartStore: for a
// signed-in buyer the server owns the list and local state is a render cache;
// for a signed-out visitor local state is all there is, and it is merged into
// the account on sign-in rather than discarded.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './axios'
import { useAuthStore } from './authStore'
import { keyedDebounce } from './debounce'

const MONGO_ID_RE = /^[0-9a-fA-F]{24}$/
const isRealProductId = (id) => MONGO_ID_RE.test(String(id ?? ''))

function normaliseServerItem(item) {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.subtitle ?? '',
    image: item.image ?? null,
    imageSrcSet: item.imageSrcSet ?? null,
    price: Number(item.price ?? 0),
    originalPrice: Number(item.originalPrice ?? item.price ?? 0),
    discountPercent: item.discountPercent ?? 0,
    rating: item.rating ?? 0,
    reviewsCount: item.reviewsCount ?? 0,
    availableStock: item.availableStock ?? null,
    // 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNAVAILABLE' — a
    // wishlisted product that was delisted or sold out now says so instead of
    // rendering as a normal card whose "Move to cart" then fails.
    availability: item.availability ?? 'AVAILABLE',
    stock: item.stock ?? 'In Stock',
  }
}

// Rapid double/triple taps on the same heart collapse into a single network
// call carrying whichever state the product ended up in — not one call per
// click. A toggle is a cheap, idempotent-by-endpoint operation (POST adds,
// DELETE removes), so unlike the cart it does not need a full re-read on every
// tap; the list is re-read once the burst settles.
const syncWishlistToggle = keyedDebounce((productId, shouldBeLiked) => {
  if (!useAuthStore.getState().isAuthenticated) return
  if (!isRealProductId(productId)) return

  const request = shouldBeLiked
    ? api.post(`/user/wishlist/${productId}`)
    : api.delete(`/user/wishlist/${productId}`)

  request
    .then(() => useWishlistStore.getState().hydrate())
    .catch((error) => {
      // Roll the optimistic toggle back rather than leaving the heart filled
      // on a product the server does not have in the list.
      useWishlistStore.setState((state) => ({
        items: shouldBeLiked
          ? state.items.filter((item) => item.id !== productId)
          : state.items,
        notice: error?.message || 'Could not update your wishlist. Please try again.',
      }))
      useWishlistStore.getState().hydrate()
    })
}, 500)

export const useWishlistStore = create(
  persist(
    (set, get) => ({
      items: [],
      notice: null,
      isSyncing: false,

      clearNotice: () => set({ notice: null }),

      isWishlisted: (id) => get().items.some((item) => item.id === id),

      toggleItem: (product) => {
        const id = product.id ?? product._id
        const wasLiked = get().items.some((item) => item.id === id)

        // Optimistic: a heart must respond to a tap immediately, and the
        // rollback above covers the failure case.
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
                image: product.image ?? null,
                imageSrcSet: product.imageSrcSet ?? null,
                price: Number(product.price ?? product.salePrice ?? 0),
                originalPrice: Number(product.originalPrice ?? product.price ?? 0),
                availability: 'AVAILABLE',
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

      hydrate: async () => {
        if (!useAuthStore.getState().isAuthenticated) return
        set({ isSyncing: true })
        try {
          const { data } = await api.get('/user/wishlist', { params: { limit: 50 } })
          if (data?.data?.items) set({ items: data.data.items.map(normaliseServerItem) })
        } catch {
          // Keep whatever is on screen; a failed refresh must not blank the
          // list.
        } finally {
          set({ isSyncing: false })
        }
      },

      // Sign-in handoff. Anything hearted while signed out is pushed to the
      // account before the server list is read back, so it is not lost the way
      // a blind overwrite lost it.
      mergeGuestWishlist: async () => {
        const guestIds = get()
          .items.map((item) => item.id)
          .filter(isRealProductId)

        if (guestIds.length > 0) {
          // Sequential and capped: this runs once per sign-in, and firing
          // dozens of parallel POSTs at a freshly authenticated session is
          // exactly the request burst the audit warns about.
          for (const id of guestIds.slice(0, 50)) {
            try {
              await api.post(`/user/wishlist/${id}`)
            } catch {
              // One failure (already present, wishlist full) must not abort
              // the rest of the merge.
            }
          }
        }

        await get().hydrate()
      },
    }),
    {
      name: 'krozenda.wishlist',
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

export const useWishlistCount = () => useWishlistStore((state) => state.items.length)

if (useAuthStore.getState().isAuthenticated) {
  useWishlistStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    useWishlistStore.getState().mergeGuestWishlist()
  }
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    useWishlistStore.setState({ items: [], notice: null })
  }
})
