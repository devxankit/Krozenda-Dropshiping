import React from 'react'
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

export function BottomNavbar({ activeTab = 'home', onChangeTab = () => {} }) {
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      ActiveIcon: HiHome,
      InactiveIcon: HiOutlineHome,
    },
    {
      id: 'categories',
      label: 'Categories',
      ActiveIcon: HiSquares2X2,
      InactiveIcon: HiOutlineSquares2X2,
    },
    {
      id: 'orders',
      label: 'Orders',
      ActiveIcon: HiShoppingBag,
      InactiveIcon: HiOutlineShoppingBag,
      badge: null,
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      ActiveIcon: HiHeart,
      InactiveIcon: HiOutlineHeart,
    },
    {
      id: 'profile',
      label: 'Profile',
      ActiveIcon: HiUser,
      InactiveIcon: HiOutlineUser,
    },
  ]

  return (
    <div className="w-full bg-white border-t border-slate-100 px-4 py-2 shadow-lg flex items-center justify-around select-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const IconComponent = isActive ? tab.ActiveIcon : tab.InactiveIcon

        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 transition-all duration-200 ease-out focus:outline-none ${
              isActive ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {/* Active Indicator bar/dot */}
            {isActive && (
              <span className="absolute -top-2 w-8 h-1 bg-blue-600 rounded-full animate-scale-up" />
            )}

            <div className="relative">
              <IconComponent className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'stroke-[2.2px]' : ''}`} />
              {tab.badge && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {tab.badge}
                </span>
              )}
            </div>

            <span className={`text-[11px] mt-1 font-medium tracking-tight ${isActive ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
