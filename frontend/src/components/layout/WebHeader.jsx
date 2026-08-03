import React, { useState } from 'react'
import {
  HiMagnifyingGlass,
  HiOutlineShoppingBag,
  HiOutlineHeart,
  HiUser,
  HiBell,
  HiBars3,
  HiSparkles,
  HiChevronDown,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES, AUTH_ROUTES } from '../../config/routes'

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
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between gap-4">
        {/* Logo */}
        <div
          onClick={() => navigate(USER_ROUTES.DASHBOARD)}
          className="flex items-center space-x-2 cursor-pointer shrink-0"
        >
          <img
            src="/images/logo.png"
            alt="KroZenda Logo"
            className="h-14 md:h-16 w-auto object-contain py-0.5"
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
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Right Actions */}
        <div className="flex items-center space-x-3 md:space-x-5 text-slate-700 font-semibold text-xs">
          {/* Notifications */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiBell className="w-5 h-5 text-slate-700" />
            <span className="hidden lg:inline text-[10px] font-bold text-slate-600 mt-0.5">Alerts</span>
            <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>

          {/* Wishlist */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/wishlist')}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiOutlineHeart className="w-5 h-5 text-slate-700" />
            <span className="hidden lg:inline text-[10px] font-bold text-slate-600 mt-0.5">Wishlist</span>
            <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              4
            </span>
          </button>

          {/* Cart */}
          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiOutlineShoppingBag className="w-5 h-5 text-slate-700" />
            <span className="hidden lg:inline text-[10px] font-bold text-slate-600 mt-0.5">Cart</span>
            <span className="absolute top-1 right-1.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* User Account / Profile */}
          <div
            onClick={() => navigate(USER_ROUTES.ROOT + '/profile')}
            className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors border border-slate-200/80 bg-slate-50"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
              R
            </div>
            <div className="hidden lg:block text-left pr-1">
              <span className="text-xs font-bold text-slate-900 block leading-tight">Rahul</span>
              <span className="text-[10px] text-slate-400 font-semibold">Account & Orders</span>
            </div>
            <HiChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </div>
        </div>
      </div>

      {/* Sub Navbar (Categories & Quick Links) */}
      <div className="bg-slate-900 text-white text-xs font-semibold px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg text-white font-bold transition-colors"
            >
              <HiBars3 className="w-4 h-4" />
              <span>All Categories</span>
            </button>
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="hover:text-amber-400 cursor-pointer transition-colors"
            >
              Mobile & Electronics
            </span>
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="hover:text-amber-400 cursor-pointer transition-colors"
            >
              Fashion & Apparel
            </span>
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
              className="hover:text-amber-400 cursor-pointer transition-colors"
            >
              Home & Kitchen
            </span>
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/coupons')}
              className="hover:text-amber-400 cursor-pointer transition-colors flex items-center space-x-1 text-amber-400 font-bold"
            >
              <HiSparkles className="w-3.5 h-3.5" />
              <span>Bulk Deals (60% OFF)</span>
            </span>
          </div>

          <div className="flex items-center space-x-4 text-slate-300 text-[11px]">
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/support')}
              className="hover:text-white cursor-pointer"
            >
              Help Center
            </span>
            <span
              onClick={() => navigate(USER_ROUTES.ROOT + '/settings')}
              className="hover:text-white cursor-pointer"
            >
              Settings
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
