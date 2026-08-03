import React from 'react'
import { useNavigate } from 'react-router-dom'
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

export function BottomNavbar({ activeTab = 'home', onChangeTab }) {
  const navigate = useNavigate()

  const tabs = [
    { id: 'home', label: 'Home', route: USER_ROUTES.DASHBOARD, ActiveIcon: HiHome, InactiveIcon: HiOutlineHome },
    { id: 'categories', label: 'Categories', route: USER_ROUTES.ROOT + '/categories', ActiveIcon: HiSquares2X2, InactiveIcon: HiOutlineSquares2X2 },
    { id: 'orders', label: 'Orders', route: USER_ROUTES.ROOT + '/orders', ActiveIcon: HiShoppingBag, InactiveIcon: HiOutlineShoppingBag },
    { id: 'wishlist', label: 'Wishlist', route: USER_ROUTES.ROOT + '/wishlist', ActiveIcon: HiHeart, InactiveIcon: HiOutlineHeart },
    { id: 'profile', label: 'Profile', route: USER_ROUTES.ROOT + '/profile', ActiveIcon: HiUser, InactiveIcon: HiOutlineUser },
  ]

  const handleTabClick = (tab) => {
    if (onChangeTab) {
      onChangeTab(tab.id)
    } else {
      navigate(tab.route)
    }
  }

  return (
    <div className="w-full bg-white border-t border-slate-200/80 px-4 py-2 shadow-xl flex items-center justify-around select-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const IconComponent = isActive ? tab.ActiveIcon : tab.InactiveIcon

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 transition-all duration-200 ease-out focus:outline-none ${
              isActive ? 'text-blue-600 scale-105 font-bold' : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <IconComponent className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute -bottom-1" />
            )}
          </button>
        )
      })}
    </div>
  )
}
