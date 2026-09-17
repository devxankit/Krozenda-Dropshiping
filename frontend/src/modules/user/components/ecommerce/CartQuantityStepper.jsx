import { HiMinus, HiPlus, HiTrash } from 'react-icons/hi2'
import { MAX_LINE_QUANTITY, useCartStore } from '../../../../lib/cartStore'

// The −/+ control that replaces "Add to Cart" once the item is in the cart.
//
// Every tap moves the number immediately. The network call behind it is
// debounced in the cart store, so +,+,+,− in a second is one request carrying
// the number the stepper actually landed on — not four requests that can
// arrive out of order.
//
// The stepper reads its quantity from the store rather than keeping its own
// copy, so it always agrees with the cart badge and the cart page. There is no
// local mirror to drift.

export function CartQuantityStepper({ productId, stock, className = '' }) {
  const quantity = useCartStore((state) => state.items.find((item) => item.id === productId)?.quantity ?? 0)
  const setQuantity = useCartStore((state) => state.setQuantity)

  if (quantity < 1) return null

  // The real ceiling is whichever is lower: what is on the shelf, or the
  // per-line cap the server enforces. Stopping here means the number never
  // jumps up and then snaps back after the API clamps it.
  const ceiling = Math.min(MAX_LINE_QUANTITY, Number.isFinite(Number(stock)) && stock > 0 ? Number(stock) : MAX_LINE_QUANTITY)
  const atCeiling = quantity >= ceiling
  const willRemove = quantity <= 1

  return (
    <div
      className={`flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-blue-700 bg-white px-2 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => setQuantity(productId, quantity - 1)}
        // 44px, so it is comfortably tappable on a phone rather than a
        // desktop-sized hit area shrunk onto a touch screen.
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-blue-700 transition-colors hover:bg-blue-50 active:bg-blue-100"
        aria-label={willRemove ? 'Remove from cart' : 'Decrease quantity'}
      >
        {willRemove ? <HiTrash className="h-5 w-5" /> : <HiMinus className="h-5 w-5" />}
      </button>

      <span
        className="min-w-8 text-center text-sm font-extrabold tabular-nums text-slate-900"
        // The number changes without the element being replaced, so a screen
        // reader announces the new value instead of staying silent.
        aria-live="polite"
        aria-label={`Quantity ${quantity}`}
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={() => setQuantity(productId, quantity + 1)}
        disabled={atCeiling}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-blue-700 transition-colors hover:bg-blue-50 active:bg-blue-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
        aria-label="Increase quantity"
      >
        <HiPlus className="h-5 w-5" />
      </button>
    </div>
  )
}
