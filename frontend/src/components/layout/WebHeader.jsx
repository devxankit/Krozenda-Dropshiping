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
} from 'react-icons/hi2'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { USER_ROUTES, AUTH_ROUTES, userPath } from '../../config/routes'
import { useAuthStore } from '../../lib/authStore'
import { useCartCount } from '../../lib/cartStore'
import { useWishlistCount } from '../../lib/wishlistStore'
import { useUnreadNotificationCount } from '../../lib/notificationStore'
import { useCategoriesController } from '../../modules/user/controllers/useProductsController'

// REMOVED: FALLBACK_NAV_CATEGORIES — four invented categories ("Smartwatches",
// "Home & Kitchen") with ids that matched nothing in the catalog, shown
// whenever the categories request failed or returned nothing. Clicking one
// navigated to a listing filtered by a category that did not exist.
//
// The nav now shows real categories, or nothing at all: a missing row of
// shortcuts is invisible to a shopper, whereas four dead links are not.

export function WebHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const [searchTerm, setSearchTerm] = useState('')
  const cartCount = useCartCount()
  const wishlistCount = useWishlistCount()
  const unreadCount = useUnreadNotificationCount()

  // Shared react-query entry, not a private fetch. The header renders on every
  // buyer screen, so its own useEffect meant a categories request on EVERY
  // navigation, racing with the home page's and the filter panel's copies of
  // the same call. One cached entry now serves all of them (§32).
  const { categories } = useCategoriesController()
  const navCategories = categories.slice(0, 4)

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const q = searchTerm.trim()
    // An empty search used to run a search for the literal word "Products".
    navigate(q ? userPath.search(q) : USER_ROUTES.LISTING)
  }

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 shadow-xs">
      {/* Top Bar */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2.5 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link
          to={USER_ROUTES.DASHBOARD}
          className="flex items-center space-x-2 cursor-pointer shrink-0 transition-opacity hover:opacity-90"
          title="KroZenda Home"
        >
          <img
            src="/images/logo.png"
            alt="KroZenda Logo"
            className="h-12 md:h-14 w-auto object-contain py-0.5"
          />
        </Link>

        {/* Search Bar with Category Dropdown */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-3xl hidden md:flex items-center bg-slate-100/90 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:bg-white focus-within:border-transparent transition-all shadow-xs"
        >
          <select
            aria-label="Filter search by category"
            onChange={(e) => {
              const categoryId = e.target.value
              navigate(categoryId ? userPath.listing({ category: categoryId }) : USER_ROUTES.CATEGORIES)
            }}
            className="bg-slate-200/60 border-r border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2.5 outline-none cursor-pointer hover:bg-slate-200/90 transition-colors"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex-1 flex items-center px-3.5">
            <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Search products"
              placeholder="Search products, brands and verified suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2.5 py-2 bg-transparent text-xs font-normal text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 md:space-x-4 text-slate-700 font-medium text-xs">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => navigate(USER_ROUTES.NOTIFICATIONS)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiBell className="w-5 h-5 text-slate-600" aria-hidden="true" />
            <span className="hidden lg:inline text-[11px] font-medium text-slate-600 mt-0.5">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Wishlist */}
          <button
            type="button"
            onClick={() => navigate(USER_ROUTES.WISHLIST)}
            aria-label={wishlistCount > 0 ? `Wishlist, ${wishlistCount} items` : 'Wishlist'}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiOutlineHeart className="w-5 h-5 text-slate-600" aria-hidden="true" />
            <span className="hidden lg:inline text-[11px] font-medium text-slate-600 mt-0.5">Wishlist</span>
            {wishlistCount > 0 && (
              <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {wishlistCount > 9 ? '9+' : wishlistCount}
              </span>
            )}
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={() => navigate(USER_ROUTES.CART)}
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
            className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors flex flex-col items-center"
          >
            <HiOutlineShoppingBag className="w-5 h-5 text-slate-600" aria-hidden="true" />
            <span className="hidden lg:inline text-[11px] font-medium text-slate-600 mt-0.5">Cart</span>
            {cartCount > 0 && (
              <span className="absolute top-1 right-1.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>

          {/* User Account / Profile or Sign In */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate(USER_ROUTES.PROFILE)}
              className="flex items-center space-x-2.5 p-1.5 pl-2 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200/80 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase">
                {user?.name ? user.name.slice(0, 1) : 'U'}
              </div>
              <div className="hidden lg:block text-left pr-1">
                <span className="text-xs font-semibold text-slate-900 block leading-tight">
                  {user?.name || 'Customer'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Account & Orders</span>
              </div>
              <HiChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(AUTH_ROUTES.LOGIN, { state: { from: location } })}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all"
            >
              <HiUser className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Navbar (Categories & Quick Links) */}
      <div className="bg-slate-900 text-white text-xs font-medium py-2">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 flex items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none gap-4">
          <div className="flex items-center space-x-5">
            <Link
              to={USER_ROUTES.CATEGORIES}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg text-white font-semibold transition-colors shadow-xs"
            >
              <HiBars3 className="w-4 h-4" aria-hidden="true" />
              <span>All Categories</span>
            </Link>
            {navCategories.map((cat) => (
              <Link
                key={cat.id}
                to={userPath.listing({ category: cat.id })}
                className="hover:text-amber-300 text-slate-200 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              to={USER_ROUTES.COUPONS}
              className="hover:text-amber-300 transition-colors flex items-center space-x-1 text-amber-300 font-semibold"
            >
              <HiSparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Offers &amp; Coupons</span>
            </Link>
          </div>

          <div className="flex items-center space-x-5 text-slate-300 text-xs">
            <Link to={USER_ROUTES.SUPPORT} className="hover:text-white transition-colors">
              Help Center
            </Link>
            <Link to={USER_ROUTES.SETTINGS} className="hover:text-white transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
