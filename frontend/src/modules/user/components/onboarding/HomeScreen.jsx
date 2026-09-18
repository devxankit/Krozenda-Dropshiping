import { useState, useEffect, useRef } from 'react'
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
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'
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
  emerald: 'bg-gradient-to-r from-emerald-700 to-teal-900',
  purple: 'bg-gradient-to-r from-purple-800 to-indigo-900',
  blue: 'bg-gradient-to-r from-blue-600 to-indigo-600',
  amber: 'bg-gradient-to-r from-amber-600 to-orange-700',
}

const PROMO_TAG_THEME_CLASSES = {
  emerald: 'bg-emerald-400/20 text-emerald-300',
  purple: 'bg-purple-400/20 text-purple-300',
  blue: 'bg-blue-400/20 text-blue-100',
  amber: 'bg-amber-400/20 text-amber-100',
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
          setCurrentBannerIndex((prev) => (prev + 1) % activeHeroBanners.length)
        }, 5000)
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
    <div className="relative w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12">
        {/* MOBILE TOP HEADER & SEARCH */}
        <div className="md:hidden">
          <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-xs flex items-center justify-between sticky top-0 z-40">
            <Link
              to={USER_ROUTES.DASHBOARD}
              className="flex items-center shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              title="Krozenda Home"
            >
              <img src="/images/logo.png" alt="Krozenda Logo" className="h-9 w-auto object-contain" />
            </Link>
            <div className="flex items-center space-x-3">
              {/* The desktop header carries this too, but the mobile header is
                  a different component — and mobile is where most buyers who
                  need another language actually are. */}
              <LanguageSwitcher variant="compact" />
              <button
                onClick={() => navigate(USER_ROUTES.NOTIFICATIONS)}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
              >
                <HiBell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => navigate(USER_ROUTES.CART)}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <form
            onSubmit={handleMobileSearchSubmit}
            className="px-4 py-3 bg-white border-b border-slate-200 shadow-xs"
          >
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-2xl px-3.5 py-2">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                placeholder="Search 100,000+ products, brands..."
                className="w-full px-2.5 bg-transparent text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button type="submit" className="text-xs font-bold text-blue-600 shrink-0 ml-1">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* MAIN CONTAINER */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-6 space-y-4 sm:space-y-6 md:space-y-8">
          {/* Main Top Hero Banner Section (Clean Single Full-Width Carousel) */}
          <div className="w-full relative overflow-hidden rounded-2xl md:rounded-3xl shadow-xl group cursor-pointer aspect-[16/7] sm:aspect-[21/8] lg:aspect-[25/8] min-h-[220px] sm:min-h-[280px] lg:min-h-[340px]">
            <div
              onClick={() => {
                const cur = activeHeroBanners[currentBannerIndex]
                navigate(cur?.productId ? userPath.product(cur.productId) : USER_ROUTES.LISTING)
              }}
              className="w-full h-full relative overflow-hidden bg-slate-950"
            >
              {activeHeroBanners.map((banner, idx) => (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    idx === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  <SmartImage
                    src={banner.image}
                    alt={banner.alt}
                    // The hero is the LCP element on this page; only the
                    // currently-visible slide is eager, the rest stay lazy so
                    // five full-width images are not all fetched at once.
                    priority={idx === currentBannerIndex}
                    sizes="100vw"
                    ratio="auto"
                    fit="cover"
                    className="!absolute inset-0 h-full w-full rounded-2xl md:rounded-3xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none" />

                  {/* Floating Callout Badge (admin-managed via Banner tag/subtitle) */}
                  {(banner.tag || banner.subtitle) && (
                    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      {banner.tag && (
                        <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white font-black text-[11px] uppercase tracking-wider shadow-lg backdrop-blur-md border border-blue-400/40">
                          {banner.tag}
                        </span>
                      )}
                      {banner.subtitle && (
                        <span className="px-3 py-1 rounded-full bg-slate-900/80 text-amber-300 font-bold text-[11px] backdrop-blur-md border border-amber-400/30">
                          {banner.subtitle}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Left Chevron Control */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentBannerIndex((prev) => (prev - 1 + activeHeroBanners.length) % activeHeroBanners.length)
              }}
              className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-blue-600 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl border border-white/20"
            >
              <HiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Right Chevron Control */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentBannerIndex((prev) => (prev + 1) % activeHeroBanners.length)
              }}
              className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-blue-600 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl border border-white/20"
            >
              <HiChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Carousel Dot Indicators */}
            <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 z-20 flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
              {activeHeroBanners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentBannerIndex(idx)
                  }}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentBannerIndex
                      ? 'w-5 sm:w-6 h-1.5 sm:h-2 bg-amber-400'
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/50 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* CATEGORY QUICK-BAR. Hidden when the catalog has no categories —
              an empty auto-scrolling rail with arrow buttons reads as broken. */}
          <div
            className={`relative group/catbar py-1 sm:py-2 ${!isLoading.categories && !hasCategories ? 'hidden' : ''}`}
            onMouseEnter={() => setIsCategoryPaused(true)}
            onMouseLeave={() => setIsCategoryPaused(false)}
            onTouchStart={() => setIsCategoryPaused(true)}
            onTouchEnd={() => setTimeout(() => setIsCategoryPaused(false), 2000)}
          >
            {/* Left Scroll Arrow Button - Hidden on mobile */}
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className={`hidden sm:flex absolute -left-1 sm:-left-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-blue-600 text-slate-700 hover:text-white shadow-lg border border-slate-200/90 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
                canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Scroll left categories"
            >
              <HiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Scrollable Row (Scrollbar 100% hidden across all browsers) */}
            <div
              ref={categoryScrollRef}
              onScroll={checkCategoryScroll}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              className="flex items-start overflow-x-auto gap-1.5 sm:gap-6 md:gap-8 lg:gap-10 text-center px-0.5 sm:px-2 scroll-smooth no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
            >
              {isLoading.categories ? (
                [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={n} className="flex flex-col items-center shrink-0 space-y-1.5 w-[64px] sm:w-[78px] md:w-[84px] animate-pulse">
                    <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-slate-200" />
                    <div className="w-12 h-2.5 bg-slate-200 rounded-md mt-1" />
                  </div>
                ))
              ) : (
                categories.map((item, idx) => {
                  const bg = PASTEL_BG_COLORS[idx % PASTEL_BG_COLORS.length]
                  return (
                    // A real link: long-press, open-in-new-tab and keyboard
                    // navigation all work, and the filter is in the URL so the
                    // destination is shareable.
                    <Link
                      key={item.id}
                      to={userPath.listing({ category: item.id })}
                      className="flex flex-col items-center shrink-0 group w-[64px] sm:w-[78px] md:w-[84px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                    >
                      <div
                        className={`w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full ${bg} overflow-hidden shadow-2xs group-hover:scale-108 transition-all duration-300 border border-slate-200/50`}
                      >
                        <SmartImage
                          src={item.image}
                          alt={item.name}
                          sizes="80px"
                          ratio="1 / 1"
                          fit="cover"
                          className="h-full w-full !bg-transparent"
                        />
                      </div>
                      <span className="text-[10.5px] sm:text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors text-center leading-tight line-clamp-2 w-full mt-1.5 break-words">
                        {item.name}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Right Scroll Arrow Button - Hidden on mobile */}
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className={`hidden sm:flex absolute -right-1 sm:-right-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-blue-600 text-slate-700 hover:text-white shadow-lg border border-slate-200/90 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
                canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Scroll right categories"
            >
              <HiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* FLASH SALE — rendered only when there is a real flash sale.
              The old version fell back to four invented products under a
              live countdown, and the API itself used to backfill an empty
              flash-sale query with ordinary newest products, so full-price
              items appeared under a "FLASH SALE / Ends In" header. Both are
              gone: no promotion, no rail. */}
          <SectionErrorBoundary label="Flash sale">
            {isLoading.flashSale ? (
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : hasFlashSale ? (
              <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <span className="bg-red-600 text-white font-black text-[10px] sm:text-xs uppercase px-2.5 py-1 rounded-lg whitespace-nowrap shadow-xs flex items-center space-x-1">
                      <HiBolt className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                      <span>Flash Sale</span>
                    </span>
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Ends in</span>
                    <div
                      className="flex items-center space-x-1 font-mono text-xs font-black text-slate-900 whitespace-nowrap"
                      role="timer"
                      aria-label={`Ends in ${timeLeft.hours} hours ${timeLeft.minutes} minutes`}
                    >
                      <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.hours)}</span>
                      <span aria-hidden="true">:</span>
                      <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.minutes)}</span>
                      <span aria-hidden="true">:</span>
                      <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.seconds)}</span>
                    </div>
                  </div>

                  <Link
                    to={userPath.listing({ flashSale: true })}
                    className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap shrink-0"
                  >
                    See all deals →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {flashSale.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ) : null}
          </SectionErrorBoundary>

          {/* Promotional Highlight Banners (admin-managed via Banner placement='promo') */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promoCards.map((card, idx) => {
              const CardIcon = BANNER_ICON_MAP[card.icon] || HiSparkles
              const gradient = PROMO_THEME_CLASSES[card.theme] || PROMO_THEME_CLASSES.blue
              const tagClass = PROMO_TAG_THEME_CLASSES[card.theme] || PROMO_TAG_THEME_CLASSES.blue
              return (
                <Link
                  key={card.id || card._id || idx}
                  to={card.ctaPath || USER_ROUTES.LISTING}
                  className={`${gradient} rounded-3xl p-6 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
                >
                  <div className="space-y-1 max-w-xs">
                    {card.tag && (
                      <span className={`${tagClass} px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider`}>
                        {card.tag}
                      </span>
                    )}
                    <h3 className="text-lg font-black pt-1">{card.title}</h3>
                    <p className="text-xs text-white/80">{card.subtitle}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 text-white shrink-0">
                    <CardIcon className="w-8 h-8" aria-hidden="true" />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* TRENDING — same rule: hidden when there is nothing trending,
              rather than backfilled with invented "best value picks". */}
          <SectionErrorBoundary label="Trending products">
            {isLoading.trending ? (
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="h-5 w-52 bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : hasTrending ? (
              <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <HiCurrencyRupee className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Trending now</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Products other buyers are ordering most
                    </p>
                  </div>

                  <Link
                    to={userPath.listing({ trending: true })}
                    className="text-xs font-bold text-blue-600 hover:underline shrink-0"
                  >
                    View all →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {trending.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ) : null}
          </SectionErrorBoundary>

          {/* OFFICIAL BRAND STORES — real brands only. The previous version
              fell back to six invented brands with invented product counts
              ("Samsung — 450+ Products") and attached a made-up discount claim
              to each ("Up to 70% OFF"). */}
          <SectionErrorBoundary label="Brand stores">
            {isLoading.brands ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : hasBrands ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 min-w-0">
                    <h2 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Official brand stores
                    </h2>
                    <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <HiCheckBadge className="w-3 h-3 mr-1 text-emerald-600" aria-hidden="true" /> 100% Genuine
                    </span>
                  </div>
                  <Link
                    to={USER_ROUTES.CATEGORIES}
                    className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline flex items-center shrink-0"
                  >
                    Explore all <HiChevronRight className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 text-center">
                  {brands.map((brand) => {
                    const logo = getBrandLogo(brand)
                    return (
                      <Link
                        key={brand.id}
                        to={userPath.listing({ brand: brand.id })}
                        className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-blue-400/80 hover:-translate-y-1.5 transition-all duration-300 group flex flex-col items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <div className="w-full rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-100 p-3 group-hover:bg-white group-hover:border-blue-200/90 transition-all">
                          {logo ? (
                            <SmartImage
                              src={logo}
                              alt={brand.name}
                              sizes="120px"
                              ratio="3 / 2"
                              className="w-full !bg-transparent"
                            />
                          ) : (
                            // No logo on file: the brand's initials, not a
                            // borrowed logo from a lookup table.
                            <div className="flex aspect-[3/2] items-center justify-center">
                              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                {brand.name ? brand.name.slice(0, 2).toUpperCase() : 'BR'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 w-full text-center flex flex-col items-center">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate w-full">
                            {brand.name}
                          </h3>
                          <span className="mt-1 text-[10px] font-bold text-blue-600 bg-blue-50/90 border border-blue-100 px-2.5 py-0.5 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all truncate max-w-full">
                            {getBrandOffer()}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </SectionErrorBoundary>

          {/* Coupon Banner — pulls a real active sitewide coupon; never fabricates a code */}
          <Link
            to={USER_ROUTES.LISTING}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block">
                {bestCoupon ? 'SPECIAL PROMOTION' : "TODAY'S PICKS"}
              </span>
              <h3 className="text-base sm:text-xl font-bold text-white leading-snug">
                {bestCoupon ? formatCouponHeadline(bestCoupon) : "Explore Today's Best Deals"}
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                {bestCoupon ? (
                  <>
                    Use coupon code <span className="font-bold underline text-white">{bestCoupon.code}</span>
                    {bestCoupon.minOrderAmount > 0
                      ? ` on orders above ₹${bestCoupon.minOrderAmount.toLocaleString('en-IN')}.`
                      : ' at checkout.'}
                  </>
                ) : (
                  'Hand-picked wholesale deals across electronics, fashion & more.'
                )}
              </p>
            </div>

            <span className="bg-white text-blue-700 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:bg-blue-50 transition-colors shrink-0 flex items-center space-x-1.5">
              <span>Shop now</span>
              <HiChevronRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </Link>

          {/* Trust strip (moved to the bottom, closing reassurance) — admin-managed via Banner placement='strip' */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {trustTiles.map((tile, idx) => {
              const TileIcon = BANNER_ICON_MAP[tile.icon] || HiSparkles
              const theme = STRIP_THEME_CLASSES[tile.theme] || STRIP_THEME_CLASSES.blue
              return (
                <div
                  key={tile.id || tile._id || idx}
                  className={`bg-white rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-2.5 sm:space-x-3 hover:shadow-xs transition-all ${theme.hover}`}
                >
                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${theme.icon}`}>
                    <TileIcon className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{tile.title}</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{tile.subtitle}</p>
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
