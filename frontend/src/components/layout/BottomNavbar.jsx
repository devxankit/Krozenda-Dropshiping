import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  HiHome,
  HiOutlineHome,
  HiSquares2X2,
  HiOutlineSquares2X2,
  HiShoppingBag,
  HiOutlineShoppingBag,
  HiHeart,
  HiOutlineHeart,
  HiUser,
  HiOutlineUser,
} from 'react-icons/hi2'
import { USER_ROUTES } from '../../config/routes'

export function BottomNavbar({ activeTab, onChangeTab }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  let currentActiveTab = activeTab
  if (!currentActiveTab) {
    if (currentPath.includes('/categories')) currentActiveTab = 'categories'
    else if (currentPath.includes('/orders')) currentActiveTab = 'orders'
    else if (currentPath.includes('/wishlist')) currentActiveTab = 'wishlist'
    else if (
      currentPath.includes('/profile') ||
      currentPath.includes('/settings') ||
      currentPath.includes('/coupons') ||
      currentPath.includes('/support')
    ) {
      currentActiveTab = 'profile'
    } else if (currentPath.includes('/dashboard')) {
      currentActiveTab = 'home'
    } else {
      currentActiveTab = 'home'
    }
  }

  const tabs = [
    { id: 'home', label: 'Home', route: USER_ROUTES.DASHBOARD, ActiveIcon: HiHome, InactiveIcon: HiOutlineHome },
    { id: 'categories', label: 'Categories', route: USER_ROUTES.CATEGORIES, ActiveIcon: HiSquares2X2, InactiveIcon: HiOutlineSquares2X2 },
    { id: 'orders', label: 'Orders', route: USER_ROUTES.ORDERS, ActiveIcon: HiShoppingBag, InactiveIcon: HiOutlineShoppingBag },
    { id: 'wishlist', label: 'Wishlist', route: USER_ROUTES.WISHLIST, ActiveIcon: HiHeart, InactiveIcon: HiOutlineHeart },
    { id: 'profile', label: 'Profile', route: USER_ROUTES.PROFILE, ActiveIcon: HiUser, InactiveIcon: HiOutlineUser },
  ]

  const activeIndex = tabs.findIndex((t) => t.id === currentActiveTab)
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0

  const handleTabClick = (tab) => {
    if (onChangeTab) {
      onChangeTab(tab.id)
    } else {
      navigate(tab.route)
    }
  }

  return (
    <nav
      aria-label="Primary"
      // pb-[env(safe-area-inset-bottom)] is what keeps the labels above the
      // iPhone home indicator and Android gesture bar instead of behind them.
      // It resolves to 0 in a desktop browser, so nothing changes there.
      className="relative w-full select-none border-t border-slate-200/90 bg-white/95 px-2 pt-1.5 shadow-2xl backdrop-blur-md pb-[calc(6px+env(safe-area-inset-bottom,0px))]"
    >
      <div className="max-w-md mx-auto relative grid grid-cols-5 items-center">
        {/* Smooth Sliding Background Pill Indicator */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0.5 top-0.5 rounded-2xl border border-blue-500/20 bg-blue-600/10 shadow-2xs transition-all duration-300 ease-out"
          style={{
            left: `${safeActiveIndex * 20}%`,
            width: '20%',
          }}
        />

        {tabs.map((tab) => {
          const isActive = currentActiveTab === tab.id
          const IconComponent = isActive ? tab.ActiveIcon : tab.InactiveIcon

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab)}
              // aria-current tells a screen reader which tab is active; the
              // colour change alone conveyed nothing to one.
              aria-current={isActive ? 'page' : undefined}
              // min-h-12 gives a 48px target — the icon+label was ~36px.
              className="relative z-10 flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <IconComponent
                aria-hidden="true"
                className={`w-5 h-5 transition-all duration-300 ${
                  isActive ? 'scale-110 -translate-y-0.5 text-blue-600' : 'scale-100 text-slate-500 hover:text-slate-800'
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 tracking-tight transition-colors duration-300 ${
                  isActive ? 'text-blue-700 font-extrabold' : 'text-slate-500 font-semibold'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
