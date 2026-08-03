import React, { useState, useEffect } from 'react'
import {
  HiBell,
  HiOutlineShoppingBag,
  HiMagnifyingGlass,
  HiMicrophone,
  HiSquares2X2,
  HiTag,
  HiSparkles,
  HiCheckBadge,
  HiShieldCheck,
  HiTruck,
  HiArrowPath,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [timer, setTimer] = useState({ hours: 2, minutes: 15, seconds: 30 })

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
    if (tabId === 'orders') navigate(USER_ROUTES.ROOT + '/cart')
    if (tabId === 'wishlist') navigate(USER_ROUTES.ROOT + '/wishlist')
    if (tabId === 'profile') navigate(USER_ROUTES.ROOT + '/profile')
  }

  const formatTime = (val) => val.toString().padStart(2, '0')

  return (
    <div className="relative w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER (Visible on md and up) */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12">
        {/* MOBILE TOP HEADER & SEARCH (Visible on mobile only) */}
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

          <div className="px-4 py-3 bg-white border-b border-slate-200 shadow-xs">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/search')}
              className="flex items-center bg-slate-100 border border-slate-200/80 rounded-2xl px-3.5 py-2.5 cursor-pointer"
            >
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 ml-2.5 flex-1">
                Search 100,000+ products...
              </span>
              <HiMicrophone className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* HERO CAROUSEL & MAIN CONTAINER */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 space-y-6">
          {/* Main Hero Banner Slider */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gradient-to-r from-blue-900 via-blue-950 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex items-center justify-between min-h-[220px]">
              <div className="z-10 max-w-md space-y-2">
                <span className="bg-amber-400 text-blue-950 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  🔥 MEGA B2B WHOLESALE SALE
                </span>
                <h2 className="text-2xl md:text-4xl font-black leading-tight pt-1">
                  Up to 60% OFF Direct Factory Deals
                </h2>
                <p className="text-xs md:text-sm text-blue-200 font-medium">
                  Zero MOQ, GST Tax Invoices & Express Pan-India Doorstep Dispatch.
                </p>
                <button
                  onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                  className="mt-3 md:mt-4 inline-flex items-center text-xs font-bold bg-white text-blue-900 hover:bg-slate-100 px-4 py-2 rounded-xl shadow-md transition-all"
                >
                  Shop Now <span className="ml-1 text-xs">→</span>
                </button>
              </div>

              <div className="relative w-28 md:w-44 h-24 md:h-36 flex items-center justify-center">
                <img
                  src="/images/deals_banner.png"
                  alt="Deals Graphic"
                  className="w-full h-full object-contain drop-shadow-md animate-float-slow"
                />
              </div>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-md relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="z-10">
                <span className="bg-black/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                  B2B Direct Supplier
                </span>
                <h4 className="text-xl font-extrabold mt-3">Factory Bulk Deals</h4>
                <p className="text-xs text-amber-100 mt-1">Get GST Invoices, MOQ Tier discounts, and verified supplier warranty.</p>
              </div>
              <button className="z-10 self-start text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl mt-4">
                Explore Categories →
              </button>
            </div>
          </div>

          {/* Quick Action Category Badges */}
          <div className="grid grid-cols-4 md:grid-cols-4 gap-3 md:gap-6 text-center">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 md:p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiSquares2X2 className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Categories</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 md:p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-orange-100/70 text-orange-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiCheckBadge className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Brands</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/coupons')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 md:p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-amber-100/70 text-amber-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiTag className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Offers</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white p-3 md:p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-purple-100/70 text-purple-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiSparkles className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">New Arrivals</span>
            </div>
          </div>

          {/* Top Categories Row */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Top Categories
              </h3>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline"
              >
                View All Categories →
              </button>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-4 gap-2 md:gap-4 text-center">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  📱
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Mobiles</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  💻
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Electronics</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  👕
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Fashion</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/categories')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  🏠
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Home</span>
              </div>
            </div>
          </div>

          {/* Flash Deals Section */}
          <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="bg-red-500 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded">
                  FLASH SALE
                </span>
                <span className="text-xs font-bold text-slate-900">Ends In:</span>
                <div className="flex items-center space-x-1 font-mono text-xs font-black text-slate-900">
                  <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">{formatTime(timer.hours)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">{formatTime(timer.minutes)}</span>
                  <span>:</span>
                  <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">{formatTime(timer.seconds)}</span>
                </div>
              </div>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                See All Deals →
              </button>
            </div>

            {/* Flash Sale Product Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 hover:shadow-md transition-all cursor-pointer group space-y-2"
              >
                <div className="w-full h-36 bg-white rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/samsung_s23.png"
                    alt="Samsung S23"
                    className="max-h-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">Samsung Galaxy S23 5G</h4>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black text-slate-900">₹49,999</span>
                  <span className="text-[10px] text-slate-400 line-through">₹74,999</span>
                </div>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 hover:shadow-md transition-all cursor-pointer group space-y-2"
              >
                <div className="w-full h-36 bg-white rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/boat_airdopes.png"
                    alt="boAt Airdopes"
                    className="max-h-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">boAt Airdopes 141</h4>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black text-slate-900">₹1,299</span>
                  <span className="text-[10px] text-slate-400 line-through">₹4,490</span>
                </div>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 hover:shadow-md transition-all cursor-pointer group space-y-2"
              >
                <div className="w-full h-36 bg-white rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/iphone_14.png"
                    alt="iPhone 14"
                    className="max-h-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">Apple iPhone 14 128GB</h4>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black text-slate-900">₹59,999</span>
                  <span className="text-[10px] text-slate-400 line-through">₹69,900</span>
                </div>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="hidden lg:block bg-slate-50 rounded-2xl p-3 border border-slate-200/60 hover:shadow-md transition-all cursor-pointer group space-y-2"
              >
                <div className="w-full h-36 bg-white rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/boat_airdopes.png"
                    alt="Power Bank"
                    className="max-h-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate">Portronics Power Bank</h4>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black text-slate-900">₹1,199</span>
                  <span className="text-[10px] text-slate-400 line-through">₹2,499</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR (Visible on mobile only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
