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
  HiTrash,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useProfileController } from '../../controllers/useProfileController'
import { useWalletController } from '../../controllers/useWalletController'
import { toast } from '../../../../lib/toast'

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

function DeleteAccountModal({ open, onClose, onConfirm, isSubmitting }) {
  const [error, setError] = useState(null)

  if (!open) return null

  const handleDelete = async () => {
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete account. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl border border-red-100 overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
            <HiTrash className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-900">Delete Account?</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete your account? This action cannot be undone. All your profile data, saved addresses, and order history will be permanently deleted.
            </p>
          </div>

          {error && (
            <div className="p-2.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl text-left">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl shadow-md transition-colors"
            >
              {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfileDashboardScreen({ onNavigateMenu = () => {} }) {
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)
  const { profile, deleteAccount, isDeletingAccount } = useProfileController()
  const { balance, topup, isToppingUp } = useWalletController()
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const user = {
    name: profile?.name || authUser?.name || 'Customer',
    mobile: profile?.mobileNumber || authUser?.mobileNumber || authUser?.phone || '',
    email: profile?.email || authUser?.email || '',
    image: profile?.image || authUser?.image || null,
  }

  const handleAddMoney = (amount) =>
    topup(amount, { name: user.name, email: user.email, contact: user.mobile })
      .then(() => toast.success('Wallet Recharged', `₹${amount.toLocaleString('en-IN')} added to your wallet.`))
      .catch((err) => {
        if (err?.message !== 'Payment cancelled') {
          toast.error('Top-up Failed', err)
        }
      })

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount()
      useAuthStore.getState().clearSession()
      toast.info('Account Deleted', 'Your account was deleted.')
      navigate(AUTH_ROUTES.LOGIN, { replace: true })
    } catch (err) {
      toast.error('Could not delete account', err)
    }
  }

  const orderShortcuts = [
    { label: 'All Orders', Icon: HiShoppingBag, route: USER_ROUTES.ORDERS },
    { label: 'Processing', Icon: HiArrowPath, route: USER_ROUTES.ORDERS },
    { label: 'Shipped', Icon: HiTruck, route: USER_ROUTES.ORDERS },
    { label: 'Delivered', Icon: HiCheckCircle, route: USER_ROUTES.ORDERS },
    { label: 'Cancelled', Icon: HiXCircle, route: USER_ROUTES.ORDERS },
  ]

  const menuItems = [
    { label: 'Edit Profile', Icon: HiPencilSquare, route: USER_ROUTES.PROFILE_EDIT },
    { label: 'My Addresses', Icon: HiMapPin, route: USER_ROUTES.ADDRESSES },
    { label: 'My Wallet', Icon: HiWallet, route: USER_ROUTES.WALLET },
    { label: 'Wishlist', Icon: HiHeart, route: USER_ROUTES.WISHLIST },
    { label: 'Coupons & Offers', Icon: HiTag, route: USER_ROUTES.COUPONS },
    { label: 'My Reviews', Icon: HiStar, route: '/app/reviews' },
    { label: 'Returns & Replacements', Icon: HiArrowPath, route: USER_ROUTES.RETURNS },
    { label: 'Support Center', Icon: HiQuestionMarkCircle, route: USER_ROUTES.SUPPORT },
    { label: 'Settings', Icon: HiCog6Tooth, route: USER_ROUTES.SETTINGS },
    { label: 'Logout', Icon: HiArrowRightOnRectangle, route: AUTH_ROUTES.LOGIN, isLogout: true },
    { label: 'Delete Account', Icon: HiTrash, isDelete: true },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="sticky top-0 z-50 hidden md:block">
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
              onClick={() => navigate(USER_ROUTES.NOTIFICATIONS)}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiBell className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.SETTINGS)}
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
                  <SmartImage
                    src={user.image}
                    alt={`${user.name || 'Your'} profile photo`}
                    sizes="80px"
                    ratio="1 / 1"
                    fit="cover"
                    className="h-full w-full"
                  />
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
                onClick={() => navigate(USER_ROUTES.ORDERS)}
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
                    if (item.isDelete) {
                      setShowDeleteModal(true)
                      return
                    }
                    onNavigateMenu(item.label)
                    if (item.isLogout) {
                      useAuthStore.getState().clearSession()
                      toast.info('Signed Out', 'You have been signed out safely.')
                    }
                    navigate(item.route)
                  }}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        item.isDelete || item.isLogout ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        item.isDelete || item.isLogout ? 'text-red-600' : 'text-slate-800'
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

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        isSubmitting={isDeletingAccount}
      />

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
