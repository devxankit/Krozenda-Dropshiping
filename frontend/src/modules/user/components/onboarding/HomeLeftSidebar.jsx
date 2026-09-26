import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  HiHome,
  HiTag,
  HiShoppingBag,
  HiOutlineHeart,
  HiHeart,
  HiLifebuoy,
  HiTruck,
  HiFire,
  HiSparkles,
  HiSquares2X2,
  HiBolt,
  HiChevronRight,
} from 'react-icons/hi2'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useWishlistCount } from '../../../../lib/wishlistStore'
import { SmartImage } from '../../../../components/ui/SmartImage'

// Smart icon mapping for marketplace categories
const CATEGORY_ICON_MAP = {
  beauty: HiSparkles,
  personal: HiSparkles,
  computer: HiSquares2X2,
  laptop: HiSquares2X2,
  electronic: HiBolt,
  gadget: HiBolt,
  mobile: HiBolt,
  fashion: HiTag,
  apparel: HiTag,
  footwear: HiTag,
  shoes: HiTag,
  sneaker: HiTag,
  automotive: HiTruck,
  fitness: HiBolt,
  outdoor: HiSparkles,
  grocery: HiShoppingBag,
  living: HiHome,
  kitchen: HiSquares2X2,
  appliance: HiSquares2X2,
}

export function HomeLeftSidebar({ categories = [], isLoading = false, className = '' }) {
  const location = useLocation()
  const wishlistCount = useWishlistCount()
  const isHomeActive = location.pathname === USER_ROUTES.DASHBOARD || location.pathname === '/'

  // Derive active category from query params if on listing page
  const searchParams = new URLSearchParams(location.search)
  const activeCategoryId = searchParams.get('category')

  return (
    <aside
      className={`w-56 xl:w-64 shrink-0 flex flex-col justify-between self-start sticky top-20 z-30 transition-all ${className}`}
      aria-label="Category and Primary Navigation"
    >
      <div className="bg-white rounded-3xl border border-slate-200/80 p-3 shadow-card space-y-1.5 overflow-hidden">
        {/* Active Home Navigation Pill (Blue brand theme) */}
        <Link
          to={USER_ROUTES.DASHBOARD}
          onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}
          className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition-all shadow-xs ${
            isHomeActive && !activeCategoryId
              ? 'bg-blue-600 text-white font-bold shadow-blue-600/25'
              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              isHomeActive && !activeCategoryId ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <HiHome className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="truncate">Home</span>
        </Link>

        {/* Dynamic Category List */}
        <div className="pt-1 pb-1 space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto no-scrollbar scroll-smooth">
          {isLoading
            ? [1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="flex items-center space-x-3 px-3.5 py-2 rounded-xl animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <div className="w-24 h-3 bg-slate-200 rounded" />
                </div>
              ))
            : categories.map((cat) => {
                const isCatActive = activeCategoryId === String(cat.id || cat._id)
                const catNameLower = (cat.name || '').toLowerCase()
                let IconComponent = HiTag
                for (const [key, icon] of Object.entries(CATEGORY_ICON_MAP)) {
                  if (catNameLower.includes(key)) {
                    IconComponent = icon
                    break
                  }
                }

                return (
                  <Link
                    key={cat.id || cat._id}
                    to={userPath.listing({ category: cat.id || cat._id })}
                    onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isCatActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {cat.image ? (
                          <SmartImage
                            src={cat.image}
                            alt={cat.name}
                            sizes="24px"
                            ratio="1 / 1"
                            fit="cover"
                            className="w-full h-full rounded-full overflow-hidden object-cover"
                            imgClassName="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <IconComponent className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
                        )}
                      </div>
                      <span className="truncate">{cat.name}</span>
                    </div>

                    <HiChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                )
              })}

          {/* Offers Quick Shortcut */}
          <Link
            to={USER_ROUTES.COUPONS}
            className="group flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-blue-700 hover:bg-blue-50/80 transition-colors"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <HiTag className="w-3.5 h-3.5" />
              </div>
              <span className="truncate font-semibold">Special Offers</span>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md uppercase">
              Deals
            </span>
          </Link>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 my-1.5" />

        {/* User Account Quick Links */}
        <div className="space-y-0.5">
          <Link
            to={USER_ROUTES.ORDERS}
            className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-colors"
          >
            <HiShoppingBag className="w-4 h-4 text-slate-400" />
            <span className="truncate">My Orders</span>
          </Link>

          <Link
            to={USER_ROUTES.WISHLIST}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-colors"
          >
            <div className="flex items-center space-x-3 min-w-0">
              {wishlistCount > 0 ? (
                <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
              ) : (
                <HiOutlineHeart className="w-4 h-4 text-slate-400" />
              )}
              <span className="truncate">Wishlist</span>
            </div>
            {wishlistCount > 0 && (
              <span className="text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full border border-red-100">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link
            to={USER_ROUTES.SUPPORT}
            className="flex items-center space-x-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-colors"
          >
            <HiLifebuoy className="w-4 h-4 text-slate-400" />
            <span className="truncate">Help &amp; Support</span>
          </Link>
        </div>
      </div>

      {/* Bottom Promo Box (Free Delivery - Blue theme) */}
      <div className="mt-3.5 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 rounded-3xl p-3.5 shadow-xs text-center flex flex-col items-center">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 mb-2 shadow-2xs">
          <HiTruck className="w-5 h-5 text-blue-600" />
        </div>
        <h4 className="text-xs font-bold text-slate-900">Free Express Delivery</h4>
        <p className="text-[11px] text-slate-500 font-medium mt-0.5">On verified wholesale orders above ₹499</p>
      </div>
    </aside>
  )
}

