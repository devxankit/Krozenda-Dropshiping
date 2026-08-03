import React, { useState } from 'react'
import { HiArrowLeft, HiTag, HiDocumentDuplicate } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function CouponsOffersScreen({
  onBack = () => {},
}) {
  const [copiedCode, setCopiedCode] = useState(null)
  const [activeFilter, setActiveFilter] = useState('All')

  const filterTabs = ['All 10', 'Coupons 6', 'Bank Offers 4']

  const coupons = [
    {
      id: 1,
      code: 'KROZ10',
      title: 'Flat 10% OFF on B2B Bulk Orders',
      description: 'Applicable on orders above ₹5,000. Maximum discount ₹1,500.',
      validTill: 'Valid till 31 May 2024',
      badge: 'POPULAR',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      id: 2,
      code: 'SAVE250',
      title: '₹250 Cashback on First Order',
      description: 'Valid on first purchase for new registered users.',
      validTill: 'Valid till 15 Jun 2024',
      badge: 'NEW USER',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 3,
      code: 'FEST15',
      title: '15% Discount on Electronics Category',
      description: 'Applicable on smartphones, audio accessories & wearables.',
      validTill: 'Valid till 20 May 2024',
      badge: 'CATEGORY SPECIAL',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
  ]

  const handleCopy = (code) => {
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

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
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Coupons & Offers</h2>
          </div>
          <button className="text-xs font-bold text-blue-600 hover:underline">
            Apply Coupon
          </button>
        </div>

        {/* Category Filter Tabs Bar */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex space-x-2 text-xs font-bold">
          {filterTabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-full border transition-all ${
                idx === 0
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden space-y-3"
            >
              {/* Left Ticket Notch */}
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
              {/* Right Ticket Notch */}
              <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <HiTag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 tracking-wider">
                      {coupon.code}
                    </span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${coupon.badgeColor}`}>
                      {coupon.badge}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(coupon.code)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1"
                >
                  <HiDocumentDuplicate className="w-3.5 h-3.5" />
                  <span>{copiedCode === coupon.code ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-xs space-y-1">
                <h4 className="font-bold text-slate-900">{coupon.title}</h4>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {coupon.description}
                </p>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>{coupon.validTill}</span>
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                  T&C Apply
                </span>
              </div>
            </div>
          ))}

          {/* Bank Offer Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md space-y-2">
            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] uppercase rounded">
              BANK OFFER
            </span>
            <h4 className="text-xs font-bold">10% Instant Discount on HDFC Bank Cards</h4>
            <p className="text-[10px] text-blue-200">
              On minimum transaction value of ₹7,500. Valid on Credit & Debit Cards EMI.
            </p>
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
