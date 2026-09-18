import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiBell,
  HiOutlineShoppingBag,
  HiMagnifyingGlass,
  HiTag,
  HiSparkles,
  HiCheckBadge,
  HiShieldCheck,
  HiTruck,
  HiArrowPath,
  HiCurrencyRupee,
  HiChevronRight,
  HiChevronLeft,
  HiBriefcase,
  HiBuildingOffice2,
  HiBolt,
} from 'react-icons/hi2'
import { useNavigate, Link } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { SectionErrorBoundary } from '../../../../components/common/ErrorBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartCount } from '../../../../lib/cartStore'
import { useUnreadNotificationCount } from '../../../../lib/notificationStore'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useHomeFeed } from '../../controllers/useHomeFeedController'
import { ProductCard } from '../ecommerce/ProductCard'

// Admin-manageable icon/theme keys for the 'promo' and 'strip' banner
// placements — kept to a small fixed set so Tailwind's JIT can see every
// class literally (no dynamic `bg-${theme}-50` string building).
const BANNER_ICON_MAP = {
  truck: HiTruck,
  currency: HiCurrencyRupee,
  shield: HiShieldCheck,
  refresh: HiArrowPath,
  briefcase: HiBriefcase,
  building: HiBuildingOffice2,
  sparkles: HiSparkles,
  tag: HiTag,
}

const PROMO_THEME_CLASSES = {
  emerald: 'bg-gradient-to-br from-emerald-600 via-teal-800 to-slate-950 border-emerald-500/30 hover:border-emerald-400/60 shadow-emerald-950/20',
  purple: 'bg-gradient-to-br from-purple-600 via-indigo-800 to-slate-950 border-purple-500/30 hover:border-purple-400/60 shadow-purple-950/20',
  blue: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-950 border-blue-500/30 hover:border-blue-400/60 shadow-blue-950/20',
  amber: 'bg-gradient-to-br from-amber-500 via-orange-700 to-slate-950 border-amber-500/30 hover:border-amber-400/60 shadow-amber-950/20',
}

const PROMO_TAG_THEME_CLASSES = {
  emerald: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
  purple: 'bg-purple-400/15 text-purple-200 border-purple-400/30',
  blue: 'bg-blue-400/15 text-blue-200 border-blue-400/30',
  amber: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
}

const STRIP_THEME_CLASSES = {
  blue: { icon: 'bg-blue-50 text-blue-600', hover: 'hover:border-blue-300' },
  amber: { icon: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-300' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300' },
  purple: { icon: 'bg-purple-50 text-purple-600', hover: 'hover:border-purple-300' },
}

const FALLBACK_PROMO_CARDS = [
  {
    id: 'promo-dropship',
    tag: 'HIGH MARGIN RESELLING',
    title: 'Earn Upto ₹50,000/mo Dropshipping',
    subtitle: 'Zero inventory investment. We ship under your brand name.',
    icon: 'briefcase',
    theme: 'emerald',
    ctaPath: '/app/listing',
  },
  {
    id: 'promo-wholesale',
    tag: 'VERIFIED FACTORY SUPPLIERS',
    title: 'Direct Wholesale Prices',
    subtitle: '100% Genuine products with manufacturer tax invoice.',
    icon: 'building',
    theme: 'purple',
    ctaPath: '/app/categories',
  },
]

const FALLBACK_TRUST_TILES = [
  { id: 'trust-dispatch', title: '24-48hr Dispatch', subtitle: 'Pan-India Express Air', icon: 'truck', theme: 'blue' },
  { id: 'trust-price', title: 'Direct Factory Price', subtitle: 'Zero Middlemen Margin', icon: 'currency', theme: 'amber' },
  { id: 'trust-quality', title: 'Verified Quality Check', subtitle: '100% Genuine with GST', icon: 'shield', theme: 'emerald' },
  { id: 'trust-replacement', title: '7 Days Replacement', subtitle: 'Safe Escrow Protection', icon: 'refresh', theme: 'purple' },
]

