import { useMemo, useState } from 'react'
import {
  HiArrowLeft,
  HiArrowPath,
  HiCheck,
  HiHeart,
  HiMapPin,
  HiOutlineHeart,
  HiOutlineShoppingBag,
  HiShare,
  HiShieldCheck,
  HiStar,
  HiTruck,
} from 'react-icons/hi2'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { SectionErrorBoundary } from '../../../../components/common/ErrorBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import {
  buildBreadcrumbStructuredData,
  buildProductStructuredData,
  usePageMeta,
} from '../../../../lib/usePageMeta'
import { useAuthStore } from '../../../../lib/authStore'
import {
  useProductController,
  useRelatedProductsController,
} from '../../controllers/useProductsController'
import { useProductReviewsController } from '../../controllers/useProductReviewsController'
import { ProductCard } from './ProductCard'

const LOW_STOCK_THRESHOLD = 5

export function ProductDetailScreen() {
  const navigate = useNavigate()
  // From the PATH, not router state — this is what makes the page linkable,
  // shareable, reloadable and reachable from a push notification.
  const { productId } = useParams()

  const { product, isLoading, isError, error, refetch } = useProductController(productId)

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('description')
  const [addState, setAddState] = useState('idle') // idle | adding | added

  const isWishlisted = useWishlistStore((state) => state.items.some((item) => item.id === productId))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addToCart = useCartStore((state) => state.addItem)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const images = product?.images?.length ? product.images : []
  const displayPrice = product ? (product.salePrice ?? product.price) : 0
  const hasDiscount = Boolean(product && product.salePrice != null && product.salePrice < product.price)
  const inStock = (product?.stock ?? 0) > 0
  const lowStock = inStock && product.stock <= LOW_STOCK_THRESHOLD

  const structuredData = useMemo(
    () =>
      product
        ? buildProductStructuredData(product, {
            url: `${window.location.origin}${userPath.product(product.id)}`,
            reviewCount: product.reviewsCount,
            ratingValue: product.rating,
          })
        : null,
    [product],
  )

  usePageMeta({
    title: product?.name,
    // Trimmed to roughly what a SERP snippet shows; a 2000-character
    // description in a meta tag is just truncated by the crawler anyway.
    description: product?.description
      ? product.description.replace(/\s+/g, ' ').slice(0, 160)
      : product
        ? `Buy ${product.name} at wholesale prices on Krozenda.`
        : undefined,
    image: images[0],
    structuredData,
  })

  // ---- loading / error / not-found -----------------------------------------
  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (isError || !product) {
    // A 404 is a genuinely different situation from "the request failed" —
    // telling someone to "try again" on a deleted product is useless advice.
    const isNotFound = error?.status === 404
    return (
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <div className="hidden md:block">
          <WebHeader />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          {isNotFound ? (
            <div className="space-y-4 text-center">
              <h1 className="text-base font-bold text-slate-900">This product is no longer available</h1>
              <p className="mx-auto max-w-sm text-xs text-slate-500">
                It may have been removed by the seller or delisted from the catalog.
              </p>
              <Link
                to={USER_ROUTES.LISTING}
                className="inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                Browse other products
              </Link>
            </div>
          ) : (
            <ErrorState error={error} onRetry={refetch} className="max-w-md" />
          )}
        </div>
      </div>
    )
  }

  const cartLineItem = () => ({
    id: product.id,
    name: product.name,
    variant: '',
    image: images[0] ?? null,
    imageSrcSet: product.imageSrcSets?.[0] ?? null,
    price: displayPrice,
    originalPrice: product.price,
    stock: product.stock,
  })

  const handleAddToCart = async () => {
    if (!inStock || addState === 'adding') return
    setAddState('adding')
    const result = await addToCart(cartLineItem())
    setAddState(result?.ok ? 'added' : 'idle')
    if (result?.ok) setTimeout(() => setAddState('idle'), 1800)
  }

  const handleBuyNow = async () => {
    if (!inStock || addState === 'adding') return
    setAddState('adding')
    const result = await addToCart(cartLineItem())
    setAddState('idle')
    if (!result?.ok) return
    // A signed-out buyer sent straight to checkout hits the auth guard and
    // loses their place; send them to the cart, which works either way.
    navigate(isAuthenticated ? USER_ROUTES.CART : USER_ROUTES.CART)
  }

  const handleToggleWishlist = () =>
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle: product.brand?.name || product.category?.name || '',
      image: images[0] ?? null,
      imageSrcSet: product.imageSrcSets?.[0] ?? null,
      price: displayPrice,
      originalPrice: product.price,
    })

  const handleShare = async () => {
    const url = `${window.location.origin}${userPath.product(product.id)}`
    // Web Share is the native sheet inside a WebView; feature-detected rather
    // than assumed, with a clipboard fallback and a final fallback of doing
    // nothing loudly rather than throwing (§135).
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url })
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setPincodeStatus(null)
      }
    } catch {
      // User dismissed the share sheet, or the API is unavailable. Not an error.
    }
  }

  const checkPincode = () => {
    // Honest about what this can and cannot say: there is no serviceability
    // API behind it, so it validates the format and says so, rather than
    // fabricating "Delivery available at 560001" for any six digits typed.
    if (!/^\d{6}$/.test(pincode)) {
      setPincodeStatus({ ok: false, message: 'Enter a valid 6-digit PIN code.' })
      return
    }
    setPincodeStatus({
      ok: true,
      message: 'We deliver across India. Exact delivery dates are confirmed at checkout.',
    })
  }

  const breadcrumbs = [
    { name: 'Home', url: `${window.location.origin}${USER_ROUTES.DASHBOARD}` },
    ...(product.category
      ? [
          {
            name: product.category.name,
            url: `${window.location.origin}${userPath.listing({ category: product.category.id })}`,
          },
        ]
      : []),
    { name: product.name },
  ]

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <script
        type="application/ld+json"
        // Breadcrumb schema is separate from the Product schema usePageMeta
        // injects, so both can be present without one overwriting the other.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbStructuredData(breadcrumbs)),
        }}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-2 pb-28 sm:px-6 md:py-8 md:pb-12 lg:px-8">
        {/* Breadcrumb — real links, so each level is navigable and shareable */}
        <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex">
          <Link to={USER_ROUTES.DASHBOARD} className="hover:text-blue-600">
            Home
          </Link>
          {product.category && (
            <>
              <span aria-hidden="true">/</span>
              <Link
                to={userPath.listing({ category: product.category.id })}
                className="hover:text-blue-600"
              >
                {product.category.name}
              </Link>
            </>
          )}
          {product.brand && (
            <>
              <span aria-hidden="true">/</span>
              <Link to={userPath.listing({ brand: product.brand.id })} className="hover:text-blue-600">
                {product.brand.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="truncate font-bold text-slate-900">{product.name}</span>
        </nav>

        {/* Mobile nav bar */}
        <div className="flex items-center justify-between px-1 py-2 md:hidden">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm"
          >
            <HiArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleWishlist}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isWishlisted}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm"
            >
              {isWishlisted ? (
                <HiHeart className="h-4 w-4 fill-red-500 text-red-500" />
              ) : (
                <HiOutlineHeart className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share this product"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm"
            >
              <HiShare className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Gallery */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="relative rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-6">
              <div className="absolute right-4 top-4 z-20 hidden flex-col gap-2 md:flex">
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={isWishlisted}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                >
                  {isWishlisted ? (
                    <HiHeart className="h-5 w-5 fill-red-500 text-red-500" />
                  ) : (
                    <HiOutlineHeart className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share this product"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                >
                  <HiShare className="h-5 w-5" />
                </button>
              </div>

              {/* One image at a time rather than a horizontal scroller holding
                  every full-resolution image at once: the gallery is the
                  heaviest thing on this page, and on a low-memory device
                  decoding 8 of them simultaneously is what made it stutter
                  (§116). Only the active image and its neighbours load. */}
              <SmartImage
                src={images[activeImageIndex] ?? null}
                srcSet={product.imageSrcSets?.[activeImageIndex] ?? null}
                sizes="(min-width: 1024px) 45vw, 92vw"
                alt={
                  images.length > 1
                    ? `${product.name} — image ${activeImageIndex + 1} of ${images.length}`
                    : product.name
                }
                ratio="1 / 1"
                // The LCP element on this page.
                priority
                className="rounded-2xl"
              />

              {images.length > 1 && (
                <div
                  className="mt-3 flex items-center justify-center gap-1.5"
                  role="tablist"
                  aria-label="Product images"
                >
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={activeImageIndex === idx}
                      aria-label={`Show image ${idx + 1}`}
                      onClick={() => setActiveImageIndex(idx)}
                      // 40px tap target with a smaller visual dot inside.
                      className="flex h-10 w-6 items-center justify-center"
                    >
                      <span
                        className={`h-2 rounded-full transition-all ${
                          activeImageIndex === idx ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="hidden items-center justify-center gap-3 md:flex">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`Show image ${idx + 1}`}
                    className={`rounded-2xl border p-1 transition-all ${
                      activeImageIndex === idx
                        ? 'border-blue-600 shadow-md ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <SmartImage
                      src={img}
                      srcSet={product.imageSrcSets?.[idx] ?? null}
                      sizes="72px"
                      alt=""
                      ratio="1 / 1"
                      className="w-16 rounded-xl"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <HiShieldCheck className="mx-auto h-4 w-4 text-blue-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">100% Genuine</span>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <HiArrowPath className="mx-auto h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">7 Days Return</span>
                </div>
                <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <HiTruck className="mx-auto h-4 w-4 text-indigo-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">Express Courier</span>
                </div>
              </div>
            </div>
          </div>

          {/* Buy box */}
          <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm lg:p-8">
            <div className="space-y-2 border-b border-slate-100 pb-4">
              {product.sku && (
                <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  SKU: {product.sku}
                </span>
              )}
              <h1 className="text-xl font-black leading-tight text-slate-900 lg:text-3xl">
                {product.name}
              </h1>
              {(product.brand || product.category) && (
                <p className="text-xs font-semibold text-slate-500">
                  {[product.brand?.name, product.category?.name].filter(Boolean).join(' · ')}
                </p>
              )}

              {/* Only rendered when reviews actually exist — no fabricated
                  "4.5 (1,200)" under a brand new listing. */}
              {product.reviewsCount > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-0.5 text-xs font-black text-slate-950">
                    <span>{product.rating.toFixed(1)}</span>
                    <HiStar className="h-3.5 w-3.5 fill-slate-950" aria-hidden="true" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reviews')}
                    className="text-xs font-bold text-slate-600 hover:text-blue-600 hover:underline"
                  >
                    ({product.reviewsCount.toLocaleString('en-IN')} reviews)
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-black text-slate-900 lg:text-3xl">
                  {'₹'}
                  {displayPrice.toLocaleString('en-IN')}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-sm font-semibold text-slate-400 line-through">
                      {'₹'}
                      {product.price.toLocaleString('en-IN')}
                    </span>
                    {product.discountPercent > 0 && (
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-sm font-black text-emerald-600">
                        {product.discountPercent}% OFF
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500">Inclusive of all taxes.</p>

              <div className="pt-1" aria-live="polite">
                {!inStock ? (
                  <span className="text-xs font-bold text-red-600">Out of stock</span>
                ) : lowStock ? (
                  <span className="text-xs font-bold text-amber-600">
                    Only {product.stock} left in stock
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <HiCheck className="h-4 w-4" aria-hidden="true" />
                    <span>In stock</span>
                  </span>
                )}
              </div>
            </div>

            {/* Delivery check */}
            <div className="space-y-2 border-t border-slate-100 pt-2">
              <label
                htmlFor="pincode"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-900"
              >
                <HiMapPin className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>Delivery &amp; service availability</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="pincode"
                  // type/inputMode/autoComplete together are what make the
                  // WebView open a numeric keypad and offer the saved PIN code
                  // (§101, §102).
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, ''))
                    setPincodeStatus(null)
                  }}
                  placeholder="6-digit PIN code"
                  className="w-44 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={checkPincode}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Check
                </button>
              </div>

              {pincodeStatus && (
                <p
                  role="status"
                  className={`pt-1 text-xs font-bold ${pincodeStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {pincodeStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock || addState === 'adding'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-700 bg-white px-4 py-4 text-xs font-extrabold tracking-wide text-blue-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addState === 'added' ? (
                  <>
                    <HiCheck className="h-5 w-5" aria-hidden="true" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <HiOutlineShoppingBag className="h-5 w-5" aria-hidden="true" />
                    <span>{addState === 'adding' ? 'Adding…' : 'Add to Cart'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!inStock || addState === 'adding'}
                className="w-full rounded-2xl bg-blue-700 px-4 py-4 text-xs font-extrabold tracking-wide text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Secondary content. Everything below this point is allowed to fail
            without taking the buy box with it (§12, §75). */}
        <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm lg:p-8">
          <div
            role="tablist"
            aria-label="Product information"
            className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3"
          >
            {[
              { id: 'description', label: 'Product Overview' },
              {
                id: 'reviews',
                label: `Customer Reviews${product.reviewsCount > 0 ? ` (${product.reviewsCount})` : ''}`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-2xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'description' ? (
            <div className="space-y-4 text-xs leading-relaxed text-slate-600">
              <h2 className="text-sm font-black text-slate-900">Product Overview</h2>
              {/* Plain text, not dangerouslySetInnerHTML: the description is
                  vendor-supplied, and rendering it as HTML would make every
                  product page a stored-XSS vector. */}
              <p className="whitespace-pre-line">
                {product.description || 'No description has been provided for this product yet.'}
              </p>
            </div>
          ) : (
            <SectionErrorBoundary label="Reviews">
              <ReviewsTab productId={productId} product={product} />
            </SectionErrorBoundary>
          )}
        </div>

        <SectionErrorBoundary label="Similar products">
          <RelatedProducts productId={productId} />
        </SectionErrorBoundary>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ReviewsTab({ productId, product }) {
  const [page, setPage] = useState(1)
  const { reviews, summary, pagination, isLoading, error, refetch } = useProductReviewsController(
    productId,
    { page },
  )

  const average = summary?.average ?? product.rating
  const count = summary?.count ?? product.reviewsCount

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50 p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          {count > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-slate-900">{average.toFixed(1)}</span>
                <div className="flex text-amber-400" aria-label={`${average.toFixed(1)} out of 5`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <HiStar
                      key={s}
                      aria-hidden="true"
                      className={`h-5 w-5 ${s <= Math.round(average) ? 'fill-amber-400' : 'fill-slate-200'}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Based on {count.toLocaleString('en-IN')} verified buyer{' '}
                {count === 1 ? 'review' : 'reviews'}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-slate-500">No reviews yet.</p>
          )}
        </div>

        <Link
          to="/app/reviews"
          className="self-start rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 sm:self-auto"
        >
          Write a Review
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : reviews.length === 0 ? (
        <p className="py-6 text-center text-xs font-semibold text-slate-400">
          No reviews yet — be the first to review this product.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-bold text-slate-900">{review.author}</span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                      <HiCheck className="h-3 w-3" aria-hidden="true" />
                      <span>Verified Buyer</span>
                    </span>
                  </div>
                  <time
                    dateTime={review.createdAt}
                    className="shrink-0 text-[10px] text-slate-400"
                  >
                    {new Date(review.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <div className="flex text-amber-400" aria-label={`${review.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <HiStar
                      key={s}
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 ${s <= review.rating ? 'fill-amber-400' : 'fill-slate-200'}`}
                    />
                  ))}
                </div>
                {review.reviewText && (
                  <p className="font-medium leading-relaxed text-slate-700">{review.reviewText}</p>
                )}
                {review.photos.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    {review.photos.map((photo, idx) => (
                      <SmartImage
                        key={idx}
                        src={photo}
                        sizes="56px"
                        alt={`Photo ${idx + 1} from this review`}
                        ratio="1 / 1"
                        fit="cover"
                        className="w-14 rounded-lg border border-slate-200"
                      />
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RelatedProducts({ productId }) {
  const { products, isLoading } = useRelatedProductsController(productId)

  // No rail at all rather than an empty "Similar Products" heading over
  // nothing — and never the product itself, which the endpoint excludes.
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black text-slate-900">Similar Products</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 8).map((related) => (
          <ProductCard key={related.id} product={related} />
        ))}
      </div>
    </section>
  )
}

function ProductDetailSkeleton() {
  // Shaped like the real page so nothing jumps when the data lands.
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50">
      <div className="hidden md:block">
        <WebHeader />
      </div>
      <main
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
        aria-busy="true"
        aria-label="Loading product"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-4 pt-6">
              <div className="h-14 animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-14 animate-pulse rounded-2xl bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
