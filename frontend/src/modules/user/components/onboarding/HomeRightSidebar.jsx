import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HiClock,
  HiChevronRight,
  HiShieldCheck,
  HiCheckBadge,
  HiSparkles,
  HiTruck,
  HiCheck,
  HiOutlineShoppingBag,
} from 'react-icons/hi2'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'

export function HomeRightSidebar({ dealProduct, onKnowMore, className = '' }) {
  const navigate = useNavigate()
  const addItem = useCartStore((state) => state.addItem)
  const [isAdding, setIsAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  // Default fallback spotlight deal matching marketplace catalog
  const activeDeal = dealProduct || {
    id: 'deal-spotlight',
    name: 'Wireless Bluetooth Earbuds Pro (ANC)',
    price: 1999,
    salePrice: 799,
    discountPercent: 60,
    image: '/images/boat_airdopes.png',
  }

  const handleAddToCart = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!activeDeal?.id || isAdding) return

    try {
      setIsAdding(true)
      await addItem(activeDeal, 1)
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 2200)
    } catch (err) {
      console.error('Failed to add spotlight deal to cart:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const formatPrice = (val) => `₹${Number(val ?? 0).toLocaleString('en-IN')}`

  return (
    <aside
      className={`w-72 2xl:w-80 shrink-0 flex flex-col space-y-4 self-start sticky top-20 z-30 transition-all ${className}`}
      aria-label="Daily Deals and Quality Assurance"
    >
      {/* WIDGET 1: Top Feature / Factory Wholesale Card (Blue Theme) */}
      <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-white rounded-3xl border border-blue-200/80 p-4 sm:p-5 shadow-card relative overflow-hidden group">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 z-10">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full inline-block">
              Verified Suppliers
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
              Direct Factory <br />
              <span className="text-blue-600">Wholesale Hub</span>
            </h3>
            <p className="text-xs text-slate-600 font-normal leading-relaxed pt-0.5">
              Source verified products directly from certified manufacturers with GST invoices.
            </p>
            <div className="pt-2">
              <Link
                to={USER_ROUTES.LISTING}
                className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-102 active:scale-98"
              >
                <span>Explore Catalog</span>
                <HiChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden shadow-card border border-blue-200/60 shrink-0 bg-blue-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <SmartImage
              src="/images/cat_laptops.jpg"
              alt="Direct Factory Products"
              sizes="90px"
              ratio="1 / 1"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* WIDGET 2: Today's Deal Card (Blue Theme & Clean Deal Tag) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-card space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <HiClock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Today&apos;s Deal</h3>
          </div>
          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/70 px-2 py-0.5 rounded-full uppercase tracking-wide">
            {activeDeal.discountPercent ? `Up to ${activeDeal.discountPercent}% OFF` : 'Special Deal'}
          </span>
        </div>

        {/* Deal Product Item */}
        <div
          onClick={() => activeDeal.id && navigate(userPath.product(activeDeal.id))}
          className="group flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100"
        >
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-200/60">
            <SmartImage
              src={activeDeal.image}
              alt={activeDeal.name}
              sizes="60px"
              ratio="1 / 1"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                {activeDeal.name}
              </h4>
              <HiChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-sm font-bold text-slate-900">
                {formatPrice(activeDeal.salePrice ?? activeDeal.price)}
              </span>
              {activeDeal.salePrice && activeDeal.salePrice < activeDeal.price && (
                <span className="text-xs text-slate-400 line-through font-normal">
                  {formatPrice(activeDeal.price)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Instant Add to Cart Button (Blue theme) */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAdding}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center space-x-2 active:scale-98 ${
            justAdded
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25'
          }`}
        >
          {justAdded ? (
            <>
              <HiCheck className="w-4 h-4" />
              <span>Added to Cart!</span>
            </>
          ) : isAdding ? (
            <span>Adding...</span>
          ) : (
            <>
              <HiOutlineShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>

      {/* WIDGET 3: Trust & Assurance Guarantees */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-card space-y-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
            <HiShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Verified Quality</h4>
            <p className="text-[11px] text-slate-500">100% genuine with GST tax invoice.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
            <HiCheckBadge className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Direct Factory Tier</h4>
            <p className="text-[11px] text-slate-500">Zero middlemen wholesale prices.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shrink-0">
            <HiSparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Escrow Protected</h4>
            <p className="text-[11px] text-slate-500">Safe payments &amp; 7-day replacement.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600 shrink-0">
            <HiTruck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Express Logistics</h4>
            <p className="text-[11px] text-slate-500">24–48h dispatch across India.</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
