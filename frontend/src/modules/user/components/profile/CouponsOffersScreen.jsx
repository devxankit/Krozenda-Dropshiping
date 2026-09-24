import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiTag } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { useUsedCouponsController } from '../../controllers/useCouponsController'

export function CouponsOffersScreen({ onBack }) {
  // Falls back to real navigation when no callback is supplied. The
  // router stopped passing one when every screen took ownership of its
  // own navigation; the previous `= () => {}` default silently turned
  // the back button into a no-op.
  const goBackFallback = useNavigate()
  const handleBack = onBack || (() => goBackFallback(-1))

  const { usedCoupons, isLoading: loadingUsed } = useUsedCouponsController()

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="sticky top-0 z-50 hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-8">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">Coupons & Offers</h1>
            <p className="text-xs text-slate-500 mt-0.5">Coupons you've used, with the products they were applied to.</p>
          </div>
        </div>

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
