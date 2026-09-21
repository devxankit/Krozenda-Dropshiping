import { useEffect, useState } from 'react'
import { HiArrowLeft, HiHeart, HiOutlineShoppingBag, HiTrash } from 'react-icons/hi2'
import { Link, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { Footer } from '../../../../components/layout/Footer'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { EmptyResult, ProductGridSkeleton } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useCartStore } from '../../../../lib/cartStore'
import { usePageMeta } from '../../../../lib/usePageMeta'

// What a wishlisted product's availability means for the card. The screen
// previously rendered every entry identically and hardcoded "In Stock" when
// the field was missing — so a delisted or sold-out product looked buyable,
// and "Move to cart" failed with no explanation.
const AVAILABILITY = {
  AVAILABLE: { label: 'In stock', className: 'text-emerald-600', canBuy: true },
  LOW_STOCK: { label: null, className: 'text-amber-600', canBuy: true },
  OUT_OF_STOCK: { label: 'Out of stock', className: 'text-red-600', canBuy: false },
  UNAVAILABLE: { label: 'No longer available', className: 'text-red-600', canBuy: false },
}

export function WishlistScreen() {
  const navigate = useNavigate()
  const wishlistItems = useWishlistStore((state) => state.items)
  const isSyncing = useWishlistStore((state) => state.isSyncing)
  const notice = useWishlistStore((state) => state.notice)
  const clearNotice = useWishlistStore((state) => state.clearNotice)
  const removeFromWishlist = useWishlistStore((state) => state.removeItem)
  const hydrate = useWishlistStore((state) => state.hydrate)
  const addToCart = useCartStore((state) => state.addItem)

  const [movingId, setMovingId] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  usePageMeta({ title: 'My Wishlist', noindex: true })

  // Re-read on mount so prices, stock and availability are current rather than
  // whatever was cached on this device the last time the list was opened.
  useEffect(() => {
    hydrate().finally(() => setHasLoadedOnce(true))
  }, [hydrate])

  const moveToCart = async (item, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (movingId) return
    setMovingId(item.id)
    const result = await addToCart(item)
    setMovingId(null)
    // Only drop it from the wishlist once it is genuinely in the cart —
    // otherwise a failed add silently loses the item from both places.
    if (result?.ok) {
      removeFromWishlist(item.id)
      navigate(USER_ROUTES.CART)
    }
  }

  const showSkeleton = isSyncing && !hasLoadedOnce && wishlistItems.length === 0

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-800 transition-colors hover:bg-slate-100"
          >
            <HiArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">
            My Wishlist{wishlistItems.length > 0 ? ` (${wishlistItems.length})` : ''}
          </h1>
        </div>

        {wishlistItems.length > 0 && (
          <button
            type="button"
            // Removes each item through the store so the server is updated
            // too — the old "Clear" only emptied local state, so everything
            // came back on the next device or the next hydrate.
            onClick={() => wishlistItems.forEach((item) => removeFromWishlist(item.id))}
            className="flex items-center gap-1 text-xs font-bold text-red-600 transition-colors hover:text-red-700"
          >
            <HiTrash className="h-4 w-4" aria-hidden="true" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 pb-28 sm:px-6 md:py-8 md:pb-12 lg:px-8">
        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-800"
          >
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={clearNotice} className="font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        {showSkeleton ? (
          <ProductGridSkeleton count={8} />
        ) : wishlistItems.length === 0 ? (
          <EmptyResult
            icon={'❤️'}
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it here for later."
            action={
              <Link
                to={USER_ROUTES.LISTING}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Explore products
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {wishlistItems.map((item) => {
              const state = AVAILABILITY[item.availability] || AVAILABILITY.AVAILABLE
              const label =
                item.availability === 'LOW_STOCK' && item.availableStock
                  ? `Only ${item.availableStock} left`
                  : state.label

              return (
                <Link
                  key={item.id}
                  to={userPath.product(item.id)}
                  className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeFromWishlist(item.id)
                    }}
                    aria-label={`Remove ${item.name} from wishlist`}
                    className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-red-500 shadow-sm transition-colors hover:bg-red-50"
                  >
                    <HiHeart className="h-4 w-4 fill-red-500" />
                  </button>

                  <SmartImage
                    src={item.image}
                    srcSet={item.imageSrcSet}
                    alt={item.name}
                    ratio="1 / 1"
                    className={`rounded-xl ${state.canBuy ? '' : 'opacity-60'}`}
                  />

                  <div className="space-y-1">
                    {label && (
                      <span className={`block text-[10px] font-bold ${state.className}`}>{label}</span>
                    )}
                    <h2 className="line-clamp-2 min-h-[2.25rem] text-xs font-bold text-slate-900 transition-colors group-hover:text-blue-700 sm:text-sm">
                      {item.name}
                    </h2>
                    {item.subtitle && (
                      <p className="truncate text-[11px] font-medium text-slate-400">{item.subtitle}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1.5">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                        <span className="text-xs font-black text-slate-900 sm:text-sm">
                          {'₹'}
                          {item.price.toLocaleString('en-IN')}
                        </span>
                        {item.originalPrice > item.price && (
                          <span className="text-[11px] text-slate-400 line-through">
                            {'₹'}
                            {item.originalPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => moveToCart(item, e)}
                        disabled={!state.canBuy || movingId === item.id}
                        aria-label={`Move ${item.name} to cart`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50 disabled:hover:text-blue-600"
                      >
                        <HiOutlineShoppingBag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <Footer />

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
