import React from 'react'
import {
  HiBell,
  HiCog6Tooth,
  HiCheckBadge,
  HiWallet,
  HiMapPin,
  HiHeart,
  HiTag,
  HiStar,
  HiQuestionMarkCircle,
  HiArrowRightOnRectangle,
  HiChevronRight,
  HiShoppingBag,
  HiArrowPath,
  HiTruck,
  HiCheckCircle,
  HiXCircle,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function ProfileDashboardScreen({
  user = {
    name: 'Rahul Sharma',
    mobile: '+91 98765 43210',
    email: 'rahulsharma@example.com',
    walletBalance: '2,450.00',
  },
  onNavigateMenu = () => {},
}) {
  const navigate = useNavigate()

  const orderShortcuts = [
    { label: 'All Orders', Icon: HiShoppingBag, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Processing', Icon: HiArrowPath, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Shipped', Icon: HiTruck, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Delivered', Icon: HiCheckCircle, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Cancelled', Icon: HiXCircle, route: USER_ROUTES.ROOT + '/orders' },
  ]

  const menuItems = [
    { label: 'My Addresses', Icon: HiMapPin, route: USER_ROUTES.ROOT + '/profile/addresses' },
    { label: 'Wishlist', Icon: HiHeart, route: USER_ROUTES.ROOT + '/wishlist' },
    { label: 'Coupons & Offers', Icon: HiTag, route: USER_ROUTES.ROOT + '/coupons' },
    { label: 'Krozenda Wallet', Icon: HiWallet, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'My Reviews', Icon: HiStar, route: USER_ROUTES.ROOT + '/orders/review' },
    { label: 'Support Center', Icon: HiQuestionMarkCircle, route: USER_ROUTES.ROOT + '/support' },
    { label: 'Settings', Icon: HiCog6Tooth, route: USER_ROUTES.ROOT + '/settings' },
    { label: 'Logout', Icon: HiArrowRightOnRectangle, route: AUTH_ROUTES.LOGIN, isLogout: true },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <h2 className="text-base font-bold text-slate-900">My Profile</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiBell className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/settings')}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiCog6Tooth className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* User Info Header Banner */}
          <div className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-white text-blue-900 font-black text-2xl flex items-center justify-center border-4 border-white/20 shadow-md">
                R
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-base font-extrabold">{user.name}</h3>
                  <HiCheckBadge className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-xs text-blue-200 font-medium">{user.mobile}</p>
                <p className="text-[11px] text-blue-300">{user.email}</p>
              </div>
            </div>

            {/* Wallet Card Overlap */}
            <div className="mt-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
                  <HiWallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-blue-200 font-medium block">Krozenda Wallet</span>
                  <span className="text-sm font-black text-white">₹{user.walletBalance}</span>
                </div>
              </div>
              <button className="bg-white text-blue-900 hover:bg-slate-100 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition-colors">
                Add Money
              </button>
            </div>
          </div>

          {/* My Orders Short-cuts */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                My Orders
              </h3>
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/orders')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View All →
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center pt-1">
              {orderShortcuts.map((item, idx) => {
                const IconComp = item.Icon
                return (
                  <div
                    key={idx}
                    onClick={() => navigate(item.route)}
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 mt-1 truncate w-full">
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Navigation Menu List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs">
            {menuItems.map((item, idx) => {
              const IconComp = item.Icon

              return (
                <div
                  key={idx}
                  onClick={() => {
                    onNavigateMenu(item.label)
                    navigate(item.route)
                  }}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        item.isLogout ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        item.isLogout ? 'text-red-600' : 'text-slate-800'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  <HiChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
