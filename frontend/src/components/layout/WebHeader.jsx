import { useState } from 'react'
import {
  HiMagnifyingGlass,
  HiOutlineShoppingBag,
  HiOutlineHeart,
  HiUser,
  HiBell,
  HiBars3,
  HiSparkles,
  HiChevronDown,
  HiMapPin,
  HiBolt,
} from 'react-icons/hi2'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { USER_ROUTES, AUTH_ROUTES, userPath } from '../../config/routes'
import { useAuthStore } from '../../lib/authStore'
import { useCartCount } from '../../lib/cartStore'
import { useWishlistCount } from '../../lib/wishlistStore'
import { useUnreadNotificationCount } from '../../lib/notificationStore'
import { useCategoriesController } from '../../modules/user/controllers/useProductsController'

export function WebHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const [searchTerm, setSearchTerm] = useState('')
  const cartCount = useCartCount()
  const wishlistCount = useWishlistCount()
  const unreadCount = useUnreadNotificationCount()

  const { categories } = useCategoriesController()
  const navCategories = categories.slice(0, 5)

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const q = searchTerm.trim()
    navigate(q ? userPath.search(q) : USER_ROUTES.LISTING)
  }

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 shadow-xs">
      {/* Top Bar matching reference UI */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2.5 flex items-center justify-between gap-4 xl:gap-6">
        {/* Brand Logo */}
        <Link
          to={USER_ROUTES.DASHBOARD}
          onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}
          className="flex items-center space-x-2 cursor-pointer shrink-0 transition-opacity hover:opacity-90"
          title="Krozenda Home"
        >
          <img
            src="/images/logo.png"
            alt="Krozenda Logo"
            className="h-10 sm:h-12 md:h-13 w-auto object-contain py-0.5 filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
          />
        </Link>

        {/* Large Rounded Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-2xl hidden md:flex items-center bg-slate-100/90 border border-slate-200/90 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-600 focus-within:bg-white focus-within:border-transparent transition-all shadow-2xs"
        >
          <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search catalog"
            placeholder="Search products, brands, verified factory suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm font-normal text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            className="ml-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-full transition-colors shrink-0 shadow-xs"
          >
            Search
          </button>
        </form>

        {/* Deliver to Location Indicator */}
        <div
          onClick={() => navigate(isAuthenticated ? USER_ROUTES.ADDRESSES : AUTH_ROUTES.LOGIN)}
          className="hidden lg:flex items-center space-x-2 shrink-0 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          title="Select Delivery Location"
        >
          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600 shrink-0">
            <HiMapPin className="w-4 h-4" />
          </div>
          <div className="text-left leading-tight">
            <span className="text-[10px] text-slate-400 font-medium block">Deliver to</span>
            <div className="flex items-center space-x-0.5">
              <span className="text-xs font-bold text-slate-800 max-w-[130px] truncate">
                {user?.city || user?.address || 'Select City / Pin'}
              </span>
              <HiChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        </div>

        {/* SLA Speed Badge */}
        <div className="hidden xl:flex items-center space-x-2 shrink-0 bg-blue-50/70 border border-blue-200/80 px-3 py-1.5 rounded-full shadow-2xs">
          <HiBolt className="w-4 h-4 text-blue-600 fill-blue-600" />
          <div className="text-left leading-tight">
            <span className="text-[10px] text-slate-500 font-medium block">Dispatch in</span>
            <span className="text-xs font-extrabold text-blue-900">24–48 hrs</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-slate-700 font-medium text-xs">
          {/* Wishlist */}
          <button
            type="button"
            onClick={() => navigate(USER_ROUTES.WISHLIST)}
            aria-label={wishlistCount > 0 ? `Wishlist, ${wishlistCount} items` : 'Wishlist'}
            className="relative p-2 rounded-full hover:bg-slate-100 transition-colors hidden sm:flex items-center justify-center"
          >
            <HiOutlineHeart className="w-5 h-5 text-slate-600" aria-hidden="true" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {wishlistCount > 9 ? '9+' : wishlistCount}
              </span>
            )}
          </button>

          {/* User Account / Profile */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate(USER_ROUTES.PROFILE)}
              className="flex items-center space-x-2 p-1 pl-1.5 rounded-full hover:bg-slate-100 transition-colors border border-slate-200/80 bg-slate-50"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase">
                {user?.name ? user.name.slice(0, 1) : 'U'}
              </div>
              <span className="text-xs font-semibold text-slate-900 hidden 2xl:inline pr-1">
                {user?.name || 'Account'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(AUTH_ROUTES.LOGIN, { state: { from: location } })}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all"
            >
              <HiUser className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Cart with Blue/Red Badge Count */}
          <button
            type="button"
            onClick={() => navigate(USER_ROUTES.CART)}
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
            className="relative p-2 rounded-full hover:bg-blue-50 bg-slate-100/80 border border-slate-200 text-slate-900 transition-colors flex items-center justify-center"
          >
            <HiOutlineShoppingBag className="w-5 h-5 text-slate-800" aria-hidden="true" />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white shadow-2xs">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-300 text-slate-700 text-[10px] font-bold rounded-full flex items-center justify-center border border-white">
                0
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}


