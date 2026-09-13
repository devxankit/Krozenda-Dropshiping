import React, { useState } from 'react'
import { HiArrowLeft, HiTag, HiDocumentDuplicate, HiCheck } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { usePublicCouponsController, useUsedCouponsController } from '../../controllers/useCouponsController'

const BADGE_BY_TYPE = {
  PERCENTAGE: { label: 'PERCENTAGE OFF', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  FIXED: { label: 'FLAT DISCOUNT', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  FREE_SHIPPING: { label: 'FREE SHIPPING', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

function formatDiscount(coupon) {
  if (coupon.discountType === 'FREE_SHIPPING') return 'Free shipping on this order'
  if (coupon.discountType === 'PERCENTAGE') return `${coupon.discountValue}% OFF`
  return `₹${coupon.discountValue} OFF`
}

export function CouponsOffersScreen({ onBack = () => {} }) {
  const [copiedCode, setCopiedCode] = useState(null)
  const { coupons, isLoading: loadingCoupons } = usePublicCouponsController()
  const { usedCoupons, isLoading: loadingUsed } = useUsedCouponsController()

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-8">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">Coupons & Exclusive Offers</h1>
            <p className="text-xs text-slate-500 mt-0.5">Apply promo codes at checkout for maximum wholesale savings.</p>
          </div>
        </div>

        {/* Available Coupons */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Available Coupons</h2>

          {loadingCoupons ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-xs font-semibold text-slate-400">
              Loading coupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-xs font-semibold text-slate-400">
              No active coupons right now — check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map((item) => {
                const badge = BADGE_BY_TYPE[item.discountType] || BADGE_BY_TYPE.FIXED
                return (
                  <div
                    key={item.code}
                    className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Valid till {new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 leading-snug">{formatDiscount(item)}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {item.description || `Applicable on orders above ₹${item.minOrderAmount.toLocaleString('en-IN')}.`}
                      </p>
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
                )
              })}
            </div>
          )}
        </section>

        {/* Used Coupons — with the product details they were used on */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Used Coupons</h2>

          {loadingUsed ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-xs font-semibold text-slate-400">
              Loading your coupon history...
            </div>
          ) : usedCoupons.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-xs font-semibold text-slate-400">
              You haven't used any coupons yet.
            </div>
          ) : (
            <div className="space-y-4">
              {usedCoupons.map((used) => (
                <div key={used.id} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <HiTag className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-slate-900">{used.code}</span>
                        <p className="text-[11px] text-slate-500">
                          Used on {new Date(used.redeemedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-600">
                      Saved ₹{used.discountAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-3 overflow-x-auto">
                    {used.products.map((product, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 shrink-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 p-0.5 flex items-center justify-center shrink-0">
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-900 truncate max-w-[140px]">{product.name}</p>
                          <span className="text-[10px] text-slate-500">Qty {product.quantity} · ₹{product.price.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
