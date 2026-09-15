import React, { useState, useEffect, useRef } from 'react'
import {
  HiBell,
  HiOutlineShoppingBag,
  HiMagnifyingGlass,
  HiSquares2X2,
  HiTag,
  HiSparkles,
  HiCheckBadge,
  HiShieldCheck,
  HiTruck,
  HiArrowPath,
  HiStar,
  HiHeart,
  HiOutlineHeart,
  HiBuildingStorefront,
  HiCurrencyRupee,
  HiChevronRight,
  HiChevronLeft,
  HiCheck,
  HiDevicePhoneMobile,
  HiComputerDesktop,
  HiShoppingBag,
  HiHome,
  HiBriefcase,
  HiBuildingOffice2,
  HiBolt,
  HiTv,
} from 'react-icons/hi2'
import {
  SiApple,
  SiSamsung,
  SiNike,
  SiXiaomi,
  SiOneplus,
  SiBoat,
} from 'react-icons/si'
import { useNavigate, Link } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'
import { api } from '../../../../lib/axios'
import { useCartCount, useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useUnreadNotificationCount } from '../../../../lib/notificationStore'

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

const FALLBACK_CATEGORIES = [
  { id: '1', name: 'Electronics & Gadgets', img: '/uploads/categories/cat_electronics_gadgets.webp', bg: 'bg-orange-100/80' },
  { id: '2', name: 'Mobiles & Accessories', img: '/uploads/categories/cat_mobiles_accessories.webp', bg: 'bg-indigo-100/80' },
  { id: '3', name: 'Computers & Peripherals', img: '/uploads/categories/cat_computers_peripherals.webp', bg: 'bg-rose-100/80' },
  { id: '4', name: 'Fashion & Apparel', img: '/uploads/categories/cat_fashion_apparel.webp', bg: 'bg-amber-100/80' },
  { id: '5', name: 'Footwear & Sneakers', img: '/uploads/categories/cat_footwear_sneakers.webp', bg: 'bg-pink-100/80' },
  { id: '6', name: 'Beauty & Personal Care', img: '/uploads/categories/cat_beauty_personal_care.webp', bg: 'bg-emerald-100/80' },
  { id: '7', name: 'Home & Living', img: '/uploads/categories/cat_home_living.webp', bg: 'bg-sky-100/80' },
  { id: '8', name: 'Kitchen & Appliances', img: '/uploads/categories/cat_kitchen_appliances.webp', bg: 'bg-teal-100/80' },
  { id: '9', name: 'Fitness & Outdoors', img: '/uploads/categories/cat_fitness_outdoors.webp', bg: 'bg-orange-100/80' },
  { id: '10', name: 'Grocery & Essentials', img: '/uploads/categories/cat_grocery_essentials.webp', bg: 'bg-indigo-100/80' },
  { id: '11', name: 'Toys & Games', img: '/uploads/categories/cat_toys_games.webp', bg: 'bg-rose-100/80' },
  { id: '12', name: 'Automotive Accessories', img: '/uploads/categories/cat_automotive_accessories.webp', bg: 'bg-amber-100/80' },
]

const FALLBACK_FLASH_SALE = [
  {
    id: 'f101',
    name: 'Samsung Galaxy S23 5G',
    subtitle: '(Phantom Black, 128GB)',
    price: 49999,
    originalPrice: 74999,
    discountPercent: 33,
    rating: 4.5,
    reviews: '2,351',
    image: '/images/samsung_s23.png',
  },
  {
    id: 'f102',
    name: 'boAt Airdopes 141',
    subtitle: 'Wireless Bluetooth Earbuds',
    price: 1299,
    originalPrice: 4490,
    discountPercent: 71,
    rating: 4.6,
    reviews: '3,890',
    image: '/images/boat_airdopes.png',
  },
  {
    id: 'f103',
    name: 'Apple iPhone 14 128GB',
    subtitle: '(Blue, 128GB Storage)',
    price: 59999,
    originalPrice: 69900,
    discountPercent: 14,
    rating: 4.7,
    reviews: '5,120',
    image: '/images/iphone_14.png',
  },
  {
    id: 'f104',
    name: 'Portronics Power Bank',
    subtitle: '10000mAh Dual Output Fast Charge',
    price: 1199,
    originalPrice: 2499,
    discountPercent: 52,
    rating: 4.4,
    reviews: '890',
    image: '/images/boat_airdopes.png',
  },
]

