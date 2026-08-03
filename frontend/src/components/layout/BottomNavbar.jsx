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
    { id: 'categories', label: 'Categories', route: USER_ROUTES.ROOT + '/categories', ActiveIcon: HiSquares2X2, InactiveIcon: HiOutlineSquares2X2 },
    { id: 'orders', label: 'Orders', route: USER_ROUTES.ROOT + '/orders', ActiveIcon: HiShoppingBag, InactiveIcon: HiOutlineShoppingBag },
    { id: 'wishlist', label: 'Wishlist', route: USER_ROUTES.ROOT + '/wishlist', ActiveIcon: HiHeart, InactiveIcon: HiOutlineHeart },
    { id: 'profile', label: 'Profile', route: USER_ROUTES.ROOT + '/profile', ActiveIcon: HiUser, InactiveIcon: HiOutlineUser },
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
    <nav className="w-full bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1.5 shadow-2xl relative select-none">
      <div className="max-w-md mx-auto relative grid grid-cols-5 items-center">
        {/* Smooth Sliding Background Pill Indicator */}
        <div
          className="absolute top-0.5 bottom-0.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 shadow-2xs transition-all duration-300 ease-out pointer-events-none"
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
              onClick={() => handleTabClick(tab)}
              className="relative z-10 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-colors duration-200 focus:outline-none"
            >
              <IconComponent
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
