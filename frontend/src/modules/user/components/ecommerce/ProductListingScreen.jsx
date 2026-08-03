import React, { useState } from 'react'
import { HiArrowLeft, HiSquares2X2, HiAdjustmentsHorizontal, HiStar, HiHeart, HiOutlineHeart } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function ProductListingScreen({ onBack = () => {}, onSelectProduct = () => {} }) {
  const [wishlist, setWishlist] = useState({})

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
      name: 'OnePlus 11R 5G',
      subtitle: '(Sonic Black, 256GB)',
      rating: 4.6,
      reviews: '3,890',
      price: 39999,
      originalPrice: 44999,
      discount: '11% OFF',
      image: '/images/iphone_14.png',
    },
    {
      id: 3,
      name: 'iPhone 14',
      subtitle: '(Blue, 128GB)',
      rating: 4.7,
      reviews: '5,120',
      price: 59999,
      originalPrice: 69999,
      discount: '14% OFF',
      image: '/images/iphone_14.png',
    },
    {
      id: 4,
      name: 'Xiaomi 13 Pro',
      subtitle: '(Ceramic Black, 256GB)',
      rating: 4.4,
      reviews: '890',
      price: 79999,
      originalPrice: 89999,
      discount: '11% OFF',
      image: '/images/samsung_s23.png',
    },
  ]

  const toggleWishlist = (id, e) => {
    e.stopPropagation()
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex-1 pb-20 md:pb-12 max-w-5xl mx-auto w-full md:px-6 md:py-6">
        <div className="md:hidden">
          
        </div>

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Smartphones</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiSquares2X2 className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiAdjustmentsHorizontal className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>1,200+ Results</span>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-blue-600">
            <span>Sort: Relevance ▾</span>
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {products.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectProduct(item)}
              className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative group"
            >
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
                <img src={item.image} alt={item.name} className="max-h-full object-contain group-hover:scale-105 transition-transform" />
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 truncate leading-snug">{item.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium truncate">{item.subtitle}</p>

                <div className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 mt-1">
                  <HiStar className="w-3 h-3 fill-current text-amber-500" />
                  <span>{item.rating}</span>
                  <span className="text-slate-400 font-normal">({item.reviews})</span>
                </div>

                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-xs font-black text-slate-900">₹{item.price.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                    {item.discount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
