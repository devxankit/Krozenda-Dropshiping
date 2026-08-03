import React, { useState } from 'react'
import { HiArrowLeft, HiTag, HiDocumentDuplicate, HiCheck } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function CouponsOffersScreen({ onBack = () => {} }) {
  const [copiedCode, setCopiedCode] = useState(null)
  const [activeFilter, setActiveFilter] = useState('All')

  const filterTabs = ['All 10', 'Coupons 6', 'Bank Offers 4']

  const coupons = [
    { id: 1, code: 'KROZ10', title: 'Flat 10% OFF on B2B Bulk Orders', description: 'Applicable on orders above ₹5,000. Maximum discount ₹1,500.', validTill: 'Valid till 31 May 2024', badge: 'POPULAR', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 2, code: 'SAVE250', title: '₹250 Cashback on First Order', description: 'Valid on first purchase for new registered users.', validTill: 'Valid till 15 Jun 2024', badge: 'NEW USER', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { id: 3, code: 'FEST15', title: '15% Discount on Electronics', description: 'Applicable on smartphones, audio accessories & wearables.', validTill: 'Valid till 20 May 2024', badge: 'CATEGORY SPECIAL', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  ]

  const handleCopy = (code) => {
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Coupons & Exclusive Offers</h1>
              <p className="text-xs text-slate-500 mt-0.5">Apply promo codes at checkout for maximum wholesale savings.</p>
            </div>
          </div>
        </div>

        {/* Coupons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">{item.validTill}</span>
                </div>

                <h3 className="text-base font-black text-slate-900 leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="bg-dashed border-2 border-blue-600/40 bg-blue-50/50 px-3.5 py-1.5 rounded-xl font-mono font-black text-xs text-blue-700 tracking-wider">
                  {item.code}
                </div>

                <button
                  onClick={() => handleCopy(item.code)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs"
                >
                  {copiedCode === item.code ? (
                    <>
                      <HiCheck className="w-4 h-4 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <HiDocumentDuplicate className="w-4 h-4" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
