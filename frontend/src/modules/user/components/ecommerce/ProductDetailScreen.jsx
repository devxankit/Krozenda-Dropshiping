import { useMemo, useState } from 'react'
import {
  HiArrowLeft,
  HiArrowPath,
  HiCheck,
  HiCreditCard,
  HiGlobeAlt,
  HiHeart,
  HiNoSymbol,
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
import { Footer } from '../../../../components/layout/Footer'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { SectionErrorBoundary } from '../../../../components/common/ErrorBoundary'
import { DeliveryCheckCard } from './DeliveryCheckCard'
import { CartQuantityStepper } from './CartQuantityStepper'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { toast } from '../../../../lib/toast'
import {
  buildBreadcrumbStructuredData,
  buildProductStructuredData,
  usePageMeta,
} from '../../../../lib/usePageMeta'
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
  const [activeTab, setActiveTab] = useState('description')
  const [addState, setAddState] = useState('idle') // idle | adding | added
  // Which option the buyer has picked. If null, defaults to first available in-stock variant.
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [variantError, setVariantError] = useState(false)
  const [buyNowState, setBuyNowState] = useState('idle') // idle | buying

  const isWishlisted = useWishlistStore((state) => state.items.some((item) => item.id === productId))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addToCart = useCartStore((state) => state.addItem)

  const images = product?.images?.length ? product.images : []
  const variants = product?.variants ?? []
  const hasVariants = variants.length > 0
  const variantLabels = useMemo(() => shortVariantLabels(product?.variants ?? []), [product?.variants])

  // Defaults to the first in-stock variant if none explicitly picked
  const activeVariantId =
    selectedVariantId ?? (variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? null)
  const selectedVariant = hasVariants ? variants.find((v) => v.id === activeVariantId) ?? null : null

  // How many of the SELECTED line are already in the cart.
  const cartQuantity = useCartStore(
    (state) =>
      state.items.find((i) => i.id === productId && (i.variantId ?? null) === activeVariantId)?.quantity ?? 0,
  )

  // Price and stock both come from the chosen variant once there is one. A
  // product with variants and none chosen shows the cheapest option as a
  // "from" price rather than the parent's, which is not a price anyone pays.
  const displayPrice = (() => {
    if (!product) return 0
    if (selectedVariant) return selectedVariant.salePrice ?? selectedVariant.price ?? product.salePrice ?? product.price
    if (hasVariants) {
      return Math.min(...variants.map((v) => v.salePrice ?? v.price ?? product.salePrice ?? product.price))
    }
    return product.salePrice ?? product.price
  })()

  const listPrice = selectedVariant?.price ?? product?.price ?? 0
  const hasDiscount = Boolean(product && listPrice > displayPrice)

  const availableStock = selectedVariant
    ? selectedVariant.stock
    : hasVariants
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : (product?.stock ?? 0)

  // With options on offer and none chosen, the button is enabled — pressing it
  // scrolls to the picker rather than failing silently. `canAdd` is what
  // actually gates the request.
  const inStock = availableStock > 0
  const lowStock = inStock && availableStock <= LOW_STOCK_THRESHOLD
  const needsVariantChoice = hasVariants && !selectedVariant
  const moq = product?.moq ?? 1

  const handleSelectVariant = (id) => {
    setSelectedVariantId(id)
    setVariantError(false)
  }

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
        <div className="sticky top-0 z-50 hidden md:block">
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
    variantId: selectedVariant?.id ?? null,
    name: product.name,
    variant: selectedVariant ? variantLabels.get(selectedVariant.id) : '',
    image: selectedVariant?.image ?? images[0] ?? null,
    imageSrcSet: product.imageSrcSets?.[0] ?? null,
    price: displayPrice,
    originalPrice: listPrice,
    stock: availableStock,
    moq,
  })

  // A product with a minimum order quantity is added AT that quantity — adding
  // one unit of something that cannot be bought in ones just produces a cart
  // that refuses to check out.
  const addQuantity = Math.max(1, moq)

  const handleAddToCart = async () => {
    if (needsVariantChoice) {
      setVariantError(true)
      toast.warning('Select Options', 'Please choose your preferred variant before adding to cart.')
      document.getElementById('pdp-variant-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!inStock) {
      toast.error('Out of Stock', 'This item is currently unavailable.')
      return
    }
    if (addState === 'adding' || buyNowState === 'buying') return
    setAddState('adding')
    const result = await addToCart(cartLineItem(), addQuantity)
    if (result?.ok) {
      setAddState('added')
      toast.success('Added to Bag', `${product.name} has been added to your shopping bag.`)
      setTimeout(() => setAddState('idle'), 1800)
    } else {
      setAddState('idle')
      toast.error('Could not add to cart', result?.error)
    }
  }

  const handleBuyNow = async () => {
    if (needsVariantChoice) {
      setVariantError(true)
      toast.warning('Select Options', 'Please choose your preferred variant before proceeding.')
      document.getElementById('pdp-variant-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!inStock) {
      toast.error('Out of Stock', 'This item is currently unavailable.')
      return
    }
    if (addState === 'adding' || buyNowState === 'buying') return
    setBuyNowState('buying')
    const result = await addToCart(cartLineItem(), addQuantity)
    if (!result?.ok) {
      setBuyNowState('idle')
      toast.error('Could not proceed', result?.error)
      return
    }
    // Direct checkout: navigate directly to address selection screen
    navigate(USER_ROUTES.CHECKOUT_ADDRESS)
  }

  const handleToggleWishlist = () => {
    const wasWishlisted = isWishlisted
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle: product.brand?.name || product.category?.name || '',
      image: images[0] ?? null,
      imageSrcSet: product.imageSrcSets?.[0] ?? null,
      price: displayPrice,
      originalPrice: product.price,
    })
    if (wasWishlisted) {
      toast.info('Removed from Wishlist', `${product.name} removed from your saved items.`)
    } else {
      toast.success('Saved to Wishlist', `${product.name} added to your wishlist.`)
    }
  }

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
        toast.success('Link Copied', 'Product link copied to clipboard.')
      }
    } catch {
      // User dismissed the share sheet, or the API is unavailable. Not an error.
    }
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
      <div className="sticky top-0 z-50 hidden md:block">
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
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this product"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm"
          >
            <HiShare className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-10">
          {/* Gallery */}
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="relative rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-6">
              {/* The heart sits on the image on every screen size, where
                  shoppers look for it. Signed-out likes are kept locally and
                  merged into the account on sign-in, so no auth gate. */}
              {/* Offset = card padding (p-4 / sm:p-6) + 12px, so the buttons sit
                  inside the image rather than straddling its edge. */}
              <div className="absolute right-7 top-7 z-20 flex flex-col gap-2 sm:right-9 sm:top-9">
                <WishlistButton
                  isWishlisted={isWishlisted}
                  onToggle={handleToggleWishlist}
                  className="h-11 w-11 rounded-full"
                />
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share this product"
                  className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white md:flex"
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
          </div>

          {/* Buy box */}
          <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            {/* 1. Identity */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              {(product.brand || product.category) && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  {[product.brand?.name, product.category?.name].filter(Boolean).join(' · ')}
                </p>
              )}
              <h1 className="text-xl font-black leading-tight text-slate-900 lg:text-3xl">
                {product.name}
              </h1>
              {product.sku && (
                <p className="text-[11px] font-semibold text-slate-400">SKU: {product.sku}</p>
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

            {/* 2. Price & availability */}
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
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

              <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                {!inStock ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                    Out of stock
                  </span>
                ) : lowStock ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                    Only {availableStock} left in stock
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    <HiCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>In stock</span>
                  </span>
                )}
                {moq > 1 && (
                  <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                    Min. order: {moq} units
                  </span>
                )}
              </div>
            </div>

            <VariantPicker
              variants={variants}
              selectedId={activeVariantId}
              onSelect={handleSelectVariant}
              hasError={variantError}
              labels={variantLabels}
              fallbackPrice={product.salePrice ?? product.price}
            />

            <BulkPricingTable tiers={product.priceTiers} unitPrice={displayPrice} />

            {/* Delivery check */}
            <DeliveryCheckCard productId={product.id} />

            {/* 3. Actions */}
            <div className="border-t border-slate-100 pt-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Once it is in the cart, "Add to Cart" has nothing left to say —
                    the useful control is how many. */}
                {cartQuantity > 0 ? (
                  <CartQuantityStepper productId={product.id} stock={availableStock} />
                ) : (
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
                )}
  
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!inStock || addState === 'adding' || buyNowState === 'buying'}
                  className="w-full rounded-2xl bg-blue-700 px-4 py-4 text-xs font-extrabold tracking-wide text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buyNowState === 'buying' ? 'Proceeding…' : 'Buy Now'}
                </button>
              </div>
            </div>

            {/* 4. Assurances. A dropshipping item ships from the supplier on
                different terms — online payment only, no cancellation, no
                return — and says so here, before the buyer commits, rather
                than promising a return it cannot honour. */}
            {product.isDropship && (
              <ul className="grid grid-cols-3 gap-2 text-center">
                <li className="space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-2.5">
                  <HiCreditCard className="mx-auto h-5 w-5 text-blue-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">Online Payment Only</span>
                </li>
                <li className="space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-2.5">
                  <HiNoSymbol className="mx-auto h-5 w-5 text-amber-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">No Cancellation</span>
                </li>
                <li className="space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-2.5">
                  <HiArrowPath className="mx-auto h-5 w-5 text-amber-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">No Returns</span>
                </li>
              </ul>
            )}
            {product.isDropship && (
              <DropshipShippingNote shipsFrom={product.dropship?.shipsFrom} onMore={() => setActiveTab('shipping')} />
            )}
            {!product.isDropship && (
              <ul className="grid grid-cols-3 gap-2 text-center">
                <li className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <HiShieldCheck className="mx-auto h-5 w-5 text-blue-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">100% Genuine</span>
                </li>
                {product.isReturnable ? (
                  <li className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <HiArrowPath className="mx-auto h-5 w-5 text-emerald-600" aria-hidden="true" />
                    <span className="block text-[10px] font-bold text-slate-800">7 Days Return</span>
                  </li>
                ) : (
                  <li className="space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-2.5">
                    <HiArrowPath className="mx-auto h-5 w-5 text-amber-600" aria-hidden="true" />
                    <span className="block text-[10px] font-bold text-slate-800">Non-Returnable</span>
                  </li>
                )}
                <li className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <HiTruck className="mx-auto h-5 w-5 text-indigo-600" aria-hidden="true" />
                  <span className="block text-[10px] font-bold text-slate-800">Express Courier</span>
                </li>
              </ul>
            )}
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
              ...(product.isDropship ? [{ id: 'shipping', label: 'Shipping & Returns' }] : []),
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
          ) : activeTab === 'shipping' ? (
            <DropshipPolicy shipsFrom={product.dropship?.shipsFrom} />
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

      <Footer />

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

// ISO country code -> "China". Falls back to the code itself on a browser
// without Intl.DisplayNames rather than showing nothing.
function countryName(code) {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

// Buy-box note for a dropshipped item: it is imported, ships on its own lane,
// and its freight is a separate line at checkout (never baked into the price).
function DropshipShippingNote({ shipsFrom, onMore }) {
  const country = countryName(shipsFrom)
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
      <HiGlobeAlt className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
      <div className="space-y-1 text-[11px] leading-relaxed text-slate-600">
        <p className="text-xs font-bold text-slate-900">
          Imported item{country ? ` · Ships from ${country}` : ''}
        </p>
        <p>
          Shipped directly from our partner warehouse. Shipping is calculated at checkout and paid online
          (UPI, cards, net banking).
        </p>
        <button type="button" onClick={onMore} className="font-bold text-blue-700 hover:underline">
          Shipping &amp; return policy
        </button>
      </div>
    </div>
  )
}

function DropshipPolicy({ shipsFrom }) {
  const country = countryName(shipsFrom)
  const points = [
    {
      title: 'Where it ships from',
      body: country
        ? `This item is dispatched from our partner warehouse in ${country}, not from a local seller.`
        : 'This item is dispatched from our partner warehouse, not from a local seller.',
    },
    {
      title: 'Delivery time',
      body: 'International shipments usually take longer than local orders. Enter your PIN code above for the courier and estimated delivery for your address.',
    },
    {
      title: 'Shipping charges',
      body: 'Shipping is quoted for your address and added at checkout. Free-delivery offers do not cover international shipping.',
    },
    {
      title: 'Payment',
      body: 'Online payment only — Cash on Delivery and wallet balance cannot be used. If your cart also has other items, the whole order is paid online.',
    },
    {
      title: 'Cancellation & returns',
      body: 'Orders for this item cannot be cancelled or returned once placed. If the order cannot be fulfilled after payment, the full amount is refunded automatically to your original payment method.',
    },
  ]

  return (
    <div className="space-y-4 text-xs leading-relaxed text-slate-600">
      <h2 className="text-sm font-black text-slate-900">Shipping &amp; Returns</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <dt className="text-xs font-bold text-slate-900">{p.title}</dt>
            <dd className="mt-1">{p.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// The like control on the gallery image. Size and corner shape come from the
// caller; state and colours live here.
function WishlistButton({ isWishlisted, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      className={`flex items-center justify-center border shadow-sm transition-all active:scale-95 ${
        isWishlisted
          ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
          : 'border-slate-200 bg-white/90 text-slate-600 backdrop-blur hover:border-red-200 hover:text-red-500'
      } ${className}`}
    >
      {isWishlisted ? (
        <HiHeart className="h-5 w-5 fill-red-500" aria-hidden="true" />
      ) : (
        <HiOutlineHeart className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  )
}

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
      <div className="sticky top-0 z-50 hidden md:block">
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

// CJ names every variant "<full product title> <option> <size>", so four
// colours of one case render as four near-identical 60-character buttons.
// Words shared by EVERY variant at the start or end say nothing about which
// one to pick — drop them and keep what differs ("White", "Rose Red"). Falls
// back to the stored names if trimming would leave a blank or a duplicate.
function shortVariantLabels(variants) {
  const names = variants.map((v) => String(v.name ?? '').trim())
  const labels = new Map(variants.map((v, i) => [v.id, names[i]]))
  if (variants.length < 2) return labels

  const words = names.map((n) => n.split(/\s+/))
  const minLen = Math.min(...words.map((w) => w.length))
  const sameAt = (pick) => words.every((w) => pick(w).toLowerCase() === pick(words[0]).toLowerCase())

  let prefix = 0
  while (prefix < minLen && sameAt((w) => w[prefix])) prefix++
  let suffix = 0
  while (prefix + suffix < minLen && sameAt((w) => w[w.length - 1 - suffix])) suffix++

  const trimmed = words.map((w) => w.slice(prefix, w.length - suffix).join(' '))
  if (trimmed.some((t) => !t) || new Set(trimmed.map((t) => t.toLowerCase())).size !== trimmed.length) {
    return labels
  }
  return new Map(variants.map((v, i) => [v.id, trimmed[i]]))
}

// The option picker. Rendered only when the product actually has options, so a
// simple product's page is unchanged.
//
// An out-of-stock option stays visible but unselectable: hiding it makes the
// product look like it was never offered in that size, which is the question
// the buyer came to answer.
function VariantPicker({ variants, selectedId, onSelect, hasError, labels, fallbackPrice }) {
  if (!variants || variants.length === 0) return null

  return (
    <div
      id="pdp-variant-picker"
      className={`rounded-2xl transition-all ${
        hasError
          ? 'border-2 border-red-500 bg-red-50/50 p-3.5 ring-2 ring-red-200'
          : 'border-t border-slate-100 pt-4'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">
          Choose an option
          {!selectedId && <span className="ml-1.5 font-semibold text-red-600">Required</span>}
        </p>
        {hasError && (
          <span className="text-[11px] font-bold text-red-600">
            Please choose an option to continue
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId
          const isOut = variant.stock <= 0
          const price = variant.salePrice ?? variant.price ?? fallbackPrice

          return (
            <button
              key={variant.id}
              type="button"
              disabled={isOut}
              aria-pressed={isSelected}
              onClick={() => onSelect(variant.id)}
              className={`rounded-xl border-2 px-3 py-2 text-left transition-all ${
                isOut
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  : isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'
              }`}
            >
              <span className="block text-xs font-bold">{labels.get(variant.id)}</span>
              <span className="mt-0.5 block text-[11px] font-semibold">
                {isOut ? 'Out of stock' : `₹${price.toLocaleString('en-IN')}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Quantity breaks. Shown as a table because a buyer comparing 10 vs 50 vs 100
// is doing arithmetic, and a paragraph makes them do it in their head.
function BulkPricingTable({ tiers, unitPrice }) {
  if (!tiers || tiers.length === 0) return null

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-bold text-slate-900">Bulk pricing</p>
      <p className="mt-0.5 text-[11px] text-slate-500">The unit price drops automatically at checkout.</p>

      <table className="mt-2.5 w-full text-left">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <th scope="col" className="pb-1">Quantity</th>
            <th scope="col" className="pb-1 text-right">Price per unit</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          <tr className="border-t border-slate-100">
            <td className="py-1.5 font-medium text-slate-700">1 or more</td>
            <td className="py-1.5 text-right font-semibold text-slate-900">₹{unitPrice.toLocaleString('en-IN')}</td>
          </tr>
          {[...tiers]
            .sort((a, b) => a.minQty - b.minQty)
            .map((tier) => (
              <tr key={tier.minQty} className="border-t border-slate-100">
                <td className="py-1.5 font-medium text-slate-700">{tier.minQty} or more</td>
                <td className="py-1.5 text-right font-bold text-emerald-700">₹{tier.price.toLocaleString('en-IN')}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
