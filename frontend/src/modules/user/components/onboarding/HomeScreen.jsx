import { useState, useEffect } from 'react'
import {
  HiBell,
  HiOutlineShoppingBag,
  HiMagnifyingGlass,
  HiTruck,
  HiCurrencyRupee,
  HiShieldCheck,
  HiArrowPath,
} from 'react-icons/hi2'
import { useNavigate, Link } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { Footer } from '../../../../components/layout/Footer'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'
import { useCartCount } from '../../../../lib/cartStore'
import { useUnreadNotificationCount } from '../../../../lib/notificationStore'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useHomeFeed } from '../../controllers/useHomeFeedController'

import { HomeLeftSidebar } from './HomeLeftSidebar'
import { HomeCenterFeed } from './HomeCenterFeed'
import { HomeRightSidebar } from './HomeRightSidebar'

const FALLBACK_TRUST_TILES = [
  { id: 'trust-dispatch', title: '15-30m Dispatch', subtitle: 'Fast Delivery Express', icon: 'truck', theme: 'blue' },
  { id: 'trust-price', title: 'Factory Direct Price', subtitle: 'Zero Middlemen Margin', icon: 'currency', theme: 'amber' },
  { id: 'trust-quality', title: '100% Quality Checked', subtitle: 'Certified & Inspected', icon: 'shield', theme: 'emerald' },
  { id: 'trust-replacement', title: 'Safe Escrow Protection', subtitle: 'Easy Returns & Refund', icon: 'refresh', theme: 'purple' },
]

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

export function HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const cartCount = useCartCount()
  const unreadCount = useUnreadNotificationCount()
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight())

  usePageMeta({
    title: 'Wholesale & Dropshipping B2B Marketplace | Krozenda',
    description:
      'Shop verified wholesale and dropshipping products across electronics, gadgets, fashion, beauty and home on Krozenda with express delivery.',
  })

  const {
    categories,
    flashSale,
    trending,
    brands,
    banners,
    coupons,
    isLoading,
  } = useHomeFeed()

  // Countdown timer to midnight
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
    navigate(q ? userPath.search(q) : USER_ROUTES.LISTING)
  }

  // Choose the spotlight deal product for the right sidebar
  const spotlightDeal = flashSale[0] || trending[0] || null

  return (
    <div className="relative w-full min-h-screen bg-slate-50/70 flex flex-col justify-between text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background ambient accents */}
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-1/4 w-[500px] h-[500px] bg-indigo-400/5 rounded-full blur-3xl" />
      </div>

      {/* DESKTOP WEB HEADER (Hidden on mobile) */}
      <div className="sticky top-0 z-50 hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Body */}
      <div className="flex-1 pb-20 md:pb-12">
        {/* MOBILE TOP HEADER & SEARCH (For phones/WebViews < md) */}
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
                placeholder="Search products, brands, categories..."
                className="w-full px-2 bg-transparent text-xs font-normal text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </form>

            <div className="flex items-center space-x-1.5 shrink-0">
              <LanguageSwitcher variant="compact" />
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
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>


        {/* THREE-SECTION LAYOUT CONTAINER */}
        <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 pt-3 sm:pt-5 md:pt-6">
          <div className="flex items-start gap-4 lg:gap-5 xl:gap-6 2xl:gap-7">
            {/* SECTION 1: Left Navigation & Categories Sidebar (Sticky, visible on lg and above) */}
            <HomeLeftSidebar
              categories={categories}
              isLoading={isLoading.categories}
              className="hidden lg:flex"
            />

            {/* SECTION 2: Center Main Content Area (Fluid flex-1) */}
            <HomeCenterFeed
              categories={categories}
              flashSale={flashSale}
              trending={trending}
              brands={brands}
              banners={banners}
              coupons={coupons}
              isLoading={isLoading}
              timeLeft={timeLeft}
              trustTiles={FALLBACK_TRUST_TILES}
            />

            {/* SECTION 3: Right Sidebar with Deals & Guarantees (Sticky, visible on xl and above) */}
            <HomeRightSidebar
              dealProduct={spotlightDeal}
              className="hidden xl:flex"
            />
          </div>
        </div>
      </div>

      {/* FOOTER (Shown on Web, hidden in App) */}
      <Footer />

      {/* MOBILE BOTTOM NAVBAR (For screens < md) */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
