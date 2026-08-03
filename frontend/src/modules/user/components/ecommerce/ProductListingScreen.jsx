import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiSquares2X2,
  HiListBullet,
  HiAdjustmentsHorizontal,
  HiStar,
  HiHeart,
  HiOutlineHeart,
} from 'react-icons/hi2'
import { useLocation, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'

export function ProductListingScreen({ onBack = () => {}, onSelectProduct = () => {} }) {
  const navigate = useNavigate()
  const location = useLocation()
  const categoryTitle = location.state?.category
    ? location.state.category
    : 'Smartphones'

  const [wishlist, setWishlist] = useState({})
  const [isGridView, setIsGridView] = useState(true)

  const products = [
    {
      id: 1,
      name: 'Samsung Galaxy S23 5G',
      subtitle: '(Phantom Black, 128GB)',
      rating: 4.5,
      reviews: '1,245',
      price: 49999,
      originalPrice: 74999,
      discount: '33% OFF',
      image: '/images/samsung_s23.png',
    },
    {
      id: 2,
      name: 'boAt Airdopes 141 Wireless Earbuds',
      subtitle: '(Active Noise Cancellation)',
      rating: 4.6,
      reviews: '3,890',
      price: 1299,
      originalPrice: 4490,
      discount: '71% OFF',
      image: '/images/boat_airdopes.png',
    },
    {
      id: 3,
      name: 'Apple iPhone 14 128GB',
      subtitle: '(Blue, 128GB)',
      rating: 4.7,
      reviews: '5,120',
      price: 59999,
      originalPrice: 69900,
      discount: '14% OFF',
      image: '/images/iphone_14.png',
    },
    {
      id: 4,
      name: 'Portronics Power Bank 10000mAh',
      subtitle: '(Fast Charging 22.5W)',
      rating: 4.4,
      reviews: '890',
      price: 1199,
      originalPrice: 2499,
      discount: '52% OFF',
      image: '/images/boat_airdopes.png',
    },
  ]

  const toggleWishlist = (id, e) => {
    e.stopPropagation()
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleOpenFilters = () => {
    navigate(USER_ROUTES.ROOT + '/filters')
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-4">
        {/* Compact Original Header Bar */}
        <div className="px-4 py-3 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900 capitalize">{categoryTitle}</h2>
          </div>
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle Button */}
            <button
              onClick={() => setIsGridView(!isGridView)}
              className={`p-1.5 rounded-full transition-colors ${
                !isGridView ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title={isGridView ? 'Switch to List View' : 'Switch to Grid View'}
            >
              {isGridView ? <HiSquares2X2 className="w-5 h-5" /> : <HiListBullet className="w-5 h-5" />}
            </button>

            {/* Filter Page Navigation Button */}
            <button
              onClick={handleOpenFilters}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              title="Open Filters"
            >
              <HiAdjustmentsHorizontal className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </div>

        {/* Secondary Sub-Bar */}
        <div className="px-4 py-2 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-semibold shadow-xs">
          <span>1,200+ Results</span>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-blue-600">
            <span>Sort: Relevance ▾</span>
          </div>
        </div>

        {/* Product Cards Container (Grid View vs List View Toggle) */}
        {isGridView ? (
          /* Grid View Mode */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
            {products.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectProduct(item)}
                className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
              >
                <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                  <button
                    onClick={(e) => toggleWishlist(item.id, e)}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                  >
                    {wishlist[item.id] ? (
                      <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                    ) : (
                      <HiOutlineHeart className="w-4 h-4" />
                    )}
                  </button>

                  <img
                    src={item.image}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                    {item.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                  <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold pt-0.5">
                    <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                    <span className="text-slate-900">{item.rating}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({item.reviews})</span>
                  </div>

                  <div className="pt-1 space-y-0.5">
                    <div className="text-xs sm:text-sm font-black text-slate-900">
                      ₹{item.price.toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <span className="text-slate-400 line-through">
                        ₹{item.originalPrice.toLocaleString('en-IN')}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {item.discount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View Mode */
          <div className="space-y-3 pt-2">
            {products.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectProduct(item)}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-50 rounded-xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-bold">
                      <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                      <span className="text-slate-900">{item.rating}</span>
                      <span className="text-[10px] text-slate-400">({item.reviews} reviews)</span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium truncate">{item.subtitle}</p>

                    <div className="flex items-baseline space-x-2 pt-1">
                      <span className="text-base font-black text-slate-900">
                        ₹{item.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        ₹{item.originalPrice.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {item.discount}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => toggleWishlist(item.id, e)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors shrink-0"
                >
                  {wishlist[item.id] ? (
                    <HiHeart className="w-5 h-5 text-red-500 fill-red-500" />
                  ) : (
                    <HiOutlineHeart className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
