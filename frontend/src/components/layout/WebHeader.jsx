import React, { useState } from 'react'
import {
  HiMagnifyingGlass,
  HiMicrophone,
  HiBell,
  HiOutlineShoppingBag,
  HiHeart,
  HiSquares2X2,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES, USER_ROUTES } from '../../config/routes'

export function WebHeader() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    navigate(USER_ROUTES.ROOT + '/listing')
  }

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div
          onClick={() => navigate(USER_ROUTES.DASHBOARD)}
          className="flex items-center space-x-2 cursor-pointer shrink-0"
        >
          <img
            src="/images/logo.png"
            alt="KroZenda Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Search Bar with Category Dropdown */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-2xl hidden md:flex items-center bg-slate-100/90 border border-slate-300/80 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:bg-white transition-all shadow-inner"
        >
          <select className="bg-slate-200/70 border-r border-slate-300 text-xs font-bold text-slate-700 px-3 py-2.5 outline-none cursor-pointer hover:bg-slate-300/50">
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Fashion</option>
            <option>Home & Kitchen</option>
            <option>Beauty</option>
            <option>B2B Wholesale</option>
          </select>

          <div className="flex-1 flex items-center px-3">
            <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search 100,000+ products, brands, and suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-2 bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => navigate(USER_ROUTES.ROOT + '/search')}
              className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
            >
              <HiMicrophone className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Right User Actions */}
        <div className="flex items-center space-x-4">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900">Hello, Rahul 👋</span>
            <span className="text-[10px] font-medium text-slate-500">B2C & B2B Buyer</span>
          </div>

          {/* Wishlist */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
            className="relative p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors hidden sm:flex cursor-pointer"
          >
            <HiHeart className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
              3
            </span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/dashboard')}
            className="relative p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <HiBell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
              2
            </span>
          </button>

          {/* Shopping Cart */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
            className="relative flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl border border-blue-200 transition-colors font-bold text-xs cursor-pointer"
          >
            <div className="relative">
              <HiOutlineShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                2
              </span>
            </div>
            <span className="hidden sm:inline">Cart (₹1,299)</span>
          </button>

          {/* Profile Dropdown / Auth Switch */}
          <button
            onClick={() => navigate(AUTH_ROUTES.LOGIN)}
            className="flex items-center space-x-1.5 p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              R
            </div>
            <span className="text-xs font-semibold hidden md:inline text-slate-800">Account</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="bg-slate-900 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-6 whitespace-nowrap">
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex items-center space-x-1 font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <HiSquares2X2 className="w-4 h-4" />
              <span>All Categories</span>
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Top Brands
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Exclusive Offers
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              New Arrivals
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Flash Deals ⚡
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              B2B Wholesale Hub
            </button>
          </div>

          <div className="hidden lg:flex items-center space-x-4 text-[11px] text-slate-400">
            <span>🛡️ 100% Verified Sellers</span>
            <span>🚚 Pan-India Shipping</span>
          </div>
        </div>
      </div>
    </header>
  )
}
