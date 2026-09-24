// Shared buyer-app cart.
//
// WHO OWNS THE TRUTH
// ------------------
// For a signed-in buyer the SERVER owns the cart. Local state is a render
// cache that every mutation reconciles against the server response — it is
// never the thing that decides what a line costs or how many units are
// allowed. That distinction is the point of this rewrite: prices, quantities
// and availability used to live in localStorage, which meant a price change,
// a stock drop or a delisting in the catalog was invisible until checkout
// failed, and a tampered localStorage entry showed a fabricated price right
// up to the order screen (the backend always recomputed, so it was never
// chargeable — but the UI lied about it).
//
// For a SIGNED-OUT visitor there is no server cart, so local state is all
// there is. It is persisted, and on sign-in it is handed to POST
// /user/cart/merge — additively, capped at real stock — instead of being
// thrown away by a blind overwrite.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './axios'
import { useAuthStore } from './authStore'
import { keyedDebounce } from './debounce'

const MONGO_ID_RE = /^[0-9a-fA-F]{24}$/

// Mirrors the server's own cap (cartController.MAX_LINE_QUANTITY). Enforced
// here too so the stepper stops at the same number the API would clamp to,
// rather than letting the user click up to 99 and then snapping back.
export const MAX_LINE_QUANTITY = 50

const isRealProductId = (id) => MONGO_ID_RE.test(String(id ?? ''))

// A cart line is (product, variant), not a product. The same shirt in Red/L
// and Blue/M is two lines: two prices, two stock pools, two things a seller
// picks and packs. Everything in this store that used to look a line up by
// product id now goes through lineKey/findLine instead.
export const lineKey = (id, variantId = null) => `${id}::${variantId ?? ''}`

// Accepts a full line key OR a bare product id.
//
// The bare-id path exists because most callers (the PDP's "already in cart"
// count, the wishlist, the header badge) only ever deal in simple products and
// should not have to learn about variants. It resolves to the variant-less
// line, or to the only line for that product when there is exactly one — and
// deliberately returns null when a product is in the cart as several variants,
// because there is no right answer to "which one" and guessing would move the
// wrong line.
function findLine(items, keyOrId) {
  const direct = items.find((item) => lineKey(item.id, item.variantId) === keyOrId)
  if (direct) return direct

  const forProduct = items.filter((item) => item.id === keyOrId)
  if (forProduct.length === 0) return null
  return forProduct.find((item) => !item.variantId) ?? (forProduct.length === 1 ? forProduct[0] : null)
}


