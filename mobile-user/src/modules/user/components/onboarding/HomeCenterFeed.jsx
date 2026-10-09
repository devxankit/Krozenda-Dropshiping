import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Animated as ReAnimated, PressableScale, enterFade } from '../../../../components/ui/motion'
import { resolveImageSource, SmartImage } from '../../../../components/ui/SmartImage'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { colors, radius, shadows } from '../../../../theme'
import { GradientFill } from '../../../auth/components/GradientFill'
import { useCatalogSettingsController, useProductsController } from '../../controllers/useProductsController'
import { ProductCard } from '../ecommerce/ProductCard'

// Port of onboarding/HomeCenterFeed.jsx (phone layout: single column, 2-up product grids; the desktop
// chevrons / hover states / xl-only right sidebar do not exist here).

// All Products' Product-type toggle. 'all' is what a fresh load shows; the other two ask the API to
// filter by Product.fulfillmentProvider so a buyer can isolate CJ-sourced stock from own stock.
const PRODUCT_TYPE_OPTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'dropship', label: 'Dropship only' },
  { value: 'normal', label: 'Regular stock only' },
]

const BANNER_ICON_MAP = {
  truck: 'HiTruck',
  currency: 'HiCurrencyRupee',
  shield: 'HiShieldCheck',
  refresh: 'HiArrowPath',
  briefcase: 'HiBriefcase',
  building: 'HiBuildingOffice2',
  sparkles: 'HiSparkles',
  tag: 'HiTag',
}

const STRIP_THEMES = {
  blue: { bg: colors.blue[50], fg: colors.blue[600] },
  amber: { bg: colors.amber[50], fg: colors.amber[600] },
  emerald: { bg: colors.emerald[50], fg: colors.emerald[600] },
  purple: { bg: colors.purple[50], fg: colors.purple[600] },
}

// bg-<color>-100/80
const PASTEL_BG_COLORS = [
  colors.amber[100],
  colors.orange[100],
  colors.rose[100],
  colors.indigo[100],
  colors.emerald[100],
  colors.sky[100],
  colors.teal[100],
  colors.purple[100],
].map((c) => `${c}cc`)

// Default hero banners reflecting the B2B/B2C marketplace branding (shown until the API has hero banners).
const FALLBACK_BANNERS = [
  {
    id: 'ref-hero-1',
    title: 'Verified Quality Wholesale & Dropshipping',
    image: '/images/banner_smartphone_carnival.webp',
    ctaPath: USER_ROUTES.LISTING,
  },
  {
    id: 'ref-hero-2',
    title: 'Trending Gadgets, Fashion & Electronics',
    image: '/images/banner_factory_dropship.webp',
    ctaPath: USER_ROUTES.LISTING,
  },
]

const itemId = (x) => x.id || x._id

// ---------------------------------------------------------------------------------------------
// Section error boundary: if one rail or card throws, a quiet placeholder replaces it and the rest of
// the page survives (components/common/ErrorBoundary SectionErrorBoundary).
// ---------------------------------------------------------------------------------------------
class SectionErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    if (__DEV__) console.warn('[HomeCenterFeed]', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <View style={styles.boundary}>
        <Text style={styles.boundaryText}>{`${this.props.label || 'This section'} could not be displayed.`}</Text>
        <Pressable onPress={() => this.setState({ failed: false })}>
          <Text style={styles.boundaryRetry}>Retry</Text>
        </Pressable>
      </View>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Countdown to local midnight ("Ends in HH:MM:SS"); paused while the app is in the background
// (the web pauses on visibilitychange).
// ---------------------------------------------------------------------------------------------
function getTimeUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diffSeconds = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 1000))
  return { hours: Math.floor(diffSeconds / 3600), minutes: Math.floor((diffSeconds % 3600) / 60), seconds: diffSeconds % 60 }
}