const FALLBACK_TRENDING = [
  {
    id: 't201',
    name: 'OnePlus 11R 5G (256GB)',
    subtitle: 'Sonic Black • 16GB RAM',
    price: 39999,
    originalPrice: 44999,
    discountPercent: 11,
    rating: 4.6,
    reviews: '1,450',
    image: '/images/iphone_14.png',
  },
  {
    id: 't202',
    name: 'Noise ColorFit Pulse 2',
    subtitle: '1.8" HD Display Smartwatch',
    price: 1499,
    originalPrice: 4999,
    discountPercent: 70,
    rating: 4.3,
    reviews: '8,210',
    image: '/images/boat_airdopes.png',
  },
  {
    id: 't203',
    name: 'Xiaomi 13 Pro 5G',
    subtitle: 'Leica Professional Triple Camera',
    price: 79999,
    originalPrice: 89999,
    discountPercent: 11,
    rating: 4.5,
    reviews: '620',
    image: '/images/samsung_s23.png',
  },
  {
    id: 't204',
    name: 'Fastrack Revoltt FS1',
    subtitle: 'Bluetooth Calling Smartwatch',
    price: 1799,
    originalPrice: 3995,
    discountPercent: 55,
    rating: 4.4,
    reviews: '3,100',
    image: '/images/boat_airdopes.png',
  },
]

const FALLBACK_BRANDS = [
  { name: 'Samsung', logo: '/brands/samsung.svg', count: '450+ Products' },
  { name: 'Apple', logo: '/brands/apple.svg', count: '210+ Products' },
  { name: 'boAt', logo: '/brands/boat.svg', count: '320+ Products' },
  { name: 'OnePlus', logo: '/brands/oneplus.svg', count: '180+ Products' },
  { name: 'Xiaomi', logo: '/brands/xiaomi.svg', count: '500+ Products' },
  { name: 'Nike', logo: '/brands/nike.svg', count: '290+ Products' },
]

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

const BRAND_OFFER_MAP = {
  boat: 'Up to 70% OFF',
  'boat audio': 'Up to 70% OFF',
  jbl: 'Mega Bass Deals',
  'jbl audio': 'Up to 60% OFF',
  sony: 'Premium Sound',
  nike: 'Min. 40% OFF',
  puma: 'Min. 45% OFF',
  adidas: 'Flat 40% OFF',
  "levi's": 'Up to 50% OFF',
  levis: 'Up to 50% OFF',
  roadster: 'Min. 60% OFF',
  samsung: 'Flagship Deals',
  philips: 'Min. 35% OFF',
  'philips personal care': 'Up to 50% OFF',
  havells: 'Up to 45% OFF',
  noise: 'Up to 65% OFF',
  'noise wearables': 'Up to 65% OFF',
  prestige: 'Kitchen Specials',
  'prestige cookware': 'Up to 45% OFF',
  pigeon: 'Cookware Fest',
  hp: 'Up to 30% OFF',
  lenovo: 'Work & Play',
  logitech: 'Top Accessories',
  mamaearth: 'Natural Care',
  wow: 'Glow Deals',
  'wow skin science': 'Flat 35% OFF',
  'krozenda essentials': 'Top Dropship Picks',
  apple: 'Best Value',
  oneplus: 'Fast Deals',
  xiaomi: 'Budget King',
}

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

