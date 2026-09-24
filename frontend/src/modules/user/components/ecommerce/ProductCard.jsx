import { HiHeart, HiOutlineHeart, HiStar } from 'react-icons/hi2'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { toast } from '../../../../lib/toast'

const MotionLink = motion(Link)

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
    e.preventDefault()
    e.stopPropagation()
    const wasWishlisted = isWishlisted
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle,
      image: product.image || '/images/default-product.png',
      imageSrcSet: product.imageSrcSet,
      price,
      originalPrice: product.price,
    })
    if (wasWishlisted) {
      toast.info('Removed from Wishlist', `${product.name} removed from your saved items.`)
    } else {
      toast.success('Saved to Wishlist', `${product.name} added to your wishlist.`)
    }
  }

  const wishlistButton = isAuthenticated ? (
    <button
      type="button"
      onClick={handleWishlist}
      aria-label={
        isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
      }
      aria-pressed={isWishlisted}
      className="absolute right-2 top-2 z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white/85 backdrop-blur-md text-slate-600 shadow-xs transition-all hover:bg-white hover:text-red-500 hover:scale-110 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {isWishlisted ? (
        <HiHeart className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-red-500 text-red-500" />
      ) : (
        <HiOutlineHeart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600 hover:text-red-500" />
      )}
    </button>
  ) : null

  const priceBlock = (
    <div className="space-y-0.5 pt-1.5">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{formatPrice(price)}</span>
        {hasDiscount && (
          <span className="text-xs text-slate-400 line-through font-normal">{formatPrice(product.price)}</span>
        )}
        {discountPercent > 0 && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded-md">
            {discountPercent}% OFF
          </span>
        )}
      </div>
      {note ? (
        <p className={`text-[11px] font-semibold ${note.className}`}>{note.label}</p>
      ) : lowStock ? (
        <p className="text-[11px] font-medium text-amber-600">Only {product.stock} left</p>
      ) : null}
    </div>
  )

  const ratingBadge =
    product.rating > 0 && product.reviewsCount > 0 ? (
      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
        <HiStar className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
        <span className="font-bold text-slate-800">{product.rating.toFixed(1)}</span>
        <span className="font-normal text-slate-400">
          ({product.reviewsCount.toLocaleString('en-IN')})
        </span>
      </div>
    ) : null

  if (layout === 'list') {
    return (
      <MotionLink
        to={href}
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`group relative flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-4 shadow-card hover:shadow-card-hover hover:border-blue-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
      >
        <div className="relative w-24 shrink-0 sm:w-28 overflow-hidden rounded-xl border border-slate-100">
          <SmartImage
            src={product.image}
            srcSet={product.imageSrcSet}
            sizes="112px"
            alt={product.name}
            ratio="1 / 1"
            priority={priority}
            className="w-full transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {product.isDropship && (
            <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              Dropship
            </span>
          )}
          {ratingBadge}
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
            {product.name}
          </h3>
          {subtitle && <p className="truncate text-xs font-medium text-slate-400">{subtitle}</p>}
          {priceBlock}
        </div>
        {wishlistButton}
      </MotionLink>
    )
  }

  return (
    <MotionLink
      to={href}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-2.5 sm:p-3 shadow-card hover:shadow-card-hover hover:border-blue-200/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <div className="relative overflow-hidden rounded-xl border border-slate-100/90 bg-slate-50/50">
        {wishlistButton}
        {product.isDropship && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
            Dropship
          </span>
        )}
        <SmartImage
          src={product.image}
          srcSet={product.imageSrcSet}
          alt={product.name}
          ratio="1 / 1"
          priority={priority}
          className="w-full transition-transform duration-300 group-hover:scale-105"
        />
        {outOfStock && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 backdrop-blur-2xs">
            <span className="rounded-full bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 min-w-0 space-y-1">
        <h3 className="line-clamp-2 text-xs font-semibold text-slate-800 leading-snug transition-colors group-hover:text-blue-600 sm:text-sm">
          {product.name}
        </h3>
        {subtitle && <p className="truncate text-[11px] font-medium text-slate-400">{subtitle}</p>}
        {ratingBadge}
        {priceBlock}
      </div>
    </MotionLink>
  )
}