function CountdownBadge() {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight)
  useEffect(() => {
    let interval = null
    const start = () => {
      if (interval === null) interval = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 1000)
    }
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }
    start()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeLeft(getTimeUntilMidnight())
        start()
      } else {
        stop()
      }
    })
    return () => {
      stop()
      sub.remove()
    }
  }, [])
  const f = (val) => val.toString().padStart(2, '0')
  return (
    <View style={styles.countdown}>
      <Text style={styles.countdownText}>
        <Text style={styles.countdownText}>Ends in </Text>
        <Text noTranslate style={styles.countdownText}>
          {`${f(timeLeft.hours)}:${f(timeLeft.minutes)}:${f(timeLeft.seconds)}`}
        </Text>
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Product grid: 2 columns, gap 12 (grid-cols-2 gap-3).
// ---------------------------------------------------------------------------------------------
function ProductGrid({ products }) {
  const [w, setW] = useState(0)
  const itemW = w > 0 ? (w - 12) / 2 : 0
  return (
    <View style={styles.grid} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {itemW > 0
        ? products.map((product, index) => (
            <AnimatedView key={itemId(product)} entering={index < 6 ? enterFade(index) : undefined} style={{ width: itemW }}>
              <ProductCard product={product} />
            </AnimatedView>
          ))
        : null}
    </View>
  )
}

const AnimatedView = ReAnimated.View

function ProductGridSkeleton({ count = 4 }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <View key={n} style={styles.skelCard}>
          <Skeleton style={styles.skelImage} />
          <Skeleton style={styles.skelLine} />
        </View>
      ))}
    </View>
  )
}

function ViewAll({ label = 'View All', onPress, weight = '700' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.viewAll} hitSlop={10}>
      <Text style={[styles.viewAllText, { fontWeight: weight }]}>{label}</Text>
      <Icon name="HiChevronRight" size={14} color={colors.blue[600]} />
    </Pressable>
  )
}