const getBrandOffer = (brand) => {
  const norm = (brand.name || '').toLowerCase().trim()
  if (BRAND_OFFER_MAP[norm]) return BRAND_OFFER_MAP[norm]
  for (const [key, offer] of Object.entries(BRAND_OFFER_MAP)) {
    if (norm.includes(key)) return offer
  }
  return 'Official Store'
}

export function HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const wishlistItems = useWishlistStore((state) => state.items)
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addItemToCart = useCartStore((state) => state.addItem)
  const cartCount = useCartCount()
  const [justAddedIds, setJustAddedIds] = useState(() => new Set())
  const unreadCount = useUnreadNotificationCount()
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight())

  // Dynamic Data States
  const [loading, setLoading] = useState(true)
  const [dynamicBanners, setDynamicBanners] = useState([])
  const [dynamicCategories, setDynamicCategories] = useState([])
  const [dynamicFlashSale, setDynamicFlashSale] = useState([])
  const [dynamicTrending, setDynamicTrending] = useState([])
  const [dynamicBrands, setDynamicBrands] = useState([])
  const [dynamicCoupons, setDynamicCoupons] = useState([])

  // Category Auto-scroll and Arrow Controls
  const categoryScrollRef = useRef(null)
  const [isCategoryHovered, setIsCategoryHovered] = useState(false)
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

  // Category Auto Scroll Effect (Pauses on Hover, Loops seamlessly)
  useEffect(() => {
    const el = categoryScrollRef.current
    if (!el) return

    const interval = setInterval(() => {
      if (isCategoryHovered) return // Pause auto scroll when user is interacting/hovering
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 15) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 160, behavior: 'smooth' })
      }
      setTimeout(checkCategoryScroll, 350)
    }, 2800)

    return () => clearInterval(interval)
  }, [isCategoryHovered, dynamicCategories.length])

  const heroBanners = [
    {
      id: 1,
      image: '/uploads/banners/banner_factory_dropship.webp',
      alt: 'Direct Factory Dropship Hub',
      tag: '⚡ DIRECT FACTORY TIER',
      subtitle: 'Dispatch in 24 Hours • White-Label',
    },
    {
      id: 2,
      image: '/uploads/banners/banner_smart_gadgets.webp',
      alt: 'Next-Gen Audio & Tech Fest',
      tag: '🔥 AUDIO SPECIAL',
      subtitle: 'Up to 70% Off Premium ANC Headphones & Speakers',
    },
    {
      id: 3,
      image: '/uploads/banners/banner_smartphone_carnival.webp',
      alt: 'Flagship Smartphone Carnival',
      tag: '📱 5G CARNIVAL',
      subtitle: 'Latest 5G Flagships with Zero Cost EMI & Exchange Bonus',
    },
    {
      id: 4,
      image: '/uploads/banners/banner_express_logistics.webp',
      alt: 'White Label Pan-India Logistics',
      tag: '🚀 FAST DISPATCH',
      subtitle: 'Dispatch Within 24 Hours • Express Air Shipping',
    },
    {
      id: 5,
      image: '/uploads/banners/banner_home_appliances.webp',
      alt: 'Modern Living & Smart Home Fest',
      tag: '🏠 HOME ESSENTIALS',
      subtitle: 'Kitchenware, Cookware & LED Lighting Deals',
    },
  ]
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)

  const heroDynamicBanners = dynamicBanners.filter((b) => (b.placement || 'hero') === 'hero')
  const promoDynamicBanners = dynamicBanners.filter((b) => b.placement === 'promo')
  const stripDynamicBanners = dynamicBanners.filter((b) => b.placement === 'strip')

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
  const bestCoupon = dynamicCoupons[0] || null

  // Fetch Live Data from Backend APIs
  useEffect(() => {
    let isMounted = true
    async function fetchDashboardData() {
      try {
        setLoading(true)
        const [catsRes, flashRes, trendRes, brandsRes, bannersRes, couponsRes] = await Promise.allSettled([
          api.get('/catalog/categories'),
          api.get('/catalog/products', { params: { flashSale: 'true', limit: 8 } }),
          api.get('/catalog/products', { params: { trending: 'true', limit: 8 } }),
          api.get('/catalog/brands'),
          api.get('/catalog/banners'),
          api.get('/catalog/coupons', { params: { limit: 1 } }),
        ])

        if (!isMounted) return

        if (catsRes.status === 'fulfilled' && catsRes.value?.data?.data?.items?.length) {
          setDynamicCategories(catsRes.value.data.data.items)
        }

        if (flashRes.status === 'fulfilled' && flashRes.value?.data?.data?.items?.length) {
          setDynamicFlashSale(flashRes.value.data.data.items)
        }

        if (trendRes.status === 'fulfilled' && trendRes.value?.data?.data?.items?.length) {
          setDynamicTrending(trendRes.value.data.data.items)
        }

        if (brandsRes.status === 'fulfilled' && brandsRes.value?.data?.data?.items?.length) {
          setDynamicBrands(brandsRes.value.data.data.items)
        }

        if (bannersRes.status === 'fulfilled' && bannersRes.value?.data?.data?.items?.length) {
          setDynamicBanners(bannersRes.value.data.data.items)
        }

        if (couponsRes.status === 'fulfilled' && couponsRes.value?.data?.data?.items?.length) {
          setDynamicCoupons(couponsRes.value.data.data.items)
        }
      } catch (err) {
        console.warn('[HomeScreen] Could not load live catalog data, using cache:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [])

  // Auto Banner Slideshow
  useEffect(() => {
    const bannerInterval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % activeHeroBanners.length)
    }, 4000)
    return () => clearInterval(bannerInterval)
  }, [activeHeroBanners.length])

  // Countdown Timer — ticks down to real midnight, recomputed from the
  // clock each second so it can never drift or reset out of sync with
  // what other users/tabs see.
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    onNavigateTab(tabId)
    if (tabId === 'categories') navigate(USER_ROUTES.ROOT + '/categories')
    if (tabId === 'orders') navigate(USER_ROUTES.ROOT + '/orders')
    if (tabId === 'wishlist') navigate(USER_ROUTES.ROOT + '/wishlist')
    if (tabId === 'profile') navigate(USER_ROUTES.ROOT + '/profile')
  }

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault()
    const q = mobileSearchQuery.trim() || 'Products'
    navigate(USER_ROUTES.ROOT + '/search', { state: { query: q } })
  }

  const toggleWishlist = (item, e) => {
    e.stopPropagation()
    toggleWishlistItem(item)
  }

  const isWishlisted = (id) => wishlistItems.some((item) => item.id === id)

  const handleAddToCart = (item, e) => {
    e.stopPropagation()
    addItemToCart({
      id: item.id,
      name: item.name,
      variant: item.subtitle,
      image: item.image,
      price: item.salePrice,
      originalPrice: item.regularPrice,
    })
    setJustAddedIds((prev) => new Set(prev).add(item.id))
    setTimeout(() => {
      setJustAddedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }, 1500)
  }

  const formatTime = (val) => val.toString().padStart(2, '0')

  // Resolved Datasets with Fallback
  const categoriesList = dynamicCategories.length > 0 ? dynamicCategories : FALLBACK_CATEGORIES
  const flashSaleList = dynamicFlashSale.length > 0 ? dynamicFlashSale : FALLBACK_FLASH_SALE
  const trendingList = dynamicTrending.length > 0 ? dynamicTrending : FALLBACK_TRENDING
  const brandsList = dynamicBrands.length > 0 ? dynamicBrands : FALLBACK_BRANDS

  // Helper to format product for card display
  const formatProductCard = (p, defaultSubtitle = '') => {
    const id = p.id || p._id || p.name
    const name = p.name || 'Untitled Product'
    const subtitle = p.subtitle || p.category?.name || p.brand?.name || defaultSubtitle
    const salePrice = Number(p.salePrice ?? p.price ?? 0)
    const regularPrice = Number(p.price ?? p.salePrice ?? 0)
    const discount =
      p.discountPercent ||
      (regularPrice > salePrice && regularPrice > 0
        ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
        : null)
    const image = p.images?.[0] || p.image || '/images/boat_airdopes.png'
    // Only real products (fallback demo data, or once ratings ship) carry a
    // rating — no more fabricating "4.5 (1,200)" under every live DB item.
    const rating = p.rating || null
    const reviews = p.reviews || p.reviewsCount || null
    const savingsAmount = regularPrice > salePrice ? regularPrice - salePrice : 0
    const savings =
      savingsAmount > 0
        ? `Save ₹${savingsAmount.toLocaleString('en-IN')}`
        : 'Special Price'

    return {
      id,
      name,
      subtitle,
      salePrice,
      regularPrice,
      discount,
      image,
      rating,
      reviews,
      savings,
    }
  }

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
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
              >
                <HiBell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
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
                if (cur?.productId) {
                  navigate(USER_ROUTES.ROOT + '/product', { state: { productId: cur.productId } })
                } else {
                  navigate(USER_ROUTES.ROOT + '/listing')
                }
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
                  <img
                    src={banner.image}
                    alt={banner.alt}
                    className="w-full h-full object-cover rounded-2xl md:rounded-3xl transform group-hover:scale-103 transition-transform duration-700"
                    onError={(e) => {
                      e.currentTarget.src = '/uploads/banners/banner_factory_dropship.webp'
                    }}
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

          {/* DYNAMIC CATEGORY QUICK-BAR (Auto-scroll, Responsive Cards & Hidden Scrollbar) */}
          <div
            className="relative group/catbar py-1 sm:py-2"
            onMouseEnter={() => setIsCategoryHovered(true)}
            onMouseLeave={() => setIsCategoryHovered(false)}
            onTouchStart={() => setIsCategoryHovered(true)}
            onTouchEnd={() => setTimeout(() => setIsCategoryHovered(false), 2000)}
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
              {loading && dynamicCategories.length === 0 ? (
                // Shimmer Loading Skeleton
                [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={n} className="flex flex-col items-center shrink-0 space-y-1.5 w-[64px] sm:w-[78px] md:w-[84px] animate-pulse">
                    <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-slate-200" />
                    <div className="w-12 h-2.5 bg-slate-200 rounded-md mt-1" />
                  </div>
                ))
              ) : (
                categoriesList.map((item, idx) => {
                  const bg = item.bg || PASTEL_BG_COLORS[idx % PASTEL_BG_COLORS.length]
                  const img = item.image || item.img || '/images/samsung_s23.png'
                  return (
                    <div
                      key={item.id || item._id || idx}
                      onClick={() =>
                        navigate(USER_ROUTES.ROOT + '/listing', {
                          state: { category: item.name, categoryId: item.id || item._id },
                        })
                      }
                      className="flex flex-col items-center shrink-0 cursor-pointer group w-[64px] sm:w-[78px] md:w-[84px]"
                    >
                      {/* Soft Pastel Circle with Image */}
                      <div
                        className={`w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full ${bg} flex items-center justify-center overflow-hidden shadow-2xs group-hover:scale-108 transition-all duration-300 relative border border-slate-200/50`}
                      >
                        <img
                          src={img}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-120"
                          onError={(e) => {
                            e.currentTarget.src = '/uploads/categories/cat_electronics_gadgets.webp'
                          }}
                        />
                      </div>
                      <span className="text-[10.5px] sm:text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors text-center leading-tight line-clamp-2 w-full mt-1.5 break-words">
                        {item.name}
                      </span>
                    </div>
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

          {/* DYNAMIC FLASH SALE SECTION (Live from Database) */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <span className="bg-red-600 text-white font-black text-[10px] sm:text-xs uppercase px-2.5 py-1 rounded-lg whitespace-nowrap shadow-xs flex items-center space-x-1">
                  <HiBolt className="w-3.5 h-3.5 text-amber-300" />
                  <span>FLASH SALE</span>
                </span>
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Ends In:</span>
                <div className="flex items-center space-x-1 font-mono text-xs font-black text-slate-900 whitespace-nowrap">
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.hours)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.minutes)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timeLeft.seconds)}</span>
                </div>
              </div>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing', { state: { filter: 'flash_sale' } })}
                className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap shrink-0"
              >
                See All Deals →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {loading && dynamicFlashSale.length === 0
                ? [1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))
                : flashSaleList.map((rawItem) => {
                    const item = formatProductCard(rawItem, 'Flash Deal')
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(USER_ROUTES.ROOT + '/product', { state: { productId: item.id } })}
                        className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
                      >
                        <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                          <button
                            onClick={(e) => toggleWishlist(item, e)}
                            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                          >
                            {isWishlisted(item.id) ? (
                              <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                            ) : (
                              <HiOutlineHeart className="w-4 h-4" />
                            )}
                          </button>

                          <img
                            src={item.image}
                            alt={item.name}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = '/images/samsung_s23.png'
                            }}
                          />
                        </div>

                        <div className="space-y-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                          {item.rating ? (
                            <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold pt-0.5">
                              <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                              <span className="text-slate-900">{item.rating}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({item.reviews})</span>
                            </div>
                          ) : (
                            <span className="inline-block text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                              NEW
                            </span>
                          )}

                          <div className="pt-1 flex items-end justify-between gap-1.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="text-xs sm:text-sm font-black text-slate-900">
                                ₹{item.salePrice.toLocaleString('en-IN')}
                              </div>
                              <div className="flex items-center space-x-1.5 text-[11px]">
                                {item.regularPrice > item.salePrice && (
                                  <span className="text-slate-400 line-through">
                                    ₹{item.regularPrice.toLocaleString('en-IN')}
                                  </span>
                                )}
                                {item.discount && (
                                  <span className="font-bold text-emerald-600">
                                    {item.discount}% OFF
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleAddToCart(item, e)}
                              aria-label="Add to cart"
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                justAddedIds.has(item.id)
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                              }`}
                            >
                              {justAddedIds.has(item.id) ? (
                                <HiCheck className="w-4 h-4" />
                              ) : (
                                <HiOutlineShoppingBag className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>

          {/* Promotional Highlight Banners (admin-managed via Banner placement='promo') */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promoCards.map((card, idx) => {
              const CardIcon = BANNER_ICON_MAP[card.icon] || HiSparkles
              const gradient = PROMO_THEME_CLASSES[card.theme] || PROMO_THEME_CLASSES.blue
              const tagClass = PROMO_TAG_THEME_CLASSES[card.theme] || PROMO_TAG_THEME_CLASSES.blue
              return (
                <div
                  key={card.id || card._id || idx}
                  onClick={() => navigate(card.ctaPath || USER_ROUTES.ROOT + '/listing')}
                  className={`${gradient} rounded-3xl p-6 text-white shadow-md cursor-pointer hover:shadow-lg transition-all flex items-center justify-between`}
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
                    <CardIcon className="w-8 h-8" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* DYNAMIC TRENDING RESELLER PRODUCTS SECTION (Live from Database) */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <HiCurrencyRupee className="w-4 h-4 text-emerald-600" />
                  <span>Trending Best Value Picks</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Top selling products with maximum savings & verified quality
                </p>
              </div>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing', { state: { filter: 'trending' } })}
                className="text-xs font-bold text-blue-600 hover:underline shrink-0"
              >
                View All →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {loading && dynamicTrending.length === 0
                ? [1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-slate-50 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                      <div className="w-3/4 h-3 bg-slate-200 rounded" />
                      <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    </div>
                  ))
                : trendingList.map((rawItem) => {
                    const item = formatProductCard(rawItem, 'Trending Pick')
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(USER_ROUTES.ROOT + '/product', { state: { productId: item.id } })}
                        className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-indigo-400/50 transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
                      >
                        <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                          <button
                            onClick={(e) => toggleWishlist(item, e)}
                            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                          >
                            {isWishlisted(item.id) ? (
                              <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                            ) : (
                              <HiOutlineHeart className="w-4 h-4" />
                            )}
                          </button>

                          <img
                            src={item.image}
                            alt={item.name}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = '/images/iphone_14.png'
                            }}
                          />
                        </div>

                        <div className="space-y-1 min-w-0">
                          <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                            {item.savings}
                          </span>

                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                          <div className="pt-1 flex items-end justify-between gap-1.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="text-xs sm:text-sm font-black text-slate-900">
                                ₹{item.salePrice.toLocaleString('en-IN')}
                              </div>
                              <div className="flex items-center space-x-1.5 text-[11px]">
                                {item.regularPrice > item.salePrice && (
                                  <span className="text-slate-400 line-through">
                                    ₹{item.regularPrice.toLocaleString('en-IN')}
                                  </span>
                                )}
                                {item.discount && (
                                  <span className="font-bold text-emerald-600">
                                    {item.discount}% OFF
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleAddToCart(item, e)}
                              aria-label="Add to cart"
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                justAddedIds.has(item.id)
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                              }`}
                            >
                              {justAddedIds.has(item.id) ? (
                                <HiCheck className="w-4 h-4" />
                              ) : (
                                <HiOutlineShoppingBag className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>

          {/* DYNAMIC OFFICIAL BRAND STORES (Live from Database) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Official Brand Stores
                </h3>
                <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <HiCheckBadge className="w-3 h-3 mr-1 text-emerald-600" /> 100% Genuine
                </span>
              </div>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline flex items-center"
              >
                Explore All Brands <HiChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 text-center">
              {brandsList.map((brand, idx) => {
                const BrandIcon = brand.Icon
                const logo = getBrandLogo(brand)
                const offer = getBrandOffer(brand)

                return (
                  <div
                    key={brand.id || brand._id || idx}
                    onClick={() =>
                      navigate(USER_ROUTES.ROOT + '/listing', {
                        state: { brand: brand.name, brandId: brand.id || brand._id },
                      })
                    }
                    className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-blue-400/80 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group flex flex-col items-center justify-between"
                  >
                    {/* Spacious & Clear Brand Logo Frame */}
                    <div className="w-full h-18 sm:h-22 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-center p-3 overflow-hidden group-hover:bg-white group-hover:border-blue-200/90 group-hover:shadow-xs transition-all">
                      {logo ? (
                        <img
                          src={logo}
                          alt={brand.name}
                          className="max-h-11 sm:max-h-13 max-w-[85%] object-contain object-center group-hover:scale-105 transition-transform duration-300 drop-shadow-2xs"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'flex'
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className={`h-full w-full items-center justify-center ${
                          logo ? 'hidden' : 'flex'
                        }`}
                      >
                        {BrandIcon ? (
                          <BrandIcon className="w-8 h-8 text-slate-800 group-hover:text-blue-600 transition-colors" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                            {brand.name ? brand.name.slice(0, 2).toUpperCase() : 'BR'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Brand Info & Offer Badge */}
                    <div className="mt-2.5 w-full text-center flex flex-col items-center">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate w-full">
                        {brand.name}
                      </h4>
                      <span className="mt-1 text-[10px] font-bold text-blue-600 bg-blue-50/90 border border-blue-100 px-2.5 py-0.5 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all truncate max-w-full">
                        {offer}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coupon Banner — pulls a real active sitewide coupon; never fabricates a code */}
          <div
            onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
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

            <button className="bg-white text-blue-700 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:bg-blue-50 transition-colors shrink-0 flex items-center space-x-1.5">
              <span>Shop Now</span>
              <HiChevronRight className="w-4 h-4" />
            </button>
          </div>

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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
