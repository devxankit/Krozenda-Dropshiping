import React, { useState, useEffect } from 'react'
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
} from 'react-icons/si'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'

export function HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  const [wishlist, setWishlist] = useState({})
  const [timer, setTimer] = useState({ hours: 2, minutes: 15, seconds: 30 })

  const heroBanners = [
    { id: 1, image: '/images/banner_wholesale_deals.png', alt: 'Mega Factory Wholesale Deals' },
    { id: 2, image: '/images/banner_factory_dropship.png', alt: 'White Label Dropshipping 24hr Dispatch' },
    { id: 3, image: '/images/banner_smart_gadgets.png', alt: 'New Tech Arrivals 2026' },
  ]
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)

  useEffect(() => {
    const bannerInterval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length)
    }, 4000)
    return () => clearInterval(bannerInterval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 }
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 }
        return prev
      })
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

  const toggleWishlist = (id, e) => {
    e.stopPropagation()
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const formatTime = (val) => val.toString().padStart(2, '0')

  const flashSaleProducts = [
    {
      id: 101,
      name: 'Samsung Galaxy S23 5G',
      subtitle: '(Phantom Black, 128GB)',
      price: 49999,
      originalPrice: 74999,
      discount: '33% OFF',
      rating: 4.5,
      reviews: '2,351',
      image: '/images/samsung_s23.png',
      tag: 'Bestseller',
    },
    {
      id: 102,
      name: 'boAt Airdopes 141',
      subtitle: 'Wireless Earbuds',
      price: 1299,
      originalPrice: 4490,
      discount: '71% OFF',
      rating: 4.6,
      reviews: '3,890',
      image: '/images/boat_airdopes.png',
      tag: 'Hot Deal',
    },
    {
      id: 103,
      name: 'Apple iPhone 14 128GB',
      subtitle: '(Blue, 128GB)',
      price: 59999,
      originalPrice: 69900,
      discount: '14% OFF',
      rating: 4.7,
      reviews: '5,120',
      image: '/images/iphone_14.png',
      tag: 'Top Rated',
    },
    {
      id: 104,
      name: 'Portronics Power Bank',
      subtitle: '10000mAh Dual Output',
      price: 1199,
      originalPrice: 2499,
      discount: '52% OFF',
      rating: 4.4,
      reviews: '890',
      image: '/images/boat_airdopes.png',
      tag: 'Wholesale Tier',
    },
  ]

  const trendingProducts = [
    {
      id: 201,
      name: 'OnePlus 11R 5G (256GB)',
      subtitle: 'Sonic Black • 16GB RAM',
      price: 39999,
      originalPrice: 44999,
      discount: '11% OFF',
      rating: 4.6,
      reviews: '1,450',
      image: '/images/iphone_14.png',
      resellerProfit: '₹4,500 Profit / Unit',
    },
    {
      id: 202,
      name: 'Noise ColorFit Pulse 2',
      subtitle: '1.8" HD Display Smartwatch',
      price: 1499,
      originalPrice: 4999,
      discount: '70% OFF',
      rating: 4.3,
      reviews: '8,210',
      image: '/images/boat_airdopes.png',
      resellerProfit: '₹800 Profit / Unit',
    },
    {
      id: 203,
      name: 'Xiaomi 13 Pro 5G',
      subtitle: 'Leica Professional Camera',
      price: 79999,
      originalPrice: 89999,
      discount: '11% OFF',
      rating: 4.5,
      reviews: '620',
      image: '/images/samsung_s23.png',
      resellerProfit: '₹6,000 Profit / Unit',
    },
    {
      id: 204,
      name: 'Fastrack Revoltt FS1',
      subtitle: 'Bluetooth Calling Smartwatch',
      price: 1799,
      originalPrice: 3995,
      discount: '55% OFF',
      rating: 4.4,
      reviews: '3,100',
      image: '/images/boat_airdopes.png',
      resellerProfit: '₹950 Profit / Unit',
    },
  ]

  const brandSpotlight = [
    { name: 'Samsung', Icon: SiSamsung, items: '450+ Products', discount: 'Upto 40% OFF', color: 'text-blue-600 bg-blue-50/80 border-blue-100' },
    { name: 'Apple', Icon: SiApple, items: '210+ Products', discount: 'Upto 20% OFF', color: 'text-slate-900 bg-slate-100/80 border-slate-200' },
    { name: 'boAt', Icon: HiSparkles, items: '320+ Products', discount: 'Upto 75% OFF', color: 'text-red-600 bg-red-50/80 border-red-100' },
    { name: 'OnePlus', Icon: SiOneplus, items: '180+ Products', discount: 'Upto 30% OFF', color: 'text-red-700 bg-rose-50/80 border-rose-100' },
    { name: 'Xiaomi', Icon: SiXiaomi, items: '500+ Products', discount: 'Upto 50% OFF', color: 'text-orange-600 bg-orange-50/80 border-orange-100' },
    { name: 'Nike', Icon: SiNike, items: '290+ Products', discount: 'Upto 60% OFF', color: 'text-emerald-700 bg-emerald-50/80 border-emerald-100' },
  ]

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
            <img src="/images/logo.png" alt="Krozenda Logo" className="h-9 w-auto object-contain" />
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
              >
                <HiBell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
                className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-700"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  3
                </span>
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
                placeholder="Search 100,000+ products..."
                className="w-full px-2.5 bg-transparent text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button type="submit" className="text-xs font-bold text-blue-600 shrink-0 ml-1">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* MAIN CONTAINER */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 space-y-8">
          {/* Main Top Hero Banner Section (Responsive Carousel + Side Banner Card on Desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Banner Slider (2 Columns on Desktop, Full Width on Mobile) */}
            <div className="lg:col-span-2 w-full relative overflow-hidden rounded-2xl md:rounded-3xl shadow-md group cursor-pointer aspect-[16/7] lg:aspect-auto lg:h-full min-h-[210px] sm:min-h-[260px] lg:min-h-[280px]">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="w-full h-full relative overflow-hidden bg-slate-950"
              >
                {heroBanners.map((banner, idx) => (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      idx === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                  >
                    <img
                      src={banner.image}
                      alt={banner.alt}
                      className="w-full h-full object-cover rounded-2xl md:rounded-3xl"
                    />
                  </div>
                ))}
              </div>

              {/* Left Chevron Control */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length)
                }}
                className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
              >
                <HiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Right Chevron Control */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length)
                }}
                className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
              >
                <HiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Carousel Dot Indicators */}
              <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                {heroBanners.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentBannerIndex(idx)
                    }}
                    className={`transition-all duration-300 rounded-full ${
                      idx === currentBannerIndex ? 'w-4 sm:w-5 h-1 sm:h-1.5 bg-white' : 'w-1 sm:w-1.5 h-1 sm:h-1.5 bg-white/50 hover:bg-white/90'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right: Desktop Only B2B Side Banner Image */}
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="hidden lg:block w-full h-full relative rounded-3xl overflow-hidden shadow-md cursor-pointer hover:shadow-lg transition-all group border border-slate-200/80 bg-slate-900"
            >
              <img
                src="/images/banner_b2b_factory.png"
                alt="Factory Bulk Tiers B2B Supplier"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-3xl"
              />
            </div>
          </div>

          {/* Quick Action Badges (Simple & Unified Professional Neutral Style) */}
          <div className="grid grid-cols-4 gap-3 sm:gap-5 text-center">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <HiSquares2X2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2 truncate w-full">Categories</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <HiCheckBadge className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2 truncate w-full">Brands</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/coupons')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <HiTag className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2 truncate w-full">Offers</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <HiSparkles className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2 truncate w-full">New Arrivals</span>
            </div>
          </div>

          {/* Top Categories Grid (Upgraded Professional Vector Icons) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Top Categories
              </h3>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="text-[11px] sm:text-xs font-bold text-blue-600 hover:underline flex items-center space-x-0.5"
              >
                <span>View All Categories</span>
                <HiChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 sm:gap-5 text-center">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center space-y-2"
              >
                <div className="w-full aspect-square bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100/80">
                  <img src="/images/samsung_s23.png" alt="Mobiles" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate w-full">Mobiles</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center space-y-2"
              >
                <div className="w-full aspect-square bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100/80">
                  <img src="/images/boat_airdopes.png" alt="Electronics" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate w-full">Electronics</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-pink-500 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center space-y-2"
              >
                <div className="w-full aspect-square bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100/80">
                  <img src="/images/iphone_14.png" alt="Fashion" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-pink-600 transition-colors truncate w-full">Fashion</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center space-y-2"
              >
                <div className="w-full aspect-square bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100/80">
                  <img src="/images/boat_airdopes.png" alt="Smart Gadgets" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate w-full">Smart Gadgets</span>
              </div>
            </div>
          </div>

          {/* Section 1: Flash Sale Deals */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <span className="bg-red-600 text-white font-black text-[10px] sm:text-xs uppercase px-2.5 py-1 rounded-lg whitespace-nowrap shadow-xs flex items-center space-x-1">
                  <HiBolt className="w-3.5 h-3.5 text-amber-300" />
                  <span>FLASH SALE</span>
                </span>
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Ends In:</span>
                <div className="flex items-center space-x-1 font-mono text-xs font-black text-slate-900 whitespace-nowrap">
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timer.hours)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timer.minutes)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md">{formatTime(timer.seconds)}</span>
                </div>
              </div>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap shrink-0"
              >
                See All Deals →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {flashSaleProducts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
                >
                  <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                    <button
                      onClick={(e) => toggleWishlist(item.id, e)}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                    >
                      {wishlist[item.id] ? (
                        <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                      ) : (
                        <HiOutlineHeart className="w-4 h-4" />
                      )}
                    </button>

                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                    <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold pt-0.5">
                      <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                      <span className="text-slate-900">{item.rating}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({item.reviews})</span>
                    </div>

                    <div className="pt-1 space-y-0.5">
                      <div className="text-xs sm:text-sm font-black text-slate-900">
                        ₹{item.price.toLocaleString('en-IN')}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        <span className="text-slate-400 line-through">
                          ₹{item.originalPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="font-bold text-emerald-600">
                          {item.discount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Secondary Promotional Banners Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="bg-gradient-to-r from-emerald-700 to-teal-900 rounded-3xl p-6 text-white shadow-md cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
            >
              <div className="space-y-1 max-w-xs">
                <span className="bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                  HIGH MARGIN RESELLING
                </span>
                <h3 className="text-lg font-black pt-1">Earn Upto ₹50,000/mo Dropshipping</h3>
                <p className="text-xs text-emerald-100">Zero inventory investment. We ship under your brand name.</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 text-emerald-300 shrink-0">
                <HiBriefcase className="w-8 h-8" />
              </div>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-3xl p-6 text-white shadow-md cursor-pointer hover:shadow-lg transition-all flex items-center justify-between"
            >
              <div className="space-y-1 max-w-xs">
                <span className="bg-purple-400/20 text-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                  VERIFIED FACTORY SUPPLIERS
                </span>
                <h3 className="text-lg font-black pt-1">Direct Wholesale Prices</h3>
                <p className="text-xs text-purple-200">100% Genuine products with manufacturer tax invoice.</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 text-purple-300 shrink-0">
                <HiBuildingOffice2 className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Section 3: Trending Reseller Products */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <HiCurrencyRupee className="w-4 h-4 text-emerald-600" />
                  <span>High Margin Trending Picks</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Top selling products with highest dropshipper profit margins
                </p>
              </div>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="text-xs font-bold text-blue-600 hover:underline shrink-0"
              >
                View All →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {trendingProducts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
                >
                  <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                    <button
                      onClick={(e) => toggleWishlist(item.id, e)}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                    >
                      {wishlist[item.id] ? (
                        <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                      ) : (
                        <HiOutlineHeart className="w-4 h-4" />
                      )}
                    </button>

                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                      {item.resellerProfit}
                    </span>

                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                    <div className="pt-1 space-y-0.5">
                      <div className="text-xs sm:text-sm font-black text-slate-900">
                        ₹{item.price.toLocaleString('en-IN')}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        <span className="text-slate-400 line-through">
                          ₹{item.originalPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Brand Spotlight Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Official Brand Stores
              </h3>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline"
              >
                Explore All Brands →
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3 text-center">
              {brandSpotlight.map((brand, idx) => {
                const BrandIcon = brand.Icon
                return (
                  <div
                    key={idx}
                    onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                    className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-400/50 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-1.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-800 border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                      <BrandIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate w-full">
                      {brand.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 5: Simple Clean Promotional Banner */}
          <div
            onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block">
                SPECIAL PROMOTION
              </span>
              <h3 className="text-base sm:text-xl font-bold text-white leading-snug">
                Flat 50% OFF on Top Selling Audio & Mobile Accessories
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Use coupon code <span className="font-bold underline text-white">FIRSTB2B</span> for extra savings.
              </p>
            </div>

            <button className="bg-white text-blue-700 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:bg-blue-50 transition-colors shrink-0 flex items-center space-x-1.5">
              <span>Shop Now</span>
              <HiChevronRight className="w-4 h-4" />
            </button>
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
