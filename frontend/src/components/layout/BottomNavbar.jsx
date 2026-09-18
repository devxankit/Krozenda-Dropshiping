import React from 'react'
import { motion } from 'framer-motion'
import { useKeyboardOpen } from '../../lib/useKeyboardOpen'
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

  const handleTabClick = (tab) => {
    if (onChangeTab) {
      onChangeTab(tab.id)
    } else {
      navigate(tab.route)
    }
  }

  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden w-full select-none border-t border-slate-200/80 bg-white/95 px-2 pt-1.5 shadow-2xl backdrop-blur-md pb-[calc(6px+env(safe-area-inset-bottom,0px))] fixed-bottom-nav"
    >
      <div className="max-w-md mx-auto relative grid grid-cols-5 items-center">
        {tabs.map((tab) => {
          const isActive = currentActiveTab === tab.id
          const IconComponent = isActive ? tab.ActiveIcon : tab.InactiveIcon

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? 'page' : undefined}
              className="relative z-10 flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavPill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-2xl bg-blue-50 border border-blue-100/80 -z-10"
                />
              )}

              <IconComponent
                aria-hidden="true"
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'scale-110 text-blue-600' : 'scale-100 text-slate-500 hover:text-slate-800'
                }`}
              />
              <span
                className={`text-[10px] mt-1 tracking-tight transition-colors duration-200 ${
                  isActive ? 'text-blue-700 font-bold' : 'text-slate-500 font-medium'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