// ---------------------------------------------------------------------------------------------
// Hero banner: 16:9, auto-advances every 5.5s, slides in the direction of travel.
// ---------------------------------------------------------------------------------------------
function HeroBanner({ banners }) {
  const router = useRouter()
  const [w, setW] = useState(0)
  const [view, setView] = useState({ index: 0, prev: null, dir: 1 })
  const [anim] = useState(() => new Animated.Value(1))
  const indexRef = useRef(0)
  const count = banners.length

  const go = useCallback(
    (next, dir) => {
      indexRef.current = next
      setView((s) => ({ index: next, prev: s.index, dir }))
      anim.setValue(0)
      Animated.timing(anim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setView((s) => ({ ...s, prev: null }))
        },
      )
    },
    [anim],
  )

  // Auto-advance every 5.5s.
  useEffect(() => {
    if (count <= 1) return undefined
    const timer = setInterval(() => go((indexRef.current + 1) % count, 1), 5500)
    return () => clearInterval(timer)
  }, [count, go])

  const cur = banners[view.index % count] || banners[0]
  const prev = view.prev != null ? banners[view.prev % count] : null

  const open = () =>
    router.push(cur.ctaPath || (cur.productId ? userPath.product(cur.productId) : USER_ROUTES.LISTING))

  const slide = (b, style) => (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <SmartImage src={b.image} alt={b.title || 'Krozenda offer'} priority ratio="16 / 9" fit="cover" style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} />
    </Animated.View>
  )

  return (
    <View style={[styles.hero, shadows.card]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {prev
        ? slide(prev, {
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -view.dir * w] }) }],
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          })
        : null}
      {slide(cur, {
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [view.dir * w, 0] }) }],
        opacity: anim.interpolate({ inputRange: [0, 0.8], outputRange: [0, 1], extrapolate: 'clamp' }),
      })}
      <Pressable style={StyleSheet.absoluteFill} onPress={open} accessibilityRole="button" accessibilityLabel={cur.title || 'Krozenda offer'} />

      {count > 1 ? (
        <View style={styles.dots}>
          {banners.map((b, idx) => (
            <Pressable
              key={b.id || idx}
              onPress={() => go(idx, idx > view.index ? 1 : -1)}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${idx + 1}`}
              style={{ padding: 3 }}
            >
              <View
                style={{
                  height: 5,
                  width: idx === view.index ? 18 : 6,
                  borderRadius: 999,
                  backgroundColor: idx === view.index ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Brand logo with the web's fallbacks: API logo -> bundled /brands/<slug>.svg -> initials disc.
// ---------------------------------------------------------------------------------------------
const BRAND_SLUGS = {
  boat: 'boat',
  'boat audio': 'boat',
  noise: 'noise',
  'noise wearables': 'noise',
  philips: 'philips',
  'philips personal care': 'philips',
  prestige: 'prestige',
  'prestige cookware': 'prestige',
  'wow skin science': 'wow',
  'krozenda essentials': 'krozenda',
  "levi's": 'levis',
}

function BrandCardLogo({ brand }) {
  const [imgSrc, setImgSrc] = useState(brand.logo)
  const [hasError, setHasError] = useState(!brand.logo)
  const [prevLogo, setPrevLogo] = useState(brand.logo)
  if (prevLogo !== brand.logo) {
    setPrevLogo(brand.logo)
    setImgSrc(brand.logo)
    setHasError(!brand.logo)
  }

  const handleError = () => {
    const cleanName = (brand.name || '').trim().toLowerCase()
    const slug = BRAND_SLUGS[cleanName] || cleanName.replace(/[^a-z0-9]/g, '')
    const localFallback = `/brands/${slug}.svg`
    if (imgSrc !== localFallback) setImgSrc(localFallback)
    else setHasError(true)
  }

  if (hasError || !imgSrc) {
    return (
      <View style={styles.brandInitials}>
        <GradientFill colors={[colors.blue[600], colors.indigo[600]]} />
        <Text noTranslate style={styles.brandInitialsText}>
          {brand.name ? brand.name.slice(0, 2).toUpperCase() : 'BR'}
        </Text>
      </View>
    )
  }

  return <Image source={resolveImageSource(imgSrc)} contentFit="contain" onError={handleError} style={{ height: 36, width: 85 }} />
}

// ---------------------------------------------------------------------------------------------

export function HomeCenterFeed({
  categories = [],
  flashSale = [],
  trending = [],
  brands = [],
  banners = [],
  isLoading = {},
  trustTiles = [],
}) {
  const router = useRouter()

  // "All Products" strip - the one place on the dashboard that mixes dropship (CJ) and regular stock
  // together with a toggle to tell them apart. The toggle only renders when dropshippingEnabled is
  // true (Admin > CJ Dropshipping > Settings); when it's off CJ products are already excluded
  // server-side, so the toggle would be a dead control.
  const { dropshippingEnabled } = useCatalogSettingsController()
  const [productType, setProductType] = useState('all')
  const effectiveProductType = dropshippingEnabled ? productType : 'all'
  const { products: allProducts, isLoading: isAllProductsLoading } = useProductsController({
    limit: 8,
    sort: 'newest',
    ...(effectiveProductType !== 'all' ? { source: effectiveProductType } : {}),
  })

  const heroBanners = (banners || []).filter((b) => (b.placement === 'hero' || !b.placement) && b.image).slice(0, 5)
  const activeBanners = heroBanners.length > 0 ? heroBanners : FALLBACK_BANNERS

  const hasCategories = categories.length > 0
  const hasFlashSale = flashSale.length > 0
  const hasTrending = trending.length > 0
  const hasBrands = brands.length > 0

  return (
    <View style={styles.feed}>
      {/* 1. HERO BANNER - strict 16:9 so 1920x1080 assets are never cropped */}
      <HeroBanner key={heroBanners.length > 0 ? 'api' : 'fallback'} banners={activeBanners} />

      {/* 2. CIRCULAR CATEGORY QUICK-BAR */}
      {isLoading.categories || hasCategories ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {isLoading.categories
            ? [1, 2, 3, 4, 5, 6, 7].map((n) => (
                <View key={n} style={styles.catSkel}>
                  <Skeleton style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.slate[200] }} />
                  <Skeleton style={{ width: 48, height: 10, borderRadius: 8, backgroundColor: colors.slate[200] }} />
                </View>
              ))
            : categories.map((item, idx) => (
                <PressableScale
                  key={itemId(item)}
                  onPress={() => router.push(userPath.listing({ category: itemId(item) }))}
                  scaleTo={0.94}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  style={styles.catItem}
                >
                  <View style={[styles.catCircle, shadows.card, { backgroundColor: PASTEL_BG_COLORS[idx % PASTEL_BG_COLORS.length] }]}>
                    <SmartImage
                      src={item.image}
                      alt={item.name}
                      ratio="1 / 1"
                      fit="cover"
                      style={{ width: '100%', height: '100%', borderRadius: 999, backgroundColor: 'transparent' }}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.catLabel}>{item.name}</Text>
                </PressableScale>
              ))}
        </ScrollView>
      ) : null}

      {/* 3. HOT DEALS / FLASH SALE */}
      <SectionErrorBoundary label="Hot deals">
        {isLoading.flashSale ? (
          <View style={styles.card}>
            <Skeleton style={{ height: 20, width: 160 }} />
            <ProductGridSkeleton />
          </View>
        ) : hasFlashSale ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.hotTitle}>
                  <Text noTranslate style={[styles.hotTitle, { color: colors.red[500] }]}>🔥 </Text>
                  <Text style={styles.hotTitle}>Hot Deals</Text>
                </Text>
                <CountdownBadge />
              </View>
              <ViewAll onPress={() => router.push(userPath.listing({ flashSale: true }))} />
            </View>
            <ProductGrid products={flashSale} />
          </View>
        ) : null}
      </SectionErrorBoundary>

      {/* 4. TRENDING PRODUCTS */}
      <SectionErrorBoundary label="Trending products">
        {isLoading.trending ? (
          <View style={styles.card}>
            <Skeleton style={{ height: 20, width: 192 }} />
          </View>
        ) : hasTrending ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Icon name="HiCurrencyRupee" size={16} color={colors.emerald[600]} />
                  <Text style={styles.sectionTitle}>Trending High Margins</Text>
                </View>
                <Text style={styles.sectionSub}>Most reordered wholesale products this week</Text>
              </View>
              <ViewAll onPress={() => router.push(userPath.listing({ trending: true }))} />
            </View>
            <ProductGrid products={trending} />
          </View>
        ) : null}
      </SectionErrorBoundary>

      {/* 4.5 ALL PRODUCTS */}
      <SectionErrorBoundary label="All products">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>All Products</Text>
            <ViewAll
              onPress={() => router.push(userPath.listing(effectiveProductType !== 'all' ? { source: effectiveProductType } : {}))}
            />
          </View>

          {dropshippingEnabled ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16 }}
              contentContainerStyle={styles.chips}
            >
              {PRODUCT_TYPE_OPTIONS.map((opt) => {
                const active = productType === opt.value
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setProductType(opt.value)}
                    style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : colors.slate[600] }]}>{opt.label}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : null}

          {isAllProductsLoading ? (
            <ProductGridSkeleton />
          ) : allProducts.length > 0 ? (
            <ProductGrid products={allProducts} />
          ) : (
            <Text style={styles.noProducts}>No products match this filter yet.</Text>
          )}
        </View>
      </SectionErrorBoundary>

      {/* 5. OFFICIAL BRAND STORES */}
      <SectionErrorBoundary label="Brand stores">
        {hasBrands ? (
          <View style={{ gap: 12 }}>
            <View style={[styles.cardHeaderPlain]}>
              <View style={styles.headerLeft}>
                <Text style={styles.sectionTitle}>Official Brand Stores</Text>
                <View style={styles.genuine}>
                  <Icon name="HiCheckBadge" size={12} color={colors.emerald[600]} />
                  <Text style={styles.genuineText}>100% Genuine</Text>
                </View>
              </View>
              <ViewAll label="Explore all" weight="600" onPress={() => router.push(USER_ROUTES.CATEGORIES)} />
            </View>

            <BrandGrid brands={brands.slice(0, 6)} />
          </View>
        ) : null}
      </SectionErrorBoundary>

      {/* 6. TRUST STRIP */}
      <View style={styles.trustGrid}>
        {trustTiles.map((tile, idx) => {
          const theme = STRIP_THEMES[tile.theme] || STRIP_THEMES.blue
          return (
            <View key={tile.id || idx} style={[styles.trustTile, shadows.card]}>
              <View style={[styles.trustIcon, { backgroundColor: theme.bg }]}>
                <Icon name={BANNER_ICON_MAP[tile.icon] || 'HiSparkles'} size={16} color={theme.fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.trustTitle}>{tile.title}</Text>
                <Text numberOfLines={1} style={styles.trustSub}>{tile.subtitle}</Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function BrandGrid({ brands }) {
  const router = useRouter()
  const [w, setW] = useState(0)
  const itemW = w > 0 ? (w - 12) / 2 : 0
  return (
    <View style={styles.grid} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {itemW > 0
        ? brands.map((brand) => (
            <Pressable
              key={itemId(brand)}
              onPress={() => router.push(userPath.listing({ brand: itemId(brand) }))}
              style={[styles.brandCard, shadows.card, { width: itemW }]}
            >
              <View style={styles.brandLogoBox}>
                <BrandCardLogo brand={brand} />
              </View>
              <Text noTranslate numberOfLines={1} style={styles.brandName}>{brand.name}</Text>
            </Pressable>
          ))
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  feed: { flex: 1, minWidth: 0, gap: 20 },

  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius['2xl'], overflow: 'hidden', backgroundColor: colors.slate[900] },
  dots: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  catRow: { alignItems: 'flex-start', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
  catSkel: { width: 68, alignItems: 'center', gap: 8 },
  catItem: { width: 66, alignItems: 'center' },
  catCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(226,232,240,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: { width: '100%', marginTop: 6, textAlign: 'center', fontSize: 11, lineHeight: 13.75, fontWeight: '600', color: colors.slate[700] },

  card: {
    backgroundColor: '#fff',
    borderRadius: radius['3xl'],
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    gap: 16,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  cardHeaderPlain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  hotTitle: { fontSize: 16, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4, color: colors.slate[900] },
  countdown: {
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.6)',
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countdownText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.red[600] },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12, lineHeight: 16, color: colors.blue[600] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: -0.15, color: colors.slate[900] },
  sectionSub: { fontSize: 11, lineHeight: 16.5, fontWeight: '400', color: colors.slate[500] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  skelCard: { width: '48%', flexGrow: 1, backgroundColor: colors.slate[50], borderRadius: 16, padding: 12, gap: 8 },
  skelImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.slate[200], borderRadius: 12 },
  skelLine: { width: '75%', height: 12, backgroundColor: colors.slate[200], borderRadius: 4 },

  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipActive: { backgroundColor: colors.blue[600], borderColor: colors.blue[600] },
  chipIdle: { backgroundColor: '#fff', borderColor: colors.slate[200] },
  chipText: { fontSize: 11, lineHeight: 16.5, fontWeight: '700' },
  noProducts: { paddingVertical: 24, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },

  genuine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.7)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  genuineText: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.emerald[700] },
  brandCard: {
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoBox: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center', padding: 4 },
  brandName: { marginTop: 6, width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[800] },
  brandInitials: { width: 36, height: 36, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...shadows.xs },
  brandInitialsText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },

  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 8 },
  trustTile: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
  },
  trustIcon: { width: 32, height: 32, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  trustTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  trustSub: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },

  boundary: { borderRadius: radius['2xl'], borderWidth: 1, borderStyle: 'dashed', borderColor: colors.slate[300], backgroundColor: '#fff', padding: 24, alignItems: 'center' },
  boundaryText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[600], textAlign: 'center' },
  boundaryRetry: { marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
})
