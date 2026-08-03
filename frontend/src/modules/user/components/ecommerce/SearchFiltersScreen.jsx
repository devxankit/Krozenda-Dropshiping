import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiMagnifyingGlass,
  HiAdjustmentsHorizontal,
  HiStar,
  HiHeart,
  HiOutlineHeart,
  HiOutlineShoppingBag,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'

export function SearchFiltersScreen({
  onBack = () => {},
  onOpenFilters = () => {},
  onSelectProduct = () => {},
}) {
  const navigate = useNavigate()
  const [wishlist, setWishlist] = useState({})

  const searchResults = [
    {
      id: 1,
      name: 'Nike Air Max Alpha 5',
      subtitle: 'Men Running Shoes',
      price: 5999,
      originalPrice: 8999,
      discount: '33% OFF',
      rating: 4.6,
      reviews: '2,410',
      image: '/images/boat_airdopes.png',
    },
    {
      id: 2,
      name: 'Adidas Ultraboost Light',
      subtitle: 'Running Shoes for Men',
      price: 11999,
      originalPrice: 15999,
      discount: '25% OFF',
      rating: 4.8,
      reviews: '1,890',
      image: '/images/samsung_s23.png',
    },
    {
      id: 3,
      name: 'Puma X-Cell Lightspeed',
      subtitle: 'Sports Training Shoes',
      price: 3499,
      originalPrice: 6999,
      discount: '50% OFF',
      rating: 4.3,
      reviews: '950',
      image: '/images/iphone_14.png',
    },
    {
      id: 4,
      name: 'Reebok Nano X3',
      subtitle: 'Fitness & Gym Shoes',
      price: 7999,
      originalPrice: 9999,
      discount: '20% OFF',
      rating: 4.5,
      reviews: '640',
      image: '/images/boat_airdopes.png',
    },
  ]

  const toggleWishlist = (id, e) => {
    e.stopPropagation()
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-5xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3 flex-1 mr-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="w-full px-2 text-xs font-bold text-slate-900">
                Shoes
              </span>
            </div>
          </div>

          {/* Filter Action Button */}
          <button
            onClick={onOpenFilters}
            className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0 transition-colors"
          >
            <HiAdjustmentsHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Search Results Summary Row */}
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>1,200+ Results for "Shoes"</span>
          <span className="text-slate-800 font-bold cursor-pointer">Sort: Popularity ▾</span>
        </div>

        {/* Grid Results */}
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {searchResults.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectProduct(item)}
              className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative group"
            >
              {/* Wishlist Button */}
              <button
                onClick={(e) => toggleWishlist(item.id, e)}
                className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-400 hover:text-red-500 shadow-xs transition-colors"
              >
                {wishlist[item.id] ? (
                  <HiHeart className="w-4 h-4 text-red-500 fill-current" />
                ) : (
                  <HiOutlineHeart className="w-4 h-4" />
                )}
              </button>

              <div className="w-full h-36 bg-slate-50 rounded-xl p-2 flex items-center justify-center mb-2 border border-slate-100">
                <img
                  src={item.image}
                  alt={item.name}
                  className="max-h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 truncate leading-snug">
                  {item.name}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium truncate">{item.subtitle}</p>

                <div className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 mt-1">
                  <HiStar className="w-3 h-3 fill-current text-amber-500" />
                  <span>{item.rating}</span>
                  <span className="text-slate-400 font-normal">({item.reviews})</span>
                </div>

                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-xs font-black text-slate-900">
                    ₹{item.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                    {item.discount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="home" />
      </div>
    </div>
  )
}