function formatCouponHeadline(coupon) {
  if (coupon.discountType === 'FREE_SHIPPING') return 'Free Shipping On Your Order'
  if (coupon.discountType === 'FIXED') return `Flat ₹${coupon.discountValue} OFF`
  const capped = coupon.maxDiscountAmount ? ` (up to ₹${coupon.maxDiscountAmount})` : ''
  return `Flat ${coupon.discountValue}% OFF${capped}`
}

// Daily flash sale resets at midnight, so the countdown is derived from the
// real clock instead of a fixed offset that used to restart at 2h15m30s on
// every page load/remount regardless of when the user actually arrived.
function getTimeUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diffSeconds = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 1000))
  return {
    hours: Math.floor(diffSeconds / 3600),
    minutes: Math.floor((diffSeconds % 3600) / 60),
    seconds: diffSeconds % 60,
  }
}

const PASTEL_BG_COLORS = [
  'bg-orange-100/80',
  'bg-indigo-100/80',
  'bg-rose-100/80',
  'bg-amber-100/80',
  'bg-pink-100/80',
  'bg-emerald-100/80',
  'bg-sky-100/80',
  'bg-teal-100/80',
]

// REMOVED: FALLBACK_CATEGORIES, FALLBACK_FLASH_SALE, FALLBACK_TRENDING and
// FALLBACK_BRANDS.
//
// These were ~120 lines of invented catalog — "Samsung Galaxy S23 5G, ₹49,999,
// 4.5 (2,351 reviews)", "Apple iPhone 14", six brands with "450+ Products"
// each — rendered whenever an API call returned nothing. A shopper could tap
// one, wishlist it, even add it to their cart; the id was not a real product
// id, so the cart sync silently dropped it and checkout then failed with "your
// cart is empty" for reasons they could not possibly work out.
//
// Empty now means empty: the section hides itself, or says there is nothing
// there yet. See the `hasX` guards in the render below.

const BRAND_LOGO_MAP = {
  boat: '/brands/boat.svg',
  'boat audio': '/brands/boat.svg',
  jbl: '/brands/jbl.svg',
  'jbl audio': '/brands/jbl.svg',
  sony: '/brands/sony.svg',
  nike: '/brands/nike.svg',
  puma: '/brands/puma.svg',
  adidas: '/brands/adidas.svg',
  "levi's": '/brands/levis.svg',
  levis: '/brands/levis.svg',
  roadster: '/brands/roadster.svg',
  samsung: '/brands/samsung.svg',
  philips: '/brands/philips.svg',
  'philips personal care': '/brands/philips.svg',
  havells: '/brands/havells.svg',
  noise: '/brands/noise.svg',
  'noise wearables': '/brands/noise.svg',
  prestige: '/brands/prestige.svg',
  'prestige cookware': '/brands/prestige.svg',
  pigeon: '/brands/pigeon.svg',
  hp: '/brands/hp.svg',
  lenovo: '/brands/lenovo.svg',
  logitech: '/brands/logitech.svg',
  mamaearth: '/brands/mamaearth.svg',
  wow: '/brands/wow.svg',
  'wow skin science': '/brands/wow.svg',
  'krozenda essentials': '/brands/krozenda.svg',
  'integration test brand': '/brands/krozenda.svg',
  apple: '/brands/apple.svg',
  oneplus: '/brands/oneplus.svg',
  xiaomi: '/brands/xiaomi.svg',
}

// REMOVED: BRAND_OFFER_MAP — a hardcoded table mapping brand names to
// discount claims ("Up to 70% OFF", "Min. 40% OFF", "Budget King") that had
// nothing behind them. A brand tile now carries only what the API actually
// knows about that brand.