function normaliseServerItem(item) {
  return {
    id: item.id,
    name: item.name,
    // Null on a simple product. Together with `id` this identifies the line.
    variantId: item.variantId ?? null,
    variant: item.variant ?? '',
    // B2B context the server resolves, so the cart page can explain its own
    // numbers without re-deriving the pricing rules.
    moq: item.moq ?? 1,
    // Dropshipping item: online payment only, no cancellation, no return.
    isDropship: item.isDropship === true,
    priceSource: item.priceSource ?? 'PRODUCT',
    appliedTier: item.appliedTier ?? null,
    nextTier: item.nextTier ?? null,
    image: item.image ?? null,
    imageSrcSet: item.imageSrcSet ?? null,
    price: Number(item.price ?? 0),
    originalPrice: Number(item.originalPrice ?? item.price ?? 0),
    quantity: Number(item.quantity ?? 1),
    // Server-supplied, so the cart page can say "Only 2 left" / "No longer
    // available" instead of rendering every line as if it were fine.
    stock: item.stock ?? null,
    availability: item.availability ?? 'AVAILABLE',
    addedAtPrice: item.addedAtPrice ?? null,
    priceChanged: Boolean(item.priceChanged),
  }
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      // Server-computed totals for a signed-in cart. Null for a guest, where
      // the selectors below fall back to computing from local lines.
      summary: null,
      isSyncing: false,
      // Last message the server sent about an adjustment it had to make
      // ("Only 3 in stock — quantity adjusted"). Surfaced by the cart page and
      // cleared once shown, so the user is told rather than silently given
      // something different from what they asked for.
      notice: null,

      clearNotice: () => set({ notice: null }),

      isAuthed: () => useAuthStore.getState().isAuthenticated,

      // ---------------------------------------------------------------- reads
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      subtotal: () => {
        const { summary, items } = get()
        if (summary) return summary.subtotal
        return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      },

      mrpTotal: () => {
        const { summary, items } = get()
        if (summary) return summary.mrpTotal
        return items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)
      },

      hasIssues: () => {
        const { summary, items } = get()
        if (summary) return summary.hasIssues
        return items.some((item) => item.availability && item.availability !== 'AVAILABLE')
      },

      // --------------------------------------------------------------- writes
      // Every mutation for a signed-in buyer goes to the server and then adopts
      // the server's answer. No optimistic local price, no local stock guess.
      addItem: async (product, qty = 1) => {
        const id = product.id ?? product._id
        const variantId = product.variantId ?? null
        const key = lineKey(id, variantId)

        if (!get().isAuthed() || !isRealProductId(id)) {
          // Guest cart. Quantities are still capped locally so the number the
          // visitor sees is one the server will actually honour on merge.
          set((state) => {
            const existing = state.items.find((item) => lineKey(item.id, item.variantId) === key)
            if (existing) {
              return {
                items: state.items.map((item) =>
                  lineKey(item.id, item.variantId) === key
                    ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + qty) }
                    : item,
                ),
              }
            }
            return {
              items: [
                ...state.items,
                {
                  id,
                  variantId,
                  name: product.name,
                  variant: product.variant ?? product.subtitle ?? '',
                  image: product.image || '/images/default-product.png',
                  imageSrcSet: product.imageSrcSet ?? null,
                  price: Number(product.salePrice ?? product.price ?? 0),
                  originalPrice: Number(product.originalPrice ?? product.price ?? 0),
                  quantity: Math.min(MAX_LINE_QUANTITY, qty),
                  stock: product.stock ?? null,
                  moq: product.moq ?? 1,
                  availability: 'AVAILABLE',
                  priceChanged: false,
                },
              ],
            }
          })
          return { ok: true }
        }

        return runCartMutation(set, get, () =>
          api.post('/user/cart/items', { productId: id, quantity: qty, variantId }),
        )
      },

      // `delta` is +1 / -1 from the stepper. Dropping to zero removes the line,
      // which is what a buyer tapping "−" on a single unit expects.
      updateQuantity: async (keyOrId, delta) => {
        const current = findLine(get().items, keyOrId)
        if (!current) return { ok: false }

        const key = lineKey(current.id, current.variantId)
        const next = current.quantity + delta
        if (next < 1) return get().removeItem(key)

        const capped = Math.min(MAX_LINE_QUANTITY, next)

        if (!get().isAuthed() || !isRealProductId(current.id)) {
          set((state) => ({
            items: state.items.map((item) =>
              lineKey(item.id, item.variantId) === key ? { ...item, quantity: capped } : item,
            ),
          }))
          return { ok: true }
        }

        // PUT is an idempotent set-to-quantity, so a retry or an out-of-order
        // response can never compound into the wrong number the way a
        // fire-and-forget increment could.
        return runCartMutation(set, get, () =>
          api.put(`/user/cart/items/${current.id}`, { quantity: capped, variantId: current.variantId }),
        )
      },

      // Set an absolute quantity, with the network call debounced.
      //
      // A stepper is tapped in bursts: +,+,+,- is four taps in under a second.
      // Sending four requests for that wastes the round trips and, worse, they
      // can land out of order. So the local number moves immediately — the
      // badge, the cart page and the stepper all update on the tap — and only
      // the last value in the burst is sent.
      //
      // Safe to debounce precisely because the API is a PUT of an absolute
      // quantity: whatever arrives last is the truth, and a dropped
      // intermediate value changes nothing. A fire-and-forget increment could
      // not be collapsed this way.
      setQuantity: (keyOrId, quantity) => {
        const current = findLine(get().items, keyOrId);
        if (!current) return { ok: false };

        const key = lineKey(current.id, current.variantId);
        const wanted = Math.round(Number(quantity));
        if (!Number.isFinite(wanted)) return { ok: false };

        // Zero means remove, and that is NOT debounced: it is a deliberate,
        // visible act and the user should see it happen.
        if (wanted < 1) return get().removeItem(key);

        const capped = Math.min(MAX_LINE_QUANTITY, wanted);
        if (capped === current.quantity) return { ok: true };

        // Optimistic, always — including for a guest, whose cart is local
        // anyway.
        set((state) => ({
          items: state.items.map((item) =>
            lineKey(item.id, item.variantId) === key ? { ...item, quantity: capped } : item,
          ),
        }));

        if (get().isAuthed() && isRealProductId(current.id)) {
          // Debounced per LINE, not per product — otherwise two variants of the
          // same product being adjusted together would collapse onto one timer
          // and only the last one would be sent.
          pushQuantity(key, { set, get });
        }

        return { ok: true };
      },

      removeItem: async (keyOrId) => {
        const current = findLine(get().items, keyOrId)
        if (!current) return { ok: false }
        const key = lineKey(current.id, current.variantId)

        if (!get().isAuthed() || !isRealProductId(current.id)) {
          set((state) => ({
            items: state.items.filter((item) => lineKey(item.id, item.variantId) !== key),
          }))
          return { ok: true }
        }

        // The variant goes in the query string: a DELETE body is not reliably
        // sent by every client, and the server reads either (see
        // cartController.removeCartItem).
        const query = current.variantId ? `?variantId=${current.variantId}` : ''
        return runCartMutation(set, get, () => api.delete(`/user/cart/items/${current.id}${query}`))
      },

      clearCart: async () => {
        set({ items: [], summary: null })
        if (get().isAuthed()) {
          try {
            await api.delete('/user/cart')
          } catch {
            // The local cart is already empty; the next hydrate reconciles.
          }
        }
        return { ok: true }
      },

      // Replaces local state with the server's cart. Called on app boot when
      // already signed in, and after any mutation.
      hydrate: async () => {
        if (!get().isAuthed()) return
        set({ isSyncing: true })
        try {
          const { data } = await api.get('/user/cart')
          const payload = data?.data
          if (payload?.items) {
            set({ items: payload.items.map(normaliseServerItem), summary: payload.summary ?? null })
          }
        } catch {
          // Keep whatever is on screen; a failed refresh must not blank the
          // cart. The next mutation or reconnect retries.
        } finally {
          set({ isSyncing: false })
        }
      },

      // Sign-in handoff. The guest's lines are merged into the account cart
      // rather than discarded, and any cap the server had to apply comes back
      // as a notice so the buyer is told.
      mergeGuestCart: async () => {
        const guestItems = get().items.filter((item) => isRealProductId(item.id) && item.quantity > 0)

        if (guestItems.length === 0) {
          await get().hydrate()
          return
        }

        set({ isSyncing: true })
        try {
          const { data } = await api.post('/user/cart/merge', {
            items: guestItems.map((item) => ({
              productId: item.id,
              // Sent so the server merges onto the right LINE. A guest who
              // chose Red/L and Blue/M has two lines, and merging on product
              // alone would fold one into the other.
              variantId: item.variantId ?? null,
              quantity: item.quantity,
              variant: item.variant,
            })),
          })
          const payload = data?.data
          if (payload?.items) {
            set({ items: payload.items.map(normaliseServerItem) })
          }
          const adjustments = payload?.adjustments ?? []
          if (adjustments.length > 0) {
            set({ notice: describeAdjustments(adjustments) })
          }
        } catch {
          // Merge failed — fall back to whatever the account already had, so
          // the buyer is never left looking at a guest cart the server has
          // never heard of.
        } finally {
          set({ isSyncing: false })
        }
        await get().hydrate()
      },
    }),
    {
      name: 'krozenda.cart',
      // Only the guest lines are worth persisting. Persisting the server
      // summary would resurrect a stale total on the next boot, before
      // hydrate() has had a chance to replace it.
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

// Runs a cart mutation, adopts the server's message, and re-reads the cart so
// local state can never drift from it.
// One timer per product, so a burst on one line never cancels a pending call
// for another. The quantity is read from the store when the timer fires rather
// than captured at tap time — that way the request carries where the stepper
// actually ended up, not where it was three taps ago.
const pushQuantity = keyedDebounce((key, { set, get }) => {
  const line = get().items.find((item) => lineKey(item.id, item.variantId) === key);
  if (!line) return; // removed while the timer was pending

  runCartMutation(set, get, () =>
    api.put(`/user/cart/items/${line.id}`, { quantity: line.quantity, variantId: line.variantId })
  );
}, 450);

async function runCartMutation(set, get, request) {
  set({ isSyncing: true })
  try {
    const { data } = await request()
    // The API answers a clamped quantity with an explanatory message
    // ("Only 3 in stock — quantity adjusted") rather than silently applying a
    // different number, so it is surfaced instead of dropped.
    if (data?.message && /stock|available|adjust/i.test(data.message)) {
      set({ notice: data.message })
    }
    await get().hydrate()
    return { ok: true }
  } catch (error) {
    set({ notice: error?.message || 'Could not update your cart. Please try again.' })
    // Re-read regardless: the failure may have been a stale local view (the
    // product went away), and the fresh cart is what explains it.
    await get().hydrate()
    return { ok: false, error }
  } finally {
    set({ isSyncing: false })
  }
}

function describeAdjustments(adjustments) {
  const capped = adjustments.filter((a) => a.reason === 'STOCK_CAPPED')
  // A line below its minimum order quantity is kept, not dropped — the buyer
  // has to raise the quantity before checkout will take it. Calling that "no
  // longer available" (which is what the catch-all below used to do) sends
  // them looking for a replacement for something that is still on sale.
  const belowMoq = adjustments.filter((a) => a.reason === 'BELOW_MOQ')
  const dropped = adjustments.filter((a) => !['STOCK_CAPPED', 'BELOW_MOQ'].includes(a.reason))

  const parts = []
  if (capped.length === 1) {
    parts.push(`Only ${capped[0].applied} of "${capped[0].name}" are in stock, so the quantity was reduced.`)
  } else if (capped.length > 1) {
    parts.push(`${capped.length} items were reduced to the quantity currently in stock.`)
  }
  if (belowMoq.length === 1) {
    parts.push(`"${belowMoq[0].name}" needs a minimum of ${belowMoq[0].moq} to check out.`)
  } else if (belowMoq.length > 1) {
    parts.push(`${belowMoq.length} items are below their minimum order quantity.`)
  }
  if (dropped.length === 1) {
    parts.push(`"${dropped[0].name || 'One item'}" is no longer available and was not added.`)
  } else if (dropped.length > 1) {
    parts.push(`${dropped.length} items are no longer available and were not added.`)
  }
  return parts.join(' ')
}

export const useCartCount = () =>
  useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0))

// Boot: a signed-in session reads its cart from the server immediately, so a
// device switch (or a WebView that was killed and recreated) shows the real
// cart rather than a stale local copy.
if (useAuthStore.getState().isAuthenticated) {
  useCartStore.getState().hydrate()
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    // Sign-in: merge, don't overwrite.
    useCartStore.getState().mergeGuestCart()
  }
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    // Sign-out must not leave the previous buyer's cart on the device.
    useCartStore.setState({ items: [], summary: null, notice: null })
  }
})
