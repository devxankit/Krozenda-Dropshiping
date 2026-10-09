import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NAV_HEIGHT, Screen } from '../../../../components/layout/Screen'
import { ErrorState } from '../../../../components/ui/AsyncBoundary'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, PressableScale, fadeIn, usePop } from '../../../../components/ui/motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES } from '../../../../config/routes'
import { env } from '../../../../config/env'
import { useCartCount, useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'
import { useProductController, useRelatedProductsController } from '../../controllers/useProductsController'
import { useProductReviewsController } from '../../controllers/useProductReviewsController'
import { DeliveryCheckCard } from './DeliveryCheckCard'
import { CartQuantityStepper } from './CartQuantityStepper'
import { ProductCard } from './ProductCard'

const LOW_STOCK_THRESHOLD = 5

// "Write a Review" target: the buyer's review screen (src/app/(protected)/reviews.js).
const REVIEWS_ROUTE = '/reviews'

export function ProductDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // From the route param, not router state - this is what makes the page linkable, shareable and
  // reachable from a push notification.
  const { productId: rawProductId } = useLocalSearchParams()
  const productId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId

  const { product, isLoading, isError, error, refetch } = useProductController(productId)

  const scrollRef = useRef(null)
  const buyBoxY = useRef(0)
  const pickerY = useRef(0)
  const resetTimer = useRef(null)

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('description')
  const [addState, setAddState] = useState('idle') // idle | adding | added
  // Which option the buyer has picked. If null, defaults to first available in-stock variant.
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const [variantError, setVariantError] = useState(false)
  const [buyNowState, setBuyNowState] = useState('idle') // idle | buying
  const [refreshing, setRefreshing] = useState(false)

  const isWishlisted = useWishlistStore((state) => state.items.some((item) => item.id === productId))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addToCart = useCartStore((state) => state.addItem)
  const cartCount = useCartCount()

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const images = product?.images?.length ? product.images : []

  // Swipe the gallery image left/right. Only a mostly-horizontal drag claims the gesture, so the page's
  // vertical scroll keeps working; the ref gives the responder the current count without rebuilding it.
  const [gallery] = useState(() => ({ count: 0 }))
  useEffect(() => {
    gallery.count = images.length
  }, [gallery, images.length])
  const [swipeResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        const count = gallery.count
        if (count < 2 || Math.abs(g.dx) < 40) return
        setActiveImageIndex((i) => (g.dx < 0 ? Math.min(i + 1, count - 1) : Math.max(i - 1, 0)))
      },
    }),
  )
  const variants = product?.variants ?? []
  const hasVariants = variants.length > 0
  const variantLabels = useMemo(() => shortVariantLabels(product?.variants ?? []), [product?.variants])

  // Defaults to the first in-stock variant if none explicitly picked
  const activeVariantId = selectedVariantId ?? (variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? null)
  const selectedVariant = hasVariants ? (variants.find((v) => v.id === activeVariantId) ?? null) : null

  // How many of the SELECTED line are already in the cart.
  const cartQuantity = useCartStore(
    (state) => state.items.find((i) => i.id === productId && (i.variantId ?? null) === activeVariantId)?.quantity ?? 0,
  )

  // Price and stock both come from the chosen variant once there is one. A product with variants
  // and none chosen shows the cheapest option as a "from" price.
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

  const inStock = availableStock > 0
  const lowStock = inStock && availableStock <= LOW_STOCK_THRESHOLD
  const needsVariantChoice = hasVariants && !selectedVariant
  const moq = product?.moq ?? 1

  const handleSelectVariant = (id) => {
    setSelectedVariantId(id)
    setVariantError(false)
  }

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  // ---- loading / error / not-found -----------------------------------------
  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (isError || !product) {
    // A 404 is a genuinely different situation from "the request failed".
    const isNotFound = error?.status === 404
    return (
      <Screen scroll={false}>
        <View style={styles.centerWrap}>
          {isNotFound ? (
            <View style={{ alignItems: 'center', gap: 16 }}>
              <Text style={styles.notFoundTitle}>This product is no longer available</Text>
              <Text style={styles.notFoundBody}>It may have been removed by the seller or delisted from the catalog.</Text>
              <Pressable onPress={() => router.push(USER_ROUTES.LISTING)} style={styles.notFoundBtn}>
                <Text style={styles.notFoundBtnText}>Browse other products</Text>
              </Pressable>
            </View>
          ) : (
            <ErrorState error={error} onRetry={refetch} style={{ maxWidth: 448 }} />
          )}
        </View>
      </Screen>
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

  // A product with a minimum order quantity is added AT that quantity.
  const addQuantity = Math.max(1, moq)

  const scrollToVariantPicker = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, buyBoxY.current + pickerY.current - 120), animated: true })
  }

  const handleAddToCart = async () => {
    if (needsVariantChoice) {
      setVariantError(true)
      toast.warning('Select Options', 'Please choose your preferred variant before adding to cart.')
      scrollToVariantPicker()
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
      resetTimer.current = setTimeout(() => setAddState('idle'), 1800)
    } else {
      setAddState('idle')
      toast.error('Could not add to cart', result?.error)
    }
  }

  const handleBuyNow = async () => {
    if (needsVariantChoice) {
      setVariantError(true)
      toast.warning('Select Options', 'Please choose your preferred variant before proceeding.')
      scrollToVariantPicker()
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
    // Direct checkout: go straight to address selection. The button stays on "Proceeding..." while
    // the checkout screen takes over, then resets if the buyer comes back.
    router.push(USER_ROUTES.CHECKOUT_ADDRESS)
    setBuyNowState('idle')
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
    // The public web URL, so the link opens for anyone (and the app via deep link).
    const url = `${env.webOrigin}/app/product/${product.id}`
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { title: product.name, message: product.name, url }
          : { title: product.name, message: `${product.name}\n${url}` },
      )
    } catch {
      // User dismissed the share sheet, or sharing is unavailable. Not an error.
    }
  }

  const tabs = [
    { id: 'description', label: 'Product Overview' },
    {
      id: 'reviews',
      label: `Customer Reviews${product.reviewsCount > 0 ? ` (${product.reviewsCount})` : ''}`,
    },
    ...(product.isDropship ? [{ id: 'shipping', label: 'Shipping & Returns' }] : []),
  ]

  return (
    <Screen
      nav
      scrollRef={scrollRef}
      contentStyle={[styles.content, { paddingBottom: NAV_HEIGHT + insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Mobile nav bar */}
      <View style={styles.navBar}>
        <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backBtn, shadows.sm]}>
          <Icon name="HiArrowLeft" size={16} color={colors.slate[700]} />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PressableScale
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share this product"
            style={[styles.squareBtn, shadows.sm]}
          >
            <Icon name="HiShare" size={16} color={colors.slate[700]} />
          </PressableScale>
          {/* The bottom nav has no cart - without this a buyer who just added an item had no way
              to the cart from the product. */}
          <PressableScale
            onPress={() => router.push(USER_ROUTES.CART)}
            accessibilityRole="button"
            accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
            style={[styles.squareBtn, shadows.sm]}
          >
            <Icon name="HiOutlineShoppingBag" size={16} color={colors.slate[700]} />
            {cartCount > 0 ? <CartBadge count={cartCount} /> : null}
          </PressableScale>
        </View>
      </View>

      {/* Gallery */}
      <View style={[styles.galleryCard, shadows.sm]}>
        <View style={styles.galleryActions}>
          <WishlistButton isWishlisted={isWishlisted} onToggle={handleToggleWishlist} />
        </View>

        {/* One image at a time rather than a scroller holding every full-resolution image. */}
        <Animated.View key={activeImageIndex} entering={fadeIn} {...swipeResponder.panHandlers}>
          <SmartImage
            src={images[activeImageIndex] ?? null}
            srcSet={product.imageSrcSets?.[activeImageIndex] ?? null}
            displayWidth={360}
            alt={
              images.length > 1
                ? `${product.name} — image ${activeImageIndex + 1} of ${images.length}`
                : product.name
            }
            ratio="1 / 1"
            priority
            style={{ borderRadius: radius['2xl'] }}
          />
        </Animated.View>

        {images.length > 1 ? (
          <View style={styles.dots} accessibilityRole="tablist">
            {images.map((_, idx) => (
              <Pressable
                key={idx}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeImageIndex === idx }}
                accessibilityLabel={`Show image ${idx + 1}`}
                onPress={() => setActiveImageIndex(idx)}
                // 40px tap target with a smaller visual dot inside.
                style={styles.dotHit}
              >
                <View
                  style={{
                    height: 8,
                    width: activeImageIndex === idx ? 20 : 8,
                    borderRadius: 9999,
                    backgroundColor: activeImageIndex === idx ? colors.blue[600] : colors.slate[300],
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Buy box */}
      <View style={[styles.buyBox, shadows.sm]} onLayout={(e) => (buyBoxY.current = e.nativeEvent.layout.y)}>
        {/* 1. Identity */}
        <View style={styles.identity}>
          {product.brand || product.category ? (
            <Text noTranslate style={styles.eyebrow}>
              {[product.brand?.name, product.category?.name].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text noTranslate style={styles.title}>
            {product.name}
          </Text>
          {product.sku ? (
            <Text noTranslate style={styles.sku}>{`SKU: ${product.sku}`}</Text>
          ) : null}

          {/* Only rendered when reviews actually exist. */}
          {product.reviewsCount > 0 ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingPill}>
                <Text noTranslate style={styles.ratingPillText}>
                  {product.rating.toFixed(1)}
                </Text>
                <Icon name="HiStar" size={14} color={colors.slate[950] ?? '#020617'} />
              </View>
              <Pressable onPress={() => setActiveTab('reviews')}>
                <Text noTranslate style={styles.reviewsLink}>
                  {`(${product.reviewsCount.toLocaleString('en-IN')} reviews)`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* 2. Price & availability */}
        <View style={styles.priceBox}>
          <View style={styles.priceRow}>
            <Text noTranslate style={styles.price}>
              {`₹${displayPrice.toLocaleString('en-IN')}`}
            </Text>
            {hasDiscount ? (
              <>
                <Text noTranslate style={styles.mrp}>
                  {`₹${product.price.toLocaleString('en-IN')}`}
                </Text>
                {product.discountPercent > 0 ? (
                  <View style={styles.offBadge}>
                    <Text noTranslate style={styles.offText}>
                      {`${product.discountPercent}% OFF`}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
          <Text style={styles.taxNote}>Inclusive of all taxes.</Text>

          <View style={styles.chipRow} accessibilityLiveRegion="polite">
            {!inStock ? (
              <View style={[styles.stockChip, { backgroundColor: colors.red[100] }]}>
                <Text style={[styles.stockChipText, { color: colors.red[700] }]}>Out of stock</Text>
              </View>
            ) : lowStock ? (
              <View style={[styles.stockChip, { backgroundColor: colors.amber[100] }]}>
                <Text style={[styles.stockChipText, { color: colors.amber[800] }]}>
                  {`Only ${availableStock} left in stock`}
                </Text>
              </View>
            ) : (
              <View style={[styles.stockChip, { backgroundColor: colors.emerald[100], flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Icon name="HiCheck" size={14} color={colors.emerald[800]} />
                <Text style={[styles.stockChipText, { color: colors.emerald[800] }]}>In stock</Text>
              </View>
            )}
            {moq > 1 ? (
              <View style={[styles.stockChip, { backgroundColor: 'rgba(226,232,240,0.7)' }]}>
                <Text style={[styles.stockChipText, { color: colors.slate[700] }]}>{`Min. order: ${moq} units`}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <VariantPicker
          variants={variants}
          selectedId={activeVariantId}
          onSelect={handleSelectVariant}
          hasError={variantError}
          labels={variantLabels}
          fallbackPrice={product.salePrice ?? product.price}
          onLayoutY={(y) => (pickerY.current = y)}
        />

        <BulkPricingTable tiers={product.priceTiers} unitPrice={displayPrice} />

        {/* Delivery check */}
        <DeliveryCheckCard productId={product.id} />

        {/* 3. Actions */}
        <View style={styles.actions}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Once it is in the cart, "Add to Cart" has nothing left to say - the useful control
                is how many. */}
            <View style={{ flex: 1 }}>
              {cartQuantity > 0 ? (
                <CartQuantityStepper productId={product.id} stock={availableStock} />
              ) : (
                <PressableScale
                  onPress={handleAddToCart}
                  disabled={!inStock || addState === 'adding'}
                  accessibilityRole="button"
                  accessibilityLabel={addState === 'added' ? 'Added to cart' : 'Add to Cart'}
                  style={[
                    styles.addBtn,
                    shadows.sm,
                    addState === 'added' && { backgroundColor: colors.blue[50] },
                    (!inStock || addState === 'adding') && { opacity: 0.5 },
                  ]}
                >
                  {addState === 'added' ? (
                    <Animated.View entering={fadeIn} style={styles.addInner}>
                      <Icon name="HiCheck" size={20} color={colors.blue[700]} />
                      <Text style={styles.addText}>Added</Text>
                    </Animated.View>
                  ) : (
                    <>
                      <Icon name="HiOutlineShoppingBag" size={20} color={colors.blue[700]} />
                      <Text style={styles.addText}>{addState === 'adding' ? 'Adding…' : 'Add to Cart'}</Text>
                    </>
                  )}
                </PressableScale>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={handleBuyNow}
                disabled={!inStock || addState === 'adding' || buyNowState === 'buying'}
                accessibilityRole="button"
                style={[
                  styles.buyBtn,
                  shadows.lg,
                  (!inStock || addState === 'adding' || buyNowState === 'buying') && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buyText}>{buyNowState === 'buying' ? 'Proceeding…' : 'Buy Now'}</Text>
              </PressableScale>
            </View>
          </View>
        </View>

        {/* 4. Assurances. A dropshipping item ships from the supplier on different terms and says
            so here, before the buyer commits. */}
        {product.isDropship ? (
          <>
            <View style={styles.assuranceRow}>
              <Assurance icon="HiCreditCard" tone="blue" iconColor={colors.blue[600]} label="Online Payment Only" />
              <Assurance icon="HiNoSymbol" tone="amber" iconColor={colors.amber[600]} label="No Cancellation" />
              <Assurance icon="HiArrowPath" tone="amber" iconColor={colors.amber[600]} label="No Returns" />
            </View>
            <DropshipShippingNote shipsFrom={product.dropship?.shipsFrom} onMore={() => setActiveTab('shipping')} />
          </>
        ) : (
          <View style={styles.assuranceRow}>
            <Assurance icon="HiShieldCheck" tone="slate" iconColor={colors.blue[600]} label="100% Genuine" />
            {product.isReturnable ? (
              <Assurance icon="HiArrowPath" tone="slate" iconColor={colors.emerald[600]} label="7 Days Return" />
            ) : (
              <Assurance icon="HiArrowPath" tone="amber" iconColor={colors.amber[600]} label="Non-Returnable" />
            )}
            <Assurance icon="HiTruck" tone="slate" iconColor={colors.indigo[600]} label="Express Courier" />
          </View>
        )}
      </View>

      {/* Secondary content. Everything below this point is allowed to fail without taking the buy
          box with it. */}
      <View style={[styles.secondary, shadows.sm]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tab, active && { backgroundColor: colors.slate[900] }, active && shadows.sm]}
              >
                <Text noTranslate={tab.id === 'reviews' && product.reviewsCount > 0} style={[styles.tabText, { color: active ? '#fff' : colors.slate[600] }]}>
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {activeTab === 'description' ? (
          <View style={{ gap: 16 }}>
            <Text style={styles.h2}>Product Overview</Text>
            {/* Plain text, not HTML: the description is vendor-supplied. */}
            <Text noTranslate={Boolean(product.description)} style={styles.bodyText}>
              {product.description || 'No description has been provided for this product yet.'}
            </Text>
          </View>
        ) : activeTab === 'shipping' ? (
          <DropshipPolicy shipsFrom={product.dropship?.shipsFrom} />
        ) : (
          <ReviewsTab productId={productId} product={product} />
        )}
      </View>

      <RelatedProducts productId={productId} />
    </Screen>
  )
}

// ---------------------------------------------------------------------------

// ISO country code -> "China". Falls back to the code itself where Intl.DisplayNames is missing.
function countryName(code) {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

const ASSURANCE_TONES = {
  blue: { backgroundColor: colors.blue[50], borderColor: colors.blue[100] },
  amber: { backgroundColor: colors.amber[50], borderColor: colors.amber[100] },
  slate: { backgroundColor: colors.slate[50], borderColor: colors.slate[100] },
}

function Assurance({ icon, tone, iconColor, label }) {
  return (
    <View style={[styles.assurance, ASSURANCE_TONES[tone]]}>
      <Icon name={icon} size={20} color={iconColor} />
      <Text style={styles.assuranceText}>{label}</Text>
    </View>
  )
}

// Buy-box note for a dropshipped item: it is imported, ships on its own lane, and its freight is a
// separate line at checkout (never baked into the price).
function DropshipShippingNote({ shipsFrom, onMore }) {
  const country = countryName(shipsFrom)
  return (
    <View style={styles.dropNote}>
      <Icon name="HiGlobeAlt" size={20} color={colors.blue[600]} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.dropNoteTitle}>{`Imported item${country ? ` · Ships from ${country}` : ''}`}</Text>
        <Text style={styles.dropNoteBody}>
          Shipped directly from our partner warehouse. Shipping is calculated at checkout and paid online (UPI, cards,
          net banking).
        </Text>
        <Pressable onPress={onMore}>
          <Text style={styles.dropNoteLink}>Shipping &amp; return policy</Text>
        </Pressable>
      </View>
    </View>
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
    <View style={{ gap: 16 }}>
      <Text style={styles.h2}>Shipping &amp; Returns</Text>
      <View style={{ gap: 12 }}>
        {points.map((p) => (
          <View key={p.title} style={styles.policyCard}>
            <Text style={styles.policyTitle}>{p.title}</Text>
            <Text style={[styles.bodyText, { marginTop: 4 }]}>{p.body}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// The like control on the gallery image.
function WishlistButton({ isWishlisted, onToggle }) {
  const popStyle = usePop(isWishlisted)
  return (
    <PressableScale
      onPress={onToggle}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      accessibilityState={{ selected: isWishlisted }}
      style={[
        styles.wishBtn,
        shadows.sm,
        isWishlisted
          ? { borderColor: colors.red[200], backgroundColor: colors.red[50] }
          : { borderColor: colors.slate[200], backgroundColor: 'rgba(255,255,255,0.9)' },
      ]}
    >
      <Animated.View style={popStyle}>
        {isWishlisted ? (
          <Icon name="HiHeart" size={20} color={colors.red[500]} />
        ) : (
          <Icon name="HiOutlineHeart" size={20} color={colors.slate[600]} />
        )}
      </Animated.View>
    </PressableScale>
  )
}

// Cart count badge; pops whenever the count changes (item added / removed).
function CartBadge({ count }) {
  const popStyle = usePop(count)
  return (
    <Animated.View style={[styles.cartBadge, popStyle]}>
      <Text noTranslate style={styles.cartBadgeText}>
        {count > 9 ? '9+' : count}
      </Text>
    </Animated.View>
  )
}

function Stars({ value, size }) {
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon key={s} name="HiStar" size={size} color={s <= value ? colors.amber[400] : colors.slate[200]} />
      ))}
    </View>
  )
}

function ReviewsTab({ productId, product }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const { reviews, summary, pagination, isLoading, error, refetch } = useProductReviewsController(productId, { page })

  const average = summary?.average ?? product.rating
  const count = summary?.count ?? product.reviewsCount

  return (
    <View style={{ gap: 24 }}>
      <View style={styles.reviewSummary}>
        <View style={{ gap: 4 }}>
          {count > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text noTranslate style={styles.avg}>
                  {average.toFixed(1)}
                </Text>
                <Stars value={Math.round(average)} size={20} />
              </View>
              <Text style={styles.basedOn}>
                {`Based on ${count.toLocaleString('en-IN')} verified buyer ${count === 1 ? 'review' : 'reviews'}`}
              </Text>
            </>
          ) : (
            <Text style={styles.basedOn}>No reviews yet.</Text>
          )}
        </View>

        <Pressable
          onPress={() => router.push(REVIEWS_ROUTE)}
          style={({ pressed }) => [styles.writeBtn, shadows.sm, pressed && { backgroundColor: colors.blue[700] }]}
        >
          <Text style={styles.writeText}>Write a Review</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ gap: 12 }} accessibilityLabel="Loading reviews">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 96, borderRadius: radius['2xl'] }} />
          ))}
        </View>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : reviews.length === 0 ? (
        <Text style={styles.noReviews}>No reviews yet — be the first to review this product.</Text>
      ) : (
        <>
          <View style={{ gap: 16 }}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <View style={styles.reviewTop}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text noTranslate numberOfLines={1} style={styles.author}>
                      {review.author}
                    </Text>
                    <View style={styles.verified}>
                      <Icon name="HiCheck" size={12} color={colors.emerald[800]} />
                      <Text style={styles.verifiedText}>Verified Buyer</Text>
                    </View>
                  </View>
                  <Text noTranslate style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Stars value={review.rating} size={14} />
                {review.reviewText ? (
                  <Text noTranslate style={styles.reviewBody}>
                    {review.reviewText}
                  </Text>
                ) : null}
                {review.photos.length > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                    {review.photos.map((photo, idx) => (
                      <View key={idx} style={styles.reviewPhoto}>
                        <SmartImage src={photo} alt={`Photo ${idx + 1} from this review`} ratio="1 / 1" fit="cover" />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {pagination && pagination.totalPages > 1 ? (
            <View style={styles.reviewPager}>
              <Pressable
                disabled={!pagination.hasPrevPage}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[styles.pagerBtn, !pagination.hasPrevPage && { opacity: 0.4 }]}
              >
                <Text style={styles.pagerText}>Previous</Text>
              </Pressable>
              <Text noTranslate style={styles.pagerInfo}>{`Page ${pagination.page} of ${pagination.totalPages}`}</Text>
              <Pressable
                disabled={!pagination.hasNextPage}
                onPress={() => setPage((p) => p + 1)}
                style={[styles.pagerBtn, !pagination.hasNextPage && { opacity: 0.4 }]}
              >
                <Text style={styles.pagerText}>Next</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}

function RelatedProducts({ productId }) {
  const { products, isLoading } = useRelatedProductsController(productId)

  // No rail at all rather than an empty "Similar Products" heading over nothing.
  if (isLoading) {
    return (
      <View style={{ gap: 12 }}>
        <Skeleton style={{ height: 16, width: 160, backgroundColor: colors.slate[200] }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ width: '47%', flexGrow: 1, aspectRatio: 3 / 4, borderRadius: radius['2xl'] }} />
          ))}
        </View>
      </View>
    )
  }

  if (products.length === 0) return null

  const shown = products.slice(0, 8)
  const rows = []
  for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2))

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Similar Products</Text>
      <View style={{ gap: 12 }}>
        {rows.map((row) => (
          <View key={row[0].id} style={{ flexDirection: 'row', gap: 12 }}>
            {row.map((related) => (
              <ProductCard key={related.id} product={related} style={{ flex: 1 }} />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

function ProductDetailSkeleton() {
  // Shaped like the real page so nothing jumps when the data lands.
  return (
    <Screen>
      <View style={{ padding: 16, paddingTop: 24, gap: 32 }} accessibilityLabel="Loading product">
        <Skeleton style={{ aspectRatio: 1, width: '100%', borderRadius: radius['3xl'], backgroundColor: colors.slate[200] }} />
        <View style={{ gap: 16 }}>
          <Skeleton style={{ height: 24, width: '75%', backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ height: 16, width: '50%', backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ height: 32, width: '33%', backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ height: 16, width: '66%', backgroundColor: colors.slate[200] }} />
          <View style={{ flexDirection: 'row', gap: 16, paddingTop: 24 }}>
            <Skeleton style={{ flex: 1, height: 56, borderRadius: radius['2xl'], backgroundColor: colors.slate[200] }} />
            <Skeleton style={{ flex: 1, height: 56, borderRadius: radius['2xl'], backgroundColor: colors.slate[200] }} />
          </View>
        </View>
      </View>
    </Screen>
  )
}

// CJ names every variant "<full product title> <option> <size>", so four colours of one case render
// as four near-identical 60-character buttons. Words shared by EVERY variant at the start or end say
// nothing about which one to pick - drop them and keep what differs. Falls back to the stored names
// if trimming would leave a blank or a duplicate.
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

// The option picker. Rendered only when the product actually has options.
//
// An out-of-stock option stays visible but unselectable: hiding it makes the product look like it
// was never offered in that size.
function VariantPicker({ variants, selectedId, onSelect, hasError, labels, fallbackPrice, onLayoutY }) {
  if (!variants || variants.length === 0) return null

  return (
    <View
      onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}
      style={
        hasError
          ? styles.pickerError
          : { borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 16 }
      }
    >
      <View style={styles.pickerHead}>
        <Text style={styles.pickerTitle}>
          Choose an option
          {!selectedId ? <Text style={styles.pickerRequired}>{'  Required'}</Text> : null}
        </Text>
        {hasError ? <Text style={styles.pickerErrorText}>Please choose an option to continue</Text> : null}
      </View>

      <View style={styles.variantWrap}>
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId
          const isOut = variant.stock <= 0
          const price = variant.salePrice ?? variant.price ?? fallbackPrice

          return (
            <Pressable
              key={variant.id}
              disabled={isOut}
              accessibilityState={{ selected: isSelected, disabled: isOut }}
              onPress={() => onSelect(variant.id)}
              style={[
                styles.variant,
                isOut
                  ? { borderColor: colors.slate[200], backgroundColor: colors.slate[50] }
                  : isSelected
                    ? { borderColor: colors.blue[600], backgroundColor: colors.blue[50] }
                    : { borderColor: colors.slate[200], backgroundColor: '#fff' },
              ]}
            >
              <Text
                noTranslate
                style={[styles.variantLabel, { color: isOut ? colors.slate[400] : isSelected ? colors.blue[900] : colors.slate[900] }]}
              >
                {labels.get(variant.id)}
              </Text>
              <Text
                noTranslate={!isOut}
                style={[styles.variantPrice, { color: isOut ? colors.slate[400] : isSelected ? colors.blue[900] : colors.slate[900] }]}
              >
                {isOut ? 'Out of stock' : `₹${price.toLocaleString('en-IN')}`}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// Quantity breaks. Shown as a table because a buyer comparing 10 vs 50 vs 100 is doing arithmetic.
function BulkPricingTable({ tiers, unitPrice }) {
  if (!tiers || tiers.length === 0) return null

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 16 }}>
      <Text style={styles.bulkTitle}>Bulk pricing</Text>
      <Text style={styles.bulkSub}>The unit price drops automatically at checkout.</Text>

      <View style={{ marginTop: 10 }}>
        <View style={styles.bulkRow}>
          <Text style={styles.bulkHead}>Quantity</Text>
          <Text style={[styles.bulkHead, { textAlign: 'right' }]}>Price per unit</Text>
        </View>
        <View style={[styles.bulkRow, styles.bulkRowBorder]}>
          <Text style={styles.bulkQty}>1 or more</Text>
          <Text noTranslate style={styles.bulkBase}>{`₹${unitPrice.toLocaleString('en-IN')}`}</Text>
        </View>
        {[...tiers]
          .sort((a, b) => a.minQty - b.minQty)
          .map((tier) => (
            <View key={tier.minQty} style={[styles.bulkRow, styles.bulkRowBorder]}>
              <Text style={styles.bulkQty}>{`${tier.minQty} or more`}</Text>
              <Text noTranslate style={styles.bulkTier}>{`₹${tier.price.toLocaleString('en-IN')}`}</Text>
            </View>
          ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 24 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFoundTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900], textAlign: 'center' },
  notFoundBody: { maxWidth: 384, fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center' },
  notFoundBtn: { borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  notFoundBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },

  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  squareBtn: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
  },
  cartBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    height: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: colors.blue[600],
    paddingHorizontal: 4,
  },
  cartBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700', color: '#fff' },

  galleryCard: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 16,
  },
  galleryActions: { position: 'absolute', right: 28, top: 28, zIndex: 20, gap: 8 },
  wishBtn: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1 },
  dots: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dotHit: { height: 40, width: 24, alignItems: 'center', justifyContent: 'center' },

  buyBox: {
    gap: 20,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 20,
  },
  identity: { gap: 8, borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 16 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.55, color: colors.blue[700], textTransform: 'uppercase' },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: colors.slate[900] },
  sku: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[400] },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.amber[400],
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  ratingPillText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#020617' },
  reviewsLink: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[600] },

  priceBox: {
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: 'rgba(248,250,252,0.7)',
    padding: 16,
  },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 4 },
  price: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.slate[900] },
  mrp: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[400], textDecorationLine: 'line-through' },
  offBadge: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.emerald[200],
    backgroundColor: colors.emerald[50],
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  offText: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.emerald[600] },
  taxNote: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stockChip: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  stockChipText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },

  actions: { borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 16 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.blue[700],
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  addInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addText: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.3, color: colors.blue[700] },
  buyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.blue[700],
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  buyText: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.3, color: '#fff' },

  assuranceRow: { flexDirection: 'row', gap: 8 },
  assurance: { flex: 1, alignItems: 'center', gap: 4, borderRadius: radius.xl, borderWidth: 1, padding: 10 },
  assuranceText: { fontSize: 10, lineHeight: 16, fontWeight: '700', color: colors.slate[800], textAlign: 'center' },
  dropNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.blue[100],
    backgroundColor: 'rgba(239,246,255,0.6)',
    padding: 14,
  },
  dropNoteTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  dropNoteBody: { fontSize: 11, lineHeight: 18, color: colors.slate[600] },
  dropNoteLink: { fontSize: 11, lineHeight: 18, fontWeight: '700', color: colors.blue[700] },

  secondary: {
    gap: 24,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 24,
  },
  tabsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.slate[200] },
  tabs: { alignItems: 'center', gap: 8, paddingBottom: 12 },
  tab: { borderRadius: radius['2xl'], paddingHorizontal: 20, paddingVertical: 10 },
  tabText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  h2: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  bodyText: { fontSize: 12, lineHeight: 19.5, color: colors.slate[600] },
  policyCard: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: 'rgba(248,250,252,0.7)',
    padding: 16,
  },
  policyTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },

  reviewSummary: {
    gap: 16,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.slate[50],
    padding: 20,
  },
  avg: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.slate[900] },
  basedOn: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  writeBtn: { alignSelf: 'flex-start', borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  writeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  noReviews: { paddingVertical: 24, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[400], textAlign: 'center' },
  review: {
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 16,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  author: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  verified: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9999,
    backgroundColor: colors.emerald[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 10, lineHeight: 16, fontWeight: '800', color: colors.emerald[800] },
  reviewDate: { fontSize: 10, lineHeight: 16, color: colors.slate[400] },
  reviewBody: { fontSize: 12, lineHeight: 19.5, fontWeight: '500', color: colors.slate[700] },
  reviewPhoto: { width: 56, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate[200] },
  reviewPager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8 },
  pagerBtn: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200], paddingHorizontal: 16, paddingVertical: 10 },
  pagerText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  pagerInfo: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },

  pickerError: {
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.red[500],
    backgroundColor: 'rgba(254,242,242,0.5)',
    padding: 14,
  },
  pickerHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  pickerTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  pickerRequired: { fontSize: 12, fontWeight: '600', color: colors.red[600] },
  pickerErrorText: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.red[600] },
  variantWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { borderRadius: radius.xl, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 8 },
  variantLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  variantPrice: { marginTop: 2, fontSize: 11, lineHeight: 16, fontWeight: '600' },

  bulkTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  bulkSub: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  bulkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  bulkRowBorder: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  bulkHead: { paddingVertical: 0, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3, color: colors.slate[400], textTransform: 'uppercase' },
  bulkQty: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[700] },
  bulkBase: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  bulkTier: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[700] },
})
