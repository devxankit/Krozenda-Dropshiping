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

export function Screen5HomeScreen({ onNavigateTab = () => {} }) {
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
    if (tabId === 'categories') navigate(USER_ROUTES.ROOT + '/listing')
    if (tabId === 'orders') navigate(USER_ROUTES.ROOT + '/cart')
    if (tabId === 'wishlist') navigate(USER_ROUTES.ROOT + '/listing')
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
          {/* Mobile Status Bar */}
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>

          {/* Top Header Location & Badges */}
          <div className="px-5 py-3 bg-white flex items-center justify-between shadow-xs">
            <div>
              <div className="flex items-center space-x-1 cursor-pointer">
                <span className="text-[10px] text-slate-400 font-medium">Deliver to</span>
                <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                  Ahmedabad, Gujarat ▾
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')}
                className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <HiBell className="w-5 h-5 text-slate-700" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  2
                </span>
              </button>

              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
                className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <HiOutlineShoppingBag className="w-5 h-5 text-slate-700" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  2
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar Clickable Area */}
          <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-100">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/search')}
              className="flex items-center bg-slate-100/80 border border-slate-200/80 rounded-xl px-3 py-2.5 shadow-xs cursor-pointer hover:bg-slate-200/60 transition-all"
            >
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="w-full px-2 text-xs font-medium text-slate-400">
                Search for products, brands and more
              </span>
              <HiMicrophone className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* CONTAINER FOR HOME CONTENT */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 space-y-6 md:space-y-8">
          {/* Promotional Hero Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="md:col-span-2 relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5 md:p-8 shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="z-10 max-w-[60%]">
                <div className="inline-block px-3 py-1 bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-md mb-2 tracking-wider">
                  Special Offer
                </div>
                <h3 className="text-lg md:text-2xl font-black leading-tight">
                  Big Deals <span className="font-normal text-xs md:text-sm text-blue-200">for</span>
                  <br />
                  Smart Buyers
                </h3>
                <p className="hidden sm:block text-xs text-blue-200 mt-2">
                  Up to 60% OFF on B2B bulk orders and top trending retail products across India.
                </p>
                <button className="mt-3 md:mt-4 inline-flex items-center text-xs font-bold bg-white text-blue-900 hover:bg-slate-100 px-4 py-2 rounded-xl shadow-md transition-all">
                  Shop Now <span className="ml-1 text-xs">→</span>
                </button>
              </div>

              {/* Banner Graphic Image */}
              <div className="relative w-28 md:w-44 h-24 md:h-36 flex items-center justify-center">
                <img
                  src="/images/deals_banner.png"
                  alt="Deals Graphic"
                  className="w-full h-full object-contain drop-shadow-md animate-float-slow"
                />
                <div className="absolute top-0 right-0 w-8 h-8 bg-amber-400 text-blue-950 font-black text-xs rounded-full flex items-center justify-center shadow-md rotate-12">
                  %
                </div>
              </div>
            </div>

            {/* Desktop Side Spotlight Card (Visible on md and up) */}
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="hidden md:flex flex-col justify-between bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-md relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="z-10">
                <span className="bg-black/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                  B2B Direct Supplier
                </span>
                <h4 className="text-xl font-extrabold mt-3">Factory Bulk Deals</h4>
                <p className="text-xs text-amber-100 mt-1">Get GST Invoices, MOQ Tier discounts, and verified supplier warranty.</p>
              </div>
              <button className="z-10 mt-4 bg-slate-900 hover:bg-slate-950 text-white px-4 py-2 rounded-xl text-xs font-bold w-fit shadow-md">
                Explore B2B Catalog
              </button>
            </div>
          </div>

          {/* Quick Action Category Badges */}
          <div className="grid grid-cols-4 md:grid-cols-4 gap-3 md:gap-6 text-center">
            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white md:p-4 rounded-2xl border border-slate-200/60 md:shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiSquares2X2 className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Categories</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white md:p-4 rounded-2xl border border-slate-200/60 md:shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-orange-100/70 text-orange-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiCheckBadge className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Brands</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white md:p-4 rounded-2xl border border-slate-200/60 md:shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-amber-100/70 text-amber-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiTag className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">Offers</span>
            </div>

            <div
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex flex-col items-center cursor-pointer group bg-white md:p-4 rounded-2xl border border-slate-200/60 md:shadow-xs hover:shadow-md transition-all"
            >
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-2xl bg-purple-100/70 text-purple-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HiSparkles className="w-5 md:w-7 h-5 md:h-7" />
              </div>
              <span className="text-[11px] md:text-xs font-bold text-slate-800 mt-1.5 md:mt-2">New Arrivals</span>
            </div>
          </div>

          {/* Top Categories */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Top Categories
              </h3>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline"
              >
                View All Categories →
              </button>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-4 gap-2 md:gap-4 text-center">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  📱
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Electronics</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  👕
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Fashion</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  🥛
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Home & Kitchen</span>
              </div>

              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col items-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-10 md:w-14 h-10 md:h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-1.5 text-xl md:text-2xl">
                  💄
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-full">Beauty</span>
              </div>
            </div>
          </div>

          {/* Trust Badges Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 md:p-5 shadow-xs grid grid-cols-4 divide-x divide-slate-100 text-center">
            <div className="flex flex-col items-center px-1 md:px-4">
              <HiShieldCheck className="w-4 md:w-6 h-4 md:h-6 text-blue-600 mb-1" />
              <span className="text-[9px] md:text-xs font-bold text-slate-800 leading-tight">Secure Payments</span>
              <span className="hidden md:inline text-[10px] text-slate-400 mt-0.5">Razorpay Encrypted</span>
            </div>
            <div className="flex flex-col items-center px-1 md:px-4">
              <HiTruck className="w-4 md:w-6 h-4 md:h-6 text-blue-600 mb-1" />
              <span className="text-[9px] md:text-xs font-bold text-slate-800 leading-tight">Fast Delivery</span>
              <span className="hidden md:inline text-[10px] text-slate-400 mt-0.5">Shiprocket Tracked</span>
            </div>
            <div className="flex flex-col items-center px-1 md:px-4">
              <HiArrowPath className="w-4 md:w-6 h-4 md:h-6 text-blue-600 mb-1" />
              <span className="text-[9px] md:text-xs font-bold text-slate-800 leading-tight">Easy Returns</span>
              <span className="hidden md:inline text-[10px] text-slate-400 mt-0.5">Instant Replacements</span>
            </div>
            <div className="flex flex-col items-center px-1 md:px-4">
              <HiTag className="w-4 md:w-6 h-4 md:h-6 text-blue-600 mb-1" />
              <span className="text-[9px] md:text-xs font-bold text-slate-800 leading-tight">Best Prices</span>
              <span className="hidden md:inline text-[10px] text-slate-400 mt-0.5">Direct Supplier Margin</span>
            </div>
          </div>

          {/* Flash Deals Section */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center space-x-3">
                <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Flash Deals
                </h3>
                <div className="inline-flex items-center space-x-1 text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  <span>⏰ Ends In:</span>
                  <span>
                    {formatTime(timer.hours)}h : {formatTime(timer.minutes)}m : {formatTime(timer.seconds)}s
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
                className="text-[11px] md:text-xs font-bold text-blue-600 hover:underline"
              >
                View All Flash Deals →
              </button>
            </div>

            {/* Product Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md transition-shadow flex md:flex-col items-center space-x-3 md:space-x-0 cursor-pointer"
              >
                <div className="w-24 md:w-full h-24 md:h-48 bg-slate-50 rounded-xl overflow-hidden p-2 flex items-center justify-center shrink-0 border border-slate-100 mb-0 md:mb-3">
                  <img
                    src="/images/boat_airdopes.png"
                    alt="boAt Airdopes 141"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 md:w-full">
                  <span className="hidden md:inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded mb-1">
                    Electronics
                  </span>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 truncate leading-snug">
                    boAt Airdopes 141 Wireless Earbuds
                  </h4>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium truncate">
                    Dual Mic ENx Tech, 42H Playtime
                  </p>

                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-sm md:text-base font-black text-slate-900">₹1,299</span>
                    <span className="text-[10px] md:text-xs text-slate-400 line-through">₹2,499</span>
                    <span className="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      48% OFF
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(USER_ROUTES.ROOT + '/cart')
                    }}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs transition-colors shadow-xs"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR (Visible on mobile screens < 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
