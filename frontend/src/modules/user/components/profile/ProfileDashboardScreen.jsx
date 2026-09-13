import React, { useState } from 'react'
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
  HiPencilSquare,
  HiXMark,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useProfileController } from '../../controllers/useProfileController'
import { useWalletController } from '../../controllers/useWalletController'

const QUICK_AMOUNTS = [200, 500, 1000, 2000]

function AddMoneyModal({ open, onClose, onConfirm, isSubmitting }) {
  const [amount, setAmount] = useState('500')
  const [error, setError] = useState(null)

  if (!open) return null

  const handleConfirm = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10) {
      setError('Enter an amount of at least ₹10')
      return
    }
    setError(null)
    try {
      await onConfirm(value)
      onClose()
    } catch (err) {
      setError(err?.message || 'Payment could not be completed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Add Money to Wallet</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">Enter Amount</span>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white">
              <span className="text-sm font-black text-slate-500 mr-1">₹</span>
              <input
                type="number"
                min="10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-base font-black text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                onClick={() => setAmount(String(value))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
              >
                ₹{value}
              </button>
            ))}
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs tracking-wide transition-colors"
          >
            {isSubmitting ? 'Processing...' : 'Proceed to Pay'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProfileDashboardScreen({ onNavigateMenu = () => {} }) {
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)
  const { profile } = useProfileController()
  const { balance, topup, isToppingUp } = useWalletController()
  const [showAddMoney, setShowAddMoney] = useState(false)

  const user = {
    name: profile?.name || authUser?.name || 'Customer',
    mobile: profile?.mobileNumber || authUser?.mobileNumber || authUser?.phone || '',
    email: profile?.email || authUser?.email || '',
    image: profile?.image || authUser?.image || null,
  }

  const handleAddMoney = (amount) =>
    topup(amount, { name: user.name, email: user.email, contact: user.mobile })

  const orderShortcuts = [
    { label: 'All Orders', Icon: HiShoppingBag, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Processing', Icon: HiArrowPath, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Shipped', Icon: HiTruck, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Delivered', Icon: HiCheckCircle, route: USER_ROUTES.ROOT + '/orders' },
    { label: 'Cancelled', Icon: HiXCircle, route: USER_ROUTES.ROOT + '/orders' },
  ]

  const menuItems = [
    { label: 'Edit Profile', Icon: HiPencilSquare, route: USER_ROUTES.PROFILE_EDIT },
    { label: 'My Addresses', Icon: HiMapPin, route: USER_ROUTES.ROOT + '/profile/addresses' },
    { label: 'Wishlist', Icon: HiHeart, route: USER_ROUTES.ROOT + '/wishlist' },
    { label: 'Coupons & Offers', Icon: HiTag, route: USER_ROUTES.ROOT + '/coupons' },
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
        <div className="md:hidden"></div>

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
              <div className="w-16 h-16 rounded-full bg-white text-blue-900 font-black text-2xl flex items-center justify-center border-4 border-white/20 shadow-md overflow-hidden">
                {user.image ? (
                  <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
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
                  <span className="text-sm font-black text-white">₹{balance.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddMoney(true)}
                className="bg-white text-blue-900 hover:bg-slate-100 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition-colors"
              >
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
                    if (item.isLogout) {
                      useAuthStore.getState().clearSession()
                    }
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

      <AddMoneyModal
        open={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        onConfirm={handleAddMoney}
        isSubmitting={isToppingUp}
      />

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