const getBrandLogo = (brand) => {
  const norm = (brand.name || '').toLowerCase().trim()
  // If brand logo is an old unsplash product photo, prioritize clean SVG
  if (brand.logo && !brand.logo.includes('images.unsplash.com')) {
    return brand.logo
  }
  if (BRAND_LOGO_MAP[norm]) return BRAND_LOGO_MAP[norm]
  for (const [key, path] of Object.entries(BRAND_LOGO_MAP)) {
    if (norm.includes(key)) return path
  }
  return brand.logo || null
}

// The only claim left is one the platform can stand behind: this is the
// brand's official store on Krozenda.
const getBrandOffer = () => 'Official Store'

const heroSlideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

const sectionFadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1.0] },
  },
}

export function HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const cartCount = useCartCount()
  const unreadCount = useUnreadNotificationCount()
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight())

  usePageMeta({
    title: 'Wholesale & Dropshipping Marketplace',
    description:
      'Shop verified wholesale and dropshipping products across electronics, fashion, home and more on Krozenda.',
  })

  // One controller, six independently-failing sections.
  //
  // This replaces a hand-rolled Promise.allSettled inside a useEffect. Two
  // things change that matter: categories and brands are now shared
  // react-query entries, so the header, this page, the category page and every
  // filter panel make ONE request between them instead of one each (§32); and
  // a section that fails is a section that hides itself, rather than falling
  // back to invented products.
  const {
    categories,
    flashSale,
    trending,
    brands,
    banners,
    coupons,
    isLoading,
  } = useHomeFeed()

  // Category Auto-scroll and Arrow Controls
  const categoryScrollRef = useRef(null)
  const [isCategoryPaused, setIsCategoryPaused] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
  }

  const scrollCategories = (direction) => {
    const el = categoryScrollRef.current
    if (!el) return
    const scrollAmount = 280
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
    setTimeout(checkCategoryScroll, 350)
  }

  // Auto-scrolling category rail.
  //
  // Guarded three ways, because a timer that runs forever is exactly the kind
  // of thing that drains a low-end phone inside a WebView (§92, §117):
  //   * paused while the user is touching or hovering the rail
  //   * stopped entirely when the tab/app is backgrounded
  //   * never started at all when the OS asks for reduced motion
  useEffect(() => {
    const el = categoryScrollRef.current
    if (!el || categories.length === 0) return undefined

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return undefined

    let interval = null

    const tick = () => {
      if (isCategoryPaused || document.hidden) return
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 15) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 160, behavior: 'smooth' })
      }
      setTimeout(checkCategoryScroll, 350)
    }

    const start = () => {
      if (interval === null) interval = setInterval(tick, 2800)
    }
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isCategoryPaused, categories.length])

  // Default hero creative, shipped with the app. Not fabricated business data:
  // these are real banner images in /uploads/banners, used only until an admin
  // publishes their own through Marketing > Banners, which then replace them.
  const heroBanners = [
    {
      id: 1,
      image: '/uploads/banners/banner_factory_dropship.webp',
      alt: 'Direct Factory Dropship Hub',
      tag: '\u26A1 DIRECT FACTORY TIER',
      subtitle: 'Dispatch in 24 Hours \u2022 White-Label',
    },
    {
      id: 2,
      image: '/uploads/banners/banner_smart_gadgets.webp',
      alt: 'Next-Gen Audio & Tech Fest',
      tag: '\uD83D\uDD25 AUDIO SPECIAL',
      subtitle: 'Premium ANC headphones & speakers',
    },
    {
      id: 3,
      image: '/uploads/banners/banner_smartphone_carnival.webp',
      alt: 'Flagship Smartphone Carnival',
      tag: '\uD83D\uDCF1 5G CARNIVAL',
      subtitle: 'Latest 5G flagships',
    },
    {
      id: 4,
      image: '/uploads/banners/banner_express_logistics.webp',
      alt: 'White Label Pan-India Logistics',
      tag: '\uD83D\uDE80 FAST DISPATCH',
      subtitle: 'Dispatch within 24 hours \u2022 Express air shipping',
    },
    {
      id: 5,
      image: '/uploads/banners/banner_home_appliances.webp',
      alt: 'Modern Living & Smart Home Fest',
      tag: '\uD83C\uDFE0 HOME ESSENTIALS',
      subtitle: 'Kitchenware, cookware & LED lighting',
    },
  ]
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const [bannerDirection, setBannerDirection] = useState(1)

  const heroDynamicBanners = banners.filter((b) => (b.placement || 'hero') === 'hero')
  const promoDynamicBanners = banners.filter((b) => b.placement === 'promo')
  const stripDynamicBanners = banners.filter((b) => b.placement === 'strip')

  const activeHeroBanners =
    heroDynamicBanners.length > 0
      ? heroDynamicBanners.map((b, idx) => ({
          id: b.id || b._id || idx,
          image: b.image,
          alt: b.title || 'Promotional Banner',
          productId: b.productId,
          tag: b.tag || '',
          subtitle: b.subtitle || '',
        }))
      : heroBanners

  const nextBanner = () => {
    setBannerDirection(1)
    setCurrentBannerIndex((prev) => (prev + 1) % activeHeroBanners.length)
  }

  const prevBanner = () => {
    setBannerDirection(-1)
    setCurrentBannerIndex((prev) => (prev - 1 + activeHeroBanners.length) % activeHeroBanners.length)
  }

  const promoCards = promoDynamicBanners.length > 0 ? promoDynamicBanners : FALLBACK_PROMO_CARDS
  const trustTiles = stripDynamicBanners.length > 0 ? stripDynamicBanners : FALLBACK_TRUST_TILES
  const bestCoupon = coupons[0] || null

  // Auto banner slideshow. Same three guards as the category rail: no timer
  // while the app is backgrounded, and none at all under reduced-motion.
  useEffect(() => {
    if (activeHeroBanners.length <= 1) return undefined

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return undefined

    let interval = null
    const start = () => {
      if (interval === null) {
        interval = setInterval(() => {
          setBannerDirection(1)
          setCurrentBannerIndex((prev) => (prev + 1) % activeHeroBanners.length)
        }, 5500)
      }
    }
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [activeHeroBanners.length])

  // Countdown Timer — ticks down to real midnight, recomputed from the
  // clock each second so it can never drift or reset out of sync with
  // what other users/tabs see.
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
    // A once-per-second setState is cheap on a desktop and not cheap on a
    // backgrounded low-end phone. Recomputed from the clock on resume, so
    // stopping it can never leave the countdown wrong.
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        setTimeLeft(getTimeUntilMidnight())
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    onNavigateTab(tabId)
    if (tabId === 'categories') navigate(USER_ROUTES.CATEGORIES)
    if (tabId === 'orders') navigate(USER_ROUTES.ORDERS)
    if (tabId === 'wishlist') navigate(USER_ROUTES.WISHLIST)
    if (tabId === 'profile') navigate(USER_ROUTES.PROFILE)
  }

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault()
    const q = mobileSearchQuery.trim()
    // An empty search used to navigate to a results page for the literal
    // string "Products". Now it just goes to the catalog.
    navigate(q ? userPath.search(q) : USER_ROUTES.LISTING)
  }

  const formatTime = (val) => val.toString().padStart(2, '0')

  // Which rails have something real to show. An empty rail is hidden rather
  // than filled with invented products.
  const hasCategories = categories.length > 0
  const hasFlashSale = flashSale.length > 0
  const hasTrending = trending.length > 0
  const hasBrands = brands.length > 0

  // REMOVED: the `xList = dynamicX.length > 0 ? dynamicX : FALLBACK_X` chain
  // and formatProductCard().
  //
  // formatProductCard existed to reshape two incompatible things — real API
  // rows and the hardcoded fallback objects — into one card shape, and it
  // papered over a missing image with '/images/boat_airdopes.png', so a
  // product with no photo showed somebody else's earphones. With the fallbacks
  // gone there is one shape, it comes from the API, and <ProductCard> renders
  // it (with a real "no image" placeholder).

  return (
    <div className="relative w-full min-h-screen bg-slate-50/70 flex flex-col justify-between text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background ambient accents for wide monitors */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-1/4 w-[500px] h-[500px] bg-indigo-400/5 rounded-full blur-3xl" />
      </div>

      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12">
        {/* MOBILE TOP HEADER & SEARCH (Streamlined single unified bar) */}
        <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <Link
              to={USER_ROUTES.DASHBOARD}
              className="flex items-center shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              title="Krozenda Home"
            >
              <img src="/images/logo.png" alt="Krozenda Logo" className="h-8 w-auto object-contain" />
            </Link>

            <form
              onSubmit={handleMobileSearchSubmit}
              className="flex-1 flex items-center bg-slate-100/90 border border-slate-200/80 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-600 focus-within:bg-white transition-all shadow-2xs"
            >
              <HiMagnifyingGlass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="search"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                placeholder="Search products, brands..."
                className="w-full px-2 bg-transparent text-xs font-normal text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </form>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => navigate(USER_ROUTES.NOTIFICATIONS)}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                aria-label="Notifications"
              >
                <HiBell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(USER_ROUTES.CART)}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                aria-label="Cart"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTAINER (Full-width fluid layout without side gutters) */}
        <div className="w-full px-3.5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-3 sm:pt-5 md:pt-6 space-y-6 sm:space-y-8 md:space-y-10">
          {/* Main Top Hero Banner Section with Framer Motion AnimatePresence */}
          <div className="w-full relative overflow-hidden rounded-2xl md:rounded-3xl shadow-card group cursor-pointer aspect-[16/7] sm:aspect-[21/7] lg:aspect-[28/8] min-h-[240px] sm:min-h-[300px] lg:min-h-[380px] bg-slate-900">
            <div
              onClick={() => {
                const cur = activeHeroBanners[currentBannerIndex]
                navigate(cur?.productId ? userPath.product(cur.productId) : USER_ROUTES.LISTING)
              }}
              className="w-full h-full relative overflow-hidden"
            >
              <AnimatePresence initial={false} custom={bannerDirection}>
                <motion.div
                  key={currentBannerIndex}
                  custom={bannerDirection}
                  variants={heroSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.35 },
                  }}
                  className="absolute inset-0 h-full w-full"
                >
                  <SmartImage
                    src={activeHeroBanners[currentBannerIndex]?.image}
                    alt={activeHeroBanners[currentBannerIndex]?.alt}
                    priority
                    sizes="100vw"
                    ratio="auto"
                    fit="cover"
                    className="!absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Floating Callout Badge */}
                  {(activeHeroBanners[currentBannerIndex]?.tag || activeHeroBanners[currentBannerIndex]?.subtitle) && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="absolute bottom-4 left-4 sm:bottom-6 sm:left-8 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 max-w-xl"
                    >
                      {activeHeroBanners[currentBannerIndex]?.tag && (
                        <span className="px-3.5 py-1 rounded-full bg-blue-600/90 text-white font-semibold text-xs tracking-wide shadow-lg backdrop-blur-md border border-blue-400/40">
                          {activeHeroBanners[currentBannerIndex]?.tag}
                        </span>
                      )}
                      {activeHeroBanners[currentBannerIndex]?.subtitle && (
                        <span className="px-3.5 py-1 rounded-full bg-slate-900/80 text-amber-300 font-medium text-xs backdrop-blur-md border border-amber-400/30">
                          {activeHeroBanners[currentBannerIndex]?.subtitle}
                        </span>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Left Chevron Control */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prevBanner()
              }}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-blue-600 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg border border-white/20 hover:scale-105 active:scale-95"
              aria-label="Previous slide"
            >
              <HiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Right Chevron Control */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                nextBanner()
              }}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-blue-600 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg border border-white/20 hover:scale-105 active:scale-95"
              aria-label="Next slide"
            >
              <HiChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Carousel Dot Indicators */}
            <div className="absolute bottom-3 right-4 sm:bottom-5 sm:right-8 z-20 flex items-center space-x-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
              {activeHeroBanners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setBannerDirection(idx > currentBannerIndex ? 1 : -1)
                    setCurrentBannerIndex(idx)
                  }}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentBannerIndex
                      ? 'w-6 h-2 bg-amber-400 shadow-xs'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* CATEGORY QUICK-BAR */}
          <div
            className={`relative group/catbar py-1 sm:py-2 ${!isLoading.categories && !hasCategories ? 'hidden' : ''}`}
            onMouseEnter={() => setIsCategoryPaused(true)}
            onMouseLeave={() => setIsCategoryPaused(false)}
            onTouchStart={() => setIsCategoryPaused(true)}
            onTouchEnd={() => setTimeout(() => setIsCategoryPaused(false), 2000)}
          >
            {/* Left Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className={`hidden sm:flex absolute -left-2 sm:-left-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-blue-600 text-slate-700 hover:text-white shadow-card border border-slate-200/80 items-center justify-center transition-all duration-200 hover:scale-108 active:scale-95 ${
                canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Scroll left categories"
            >
              <HiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Scrollable Row */}
            <div
              ref={categoryScrollRef}
              onScroll={checkCategoryScroll}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              className="flex items-start overflow-x-auto gap-2 sm:gap-6 md:gap-8 lg:gap-10 text-center px-1 sm:px-2 scroll-smooth no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
            >
              {isLoading.categories ? (
                [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={n} className="flex flex-col items-center shrink-0 space-y-2 w-[68px] sm:w-[82px] md:w-[90px] animate-pulse">
                    <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-slate-200" />
                    <div className="w-12 h-2.5 bg-slate-200 rounded-md mt-1" />
                  </div>
                ))
              ) : (
                categories.map((item, idx) => {
                  const bg = PASTEL_BG_COLORS[idx % PASTEL_BG_COLORS.length]
                  return (
                    <Link
                      key={item.id}
                      to={userPath.listing({ category: item.id })}
                      className="flex flex-col items-center shrink-0 group w-[68px] sm:w-[82px] md:w-[90px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                    >
                      <motion.div
                        whileHover={{ y: -3, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={`w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full ${bg} overflow-hidden shadow-card group-hover:shadow-card-hover transition-all duration-300 border border-slate-200/60 flex items-center justify-center p-1.5`}
                      >
                        <SmartImage
                          src={item.image}
                          alt={item.name}
                          sizes="80px"
                          ratio="1 / 1"
                          fit="contain"
                          className="h-full w-full !bg-transparent object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      </motion.div>
                      <span className="text-[11px] sm:text-xs font-medium text-slate-700 group-hover:text-blue-600 transition-colors text-center leading-tight line-clamp-2 w-full mt-2 break-words">
                        {item.name}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Right Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className={`hidden sm:flex absolute -right-2 sm:-right-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-blue-600 text-slate-700 hover:text-white shadow-card border border-slate-200/80 items-center justify-center transition-all duration-200 hover:scale-108 active:scale-95 ${
                canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Scroll right categories"
            >
              <HiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* FLASH SALE SECTION */}
          <SectionErrorBoundary label="Flash sale">
            {isLoading.flashSale ? (
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-card space-y-4">
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : hasFlashSale ? (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={sectionFadeUp}
                className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-card space-y-4 sm:space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                    <span className="bg-red-600 text-white font-semibold text-xs uppercase tracking-wider px-3 py-1 rounded-lg whitespace-nowrap shadow-xs flex items-center space-x-1.5">
                      <HiBolt className="w-3.5 h-3.5 text-amber-300 animate-pulse" aria-hidden="true" />
                      <span>Flash Sale</span>
                    </span>
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Ends in</span>
                    <div
                      className="flex items-center space-x-1.5 font-mono text-xs font-bold text-slate-900 whitespace-nowrap"
                      role="timer"
                      aria-label={`Ends in ${timeLeft.hours} hours ${timeLeft.minutes} minutes`}
                    >
                      <span className="bg-slate-900 text-white px-2 py-1 rounded-md shadow-2xs">{formatTime(timeLeft.hours)}</span>
                      <span className="text-slate-400 font-bold" aria-hidden="true">:</span>
                      <span className="bg-slate-900 text-white px-2 py-1 rounded-md shadow-2xs">{formatTime(timeLeft.minutes)}</span>
                      <span className="text-slate-400 font-bold" aria-hidden="true">:</span>
                      <span className="bg-slate-900 text-white px-2 py-1 rounded-md shadow-2xs">{formatTime(timeLeft.seconds)}</span>
                    </div>
                  </div>

                  <Link
                    to={userPath.listing({ flashSale: true })}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 group whitespace-nowrap shrink-0"
                  >
                    <span>See all deals</span>
                    <HiChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                  {flashSale.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </motion.section>
            ) : null}
          </SectionErrorBoundary>

          {/* Promotional Feature Bento Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${promoCards.length >= 4 ? 'lg:grid-cols-4' : promoCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 sm:gap-5`}>
            {promoCards.map((card, idx) => {
              const CardIcon = BANNER_ICON_MAP[card.icon] || HiSparkles
              const gradient = PROMO_THEME_CLASSES[card.theme] || PROMO_THEME_CLASSES.blue
              const tagClass = PROMO_TAG_THEME_CLASSES[card.theme] || PROMO_TAG_THEME_CLASSES.blue
              return (
                <motion.div
                  key={card.id || card._id || idx}
                  whileHover={{ y: -5, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className="h-full"
                >
                  <Link
                    to={card.ctaPath || USER_ROUTES.LISTING}
                    className={`${gradient} rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full min-h-[195px] sm:min-h-[215px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 relative overflow-hidden group border`}
                  >
                    {/* Atmospheric Lighting */}
                    <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Top Row: Tag badge & Squircle Glass Icon */}
                    <div className="flex items-start justify-between gap-3 z-10">
                      {card.tag ? (
                        <span
                          className={`${tagClass} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border inline-flex items-center gap-1.5 shadow-2xs`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          {card.tag}
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xs group-hover:bg-white/25 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shrink-0">
                        <CardIcon className="w-5 h-5" aria-hidden="true" />
                      </div>
                    </div>

                    {/* Body: Title and Subtitle */}
                    <div className="mt-4 mb-3 z-10 space-y-1.5 flex-1">
                      <h3 className="text-base sm:text-[17px] font-bold tracking-tight text-white leading-snug group-hover:text-white transition-colors line-clamp-2">
                        {card.title}
                      </h3>
                      <p className="text-xs text-white/80 font-normal leading-relaxed line-clamp-2">
                        {card.subtitle}
                      </p>
                    </div>

                    {/* Bottom: Interactive CTA */}
                    <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white/90 z-10 group-hover:text-white transition-colors">
                      <span>Explore Benefits</span>
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/25 group-hover:translate-x-0.5 transition-all duration-200">
                        <HiChevronRight className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          {/* TRENDING NOW SECTION */}
          <SectionErrorBoundary label="Trending products">
            {isLoading.trending ? (
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-card space-y-4">
                <div className="h-5 w-52 bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : hasTrending ? (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={sectionFadeUp}
                className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-card space-y-4 sm:space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                      <HiCurrencyRupee className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Trending Now</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      High-velocity wholesale products ordered most this week
                    </p>
                  </div>

                  <Link
                    to={userPath.listing({ trending: true })}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 group whitespace-nowrap shrink-0"
                  >
                    <span>View all</span>
                    <HiChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                  {trending.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </motion.section>
            ) : null}
          </SectionErrorBoundary>

          {/* OFFICIAL BRAND STORES */}
          <SectionErrorBoundary label="Brand stores">
            {isLoading.brands ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : hasBrands ? (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={sectionFadeUp}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      Official Brand Stores
                    </h2>
                    <span className="hidden sm:inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      <HiCheckBadge className="w-3 h-3 mr-1 text-emerald-600" aria-hidden="true" /> 100% Genuine
                    </span>
                  </div>
                  <Link
                    to={USER_ROUTES.CATEGORIES}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 shrink-0 group"
                  >
                    <span>Explore all</span>
                    <HiChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-4 text-center">
                  {brands.map((brand) => {
                    const logo = getBrandLogo(brand)
                    return (
                      <motion.div
                        key={brand.id}
                        whileHover={{ y: -4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <Link
                          to={userPath.listing({ brand: brand.id })}
                          className="h-full bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/70 shadow-card hover:shadow-card-hover hover:border-blue-200 transition-all group flex flex-col items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <div className="w-full rounded-xl bg-slate-50/80 border border-slate-100 p-2.5 sm:p-3 group-hover:bg-white group-hover:border-blue-100 transition-colors flex items-center justify-center min-h-[70px]">
                            {logo ? (
                              <SmartImage
                                src={logo}
                                alt={brand.name}
                                sizes="120px"
                                ratio="3 / 2"
                                className="w-full max-h-12 object-contain !bg-transparent"
                              />
                            ) : (
                              <div className="flex aspect-[3/2] items-center justify-center">
                                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase">
                                  {brand.name ? brand.name.slice(0, 2).toUpperCase() : 'BR'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 w-full text-center flex flex-col items-center">
                            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate w-full">
                              {brand.name}
                            </h3>
                            <span className="mt-1 text-[10px] font-medium text-blue-600 bg-blue-50/80 border border-blue-100/80 px-2 py-0.5 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors truncate max-w-full">
                              {getBrandOffer()}
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.section>
            ) : null}
          </SectionErrorBoundary>

          {/* Coupon Banner */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Link
              to={USER_ROUTES.LISTING}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-5 sm:p-7 text-white shadow-card hover:shadow-card-hover transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden group"
            >
              <div className="space-y-1.5 min-w-0 flex-1 z-10">
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">
                  {bestCoupon ? 'SPECIAL PROMOTION' : "TODAY'S PICKS"}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                  {bestCoupon ? formatCouponHeadline(bestCoupon) : "Explore Today's Best Wholesale Deals"}
                </h3>
                <p className="text-xs sm:text-sm text-blue-100 font-normal">
                  {bestCoupon ? (
                    <>
                      Use coupon code <span className="font-bold underline text-white">{bestCoupon.code}</span>
                      {bestCoupon.minOrderAmount > 0
                        ? ` on orders above ₹${bestCoupon.minOrderAmount.toLocaleString('en-IN')}.`
                        : ' at checkout.'}
                    </>
                  ) : (
                    'Verified factory direct prices across electronics, fashion, beauty & home.'
                  )}
                </p>
              </div>

              <span className="bg-white text-blue-700 font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:bg-blue-50 transition-colors shrink-0 flex items-center space-x-1.5 group-hover:scale-105">
                <span>Shop now</span>
                <HiChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>

          {/* Trust strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {trustTiles.map((tile, idx) => {
              const TileIcon = BANNER_ICON_MAP[tile.icon] || HiSparkles
              const theme = STRIP_THEME_CLASSES[tile.theme] || STRIP_THEME_CLASSES.blue
              return (
                <div
                  key={tile.id || tile._id || idx}
                  className={`bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/70 shadow-card flex items-center space-x-3 hover:shadow-card-hover hover:border-blue-200/80 transition-all ${theme.hover}`}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${theme.icon}`}>
                    <TileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{tile.title}</h4>
                    <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">{tile.subtitle}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
