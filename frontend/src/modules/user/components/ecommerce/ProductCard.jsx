import { HiHeart, HiOutlineHeart, HiStar } from 'react-icons/hi2'
import { Link } from 'react-router-dom'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'

// The one product card for the whole buyer app.
//
// There were four near-identical copies (listing grid, search grid, search
// list, home rails), each with slightly different price formatting, a
// different discount badge and a different set of missing edge cases. Having
// one means the edge cases below are handled everywhere rather than in
// whichever copy someone remembered:
//
//   * no image / broken image      -> SmartImage's fixed-ratio fallback, so a
//                                     missing file never collapses the card
//   * very long product name       -> clamped to two lines, never truncated to
//                                     an unreadable single line
//   * no rating yet                -> the badge is omitted entirely rather than
//                                     showing a fabricated "4.5 (1,200)"
//   * no discount                  -> no strike-through, no "0% OFF"
//   * out of stock / low stock     -> stated on the card, before the buyer
//                                     invests a tap in it
//   * very large price             -> price block wraps instead of overflowing
//
// It is an <a>, not a div with onClick: that is what makes long-press-to-copy,
// open-in-new-tab, middle-click and the browser's own back/forward behaviour
// work, and what makes the card reachable by keyboard.

function formatPrice(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`
}

const AVAILABILITY_NOTE = {
  OUT_OF_STOCK: { label: 'Out of stock', className: 'text-red-600' },
  UNAVAILABLE: { label: 'No longer available', className: 'text-red-600' },
}

export function ProductCard({ product, layout = 'grid', priority = false, className = '' }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isWishlisted = useWishlistStore((state) => state.items.some((item) => item.id === product.id))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)

  const price = product.salePrice ?? product.price
  const hasDiscount = product.salePrice != null && product.salePrice < product.price
  const discountPercent =
    product.discountPercent > 0
      ? product.discountPercent
      : hasDiscount
        ? Math.round(((product.price - product.salePrice) / product.price) * 100)
        : 0

  const outOfStock = product.stock <= 0
  const lowStock = !outOfStock && product.stock > 0 && product.stock <= 5
  const note = outOfStock ? AVAILABILITY_NOTE.OUT_OF_STOCK : null

  const href = `${USER_ROUTES.ROOT}/product/${product.id}`
  const subtitle = product.brand?.name || product.category?.name || ''

  const handleWishlist = (e) => {
    // The heart lives inside the link, so its click must not also navigate.
    e.preventDefault()
    e.stopPropagation()
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle,
      image: product.image,
      imageSrcSet: product.imageSrcSet,
      price,
      originalPrice: product.price,
    })
  }

  const wishlistButton = isAuthenticated ? (
    <button
      type="button"
      onClick={handleWishlist}
      // An icon-only control needs an accessible name, and it has to say what
      // it will do to WHICH product — "Add to wishlist" alone is useless in a
      // grid of twenty.
      aria-label={
        isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
      }
      aria-pressed={isWishlisted}
      // 36px hit area: a 16px icon is below every touch-target guideline and
      // was genuinely hard to hit on a phone.
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition-colors hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {isWishlisted ? (
        <HiHeart className="h-4 w-4 fill-red-500 text-red-500" />
      ) : (
        <HiOutlineHeart className="h-4 w-4" />
      )}
    </button>
  ) : null

  const priceBlock = (
    <div className="space-y-0.5 pt-1">
      {/* flex-wrap so a 7-figure price and its strike-through wrap onto two
          lines instead of overflowing the card. */}
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-sm font-black text-slate-900">{formatPrice(price)}</span>
        {hasDiscount && (
          <span className="text-[11px] text-slate-400 line-through">{formatPrice(product.price)}</span>
        )}
        {discountPercent > 0 && (
          <span className="text-[11px] font-bold text-emerald-600">{discountPercent}% OFF</span>
        )}
      </div>
      {note ? (
        <p className={`text-[11px] font-bold ${note.className}`}>{note.label}</p>
      ) : lowStock ? (
        <p className="text-[11px] font-bold text-amber-600">Only {product.stock} left</p>
      ) : null}
    </div>
  )

  // A rating badge is rendered ONLY when there is a real rating behind it.
  const ratingBadge =
    product.rating > 0 && product.reviewsCount > 0 ? (
      <div className="flex items-center gap-1 pt-0.5 text-[11px] font-bold text-amber-500">
        <HiStar className="h-3.5 w-3.5 fill-amber-400" aria-hidden="true" />
        <span className="text-slate-900">{product.rating.toFixed(1)}</span>
        <span className="font-normal text-slate-400">
          ({product.reviewsCount.toLocaleString('en-IN')})
        </span>
      </div>
    ) : null

  if (layout === 'list') {
    return (
      <Link
        to={href}
        className={`group relative flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
      >
        <SmartImage
          src={product.image}
          srcSet={product.imageSrcSet}
          sizes="112px"
          alt={product.name}
          ratio="1 / 1"
          priority={priority}
          className="w-24 shrink-0 rounded-xl border border-slate-100 sm:w-28"
        />
        <div className="min-w-0 flex-1 space-y-1">
          {ratingBadge}
          <h3 className="line-clamp-2 text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-700">
            {product.name}
          </h3>
          {subtitle && <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>}
          {priceBlock}
        </div>
        {wishlistButton}
      </Link>
    )
  }

  return (
    <Link
      to={href}
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-3.5 ${className}`}
    >
      <div className="relative">
        {wishlistButton}
        <SmartImage
          src={product.image}
          srcSet={product.imageSrcSet}
          alt={product.name}
          ratio="1 / 1"
          priority={priority}
          className="rounded-xl border border-slate-100/80"
        />
        {outOfStock && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
            <span className="rounded-full bg-slate-900/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 min-w-0 space-y-1">
        {/* Two lines, then ellipsis — a single truncated line made most
            marketplace product names indistinguishable from each other. The
            fixed min-height keeps every card in a row the same height whether
            the name wraps or not, which is what stops the grid jittering. */}
        <h3 className="line-clamp-2 min-h-[2.25rem] text-xs font-bold text-slate-900 transition-colors group-hover:text-blue-700 sm:text-sm">
          {product.name}
        </h3>
        {subtitle && <p className="truncate text-[10px] font-medium text-slate-500">{subtitle}</p>}
        {ratingBadge}
        {priceBlock}
      </div>
    </Link>
  )
}
