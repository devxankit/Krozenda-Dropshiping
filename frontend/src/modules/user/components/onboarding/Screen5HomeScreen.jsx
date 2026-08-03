import React, { useState } from 'react'
import { HiBell, HiOutlineShoppingBag, HiMagnifyingGlass, HiMicrophone, HiSquares2X2, HiTag, HiSparkles, HiCheckBadge, HiShieldCheck, HiTruck, HiArrowPath } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function Screen5HomeScreen({ onNavigateTab = () => {} }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home')

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    onNavigateTab(tabId)
    if (tabId === 'categories') navigate(USER_ROUTES.ROOT + '/listing')
    if (tabId === 'orders') navigate(USER_ROUTES.ROOT + '/cart')
    if (tabId === 'wishlist') navigate(USER_ROUTES.ROOT + '/listing')
    if (tabId === 'profile') navigate(USER_ROUTES.ROOT + '/profile')
  }

  return (
    <div className="relative w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <div className="flex-1 pb-20 md:pb-12">
        <div className="md:hidden">
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs"><span>📶</span><span>📡</span><span>🔋</span></div>
          </div>
          <div className="px-5 py-3 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Deliver to</span>
              <span className="text-xs font-bold text-slate-900">Ahmedabad, Gujarat ▾</span>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate(USER_ROUTES.ROOT + '/notifications')} className="relative p-2 text-slate-700"><HiBell className="w-5 h-5" /></button>
              <button onClick={() => navigate(USER_ROUTES.ROOT + '/cart')} className="relative p-2 text-slate-700"><HiOutlineShoppingBag className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="px-5 pt-3 pb-2 bg-white border-b">
            <div onClick={() => navigate(USER_ROUTES.ROOT + '/search')} className="flex items-center bg-slate-100 border rounded-xl px-3 py-2.5 cursor-pointer">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400" />
              <span className="w-full px-2 text-xs text-slate-400">Search for products, brands and more</span>
              <HiMicrophone className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-6">
          <div onClick={() => navigate(USER_ROUTES.ROOT + '/listing')} className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 cursor-pointer flex justify-between items-center shadow-md">
            <div>
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded">Special Offer</span>
              <h3 className="text-xl font-black mt-2">Big Deals for Smart Buyers</h3>
              <p className="text-xs text-blue-200 mt-1">Up to 60% OFF on B2B bulk orders</p>
            </div>
            <img src="/images/deals_banner.png" alt="Deals" className="w-28 h-24 object-contain" />
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div onClick={() => navigate(USER_ROUTES.ROOT + '/listing')} className="bg-white p-3 rounded-2xl border cursor-pointer flex flex-col items-center">
              <span className="text-2xl mb-1">📱</span>
              <span className="text-xs font-bold">Electronics</span>
            </div>
            <div onClick={() => navigate(USER_ROUTES.ROOT + '/listing')} className="bg-white p-3 rounded-2xl border cursor-pointer flex flex-col items-center">
              <span className="text-2xl mb-1">👕</span>
              <span className="text-xs font-bold">Fashion</span>
            </div>
            <div onClick={() => navigate(USER_ROUTES.ROOT + '/listing')} className="bg-white p-3 rounded-2xl border cursor-pointer flex flex-col items-center">
              <span className="text-2xl mb-1">🥛</span>
              <span className="text-xs font-bold">Home</span>
            </div>
            <div onClick={() => navigate(USER_ROUTES.ROOT + '/listing')} className="bg-white p-3 rounded-2xl border cursor-pointer flex flex-col items-center">
              <span className="text-2xl mb-1">💄</span>
              <span className="text-xs font-bold">Beauty</span>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>
    </div>
  )
}
