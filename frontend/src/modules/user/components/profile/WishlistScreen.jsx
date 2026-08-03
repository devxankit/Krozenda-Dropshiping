import React, { useState } from 'react'
import { HiArrowLeft, HiHeart, HiOutlineShoppingBag, HiTrash } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'

export function WishlistScreen({ onBack = () => {} }) {
  const navigate = useNavigate()
  const [wishlistItems, setWishlistItems] = useState([
    { id: 1, name: 'iPhone 14 128GB', subtitle: 'Blue', price: 59999, stock: 'In Stock', stockColor: 'text-emerald-600', image: '/images/iphone_14.png' },
    { id: 2, name: 'boAt Airdopes 141', subtitle: 'Wireless Earbuds', price: 1299, stock: 'In Stock', stockColor: 'text-emerald-600', image: '/images/boat_airdopes.png' },
    { id: 3, name: 'Samsung Galaxy S23 5G', subtitle: 'Phantom Black', price: 49999, stock: 'In Stock', stockColor: 'text-emerald-600', image: '/images/samsung_s23.png' },
    { id: 4, name: 'Portronics Power Bank', subtitle: '10000mAh', price: 1199, stock: 'Only 2 left', stockColor: 'text-amber-600', image: '/images/iphone_14.png' },
  ])

  const removeFromWishlist = (id) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== id))
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
              <h1 className="text-xl md:text-2xl font-black text-slate-900">My Wishlist ({wishlistItems.length})</h1>
              <p className="text-xs text-slate-500 mt-0.5">Saved items you love for future wholesale order purchases.</p>
            </div>
          </div>

          {wishlistItems.length > 0 && (
            <button
              onClick={() => setWishlistItems([])}
              className="text-xs font-bold text-red-600 hover:underline flex items-center space-x-1"
            >
              <HiTrash className="w-4 h-4" />
              <span>Clear Wishlist</span>
            </button>
          )}
        </div>

        {wishlistItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
              ❤️
            </div>
            <h3 className="text-lg font-bold text-slate-900">Your wishlist is currently empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Save your favorite wholesale products by tapping the heart icon on product pages.
            </p>
            <button
              onClick={() => navigate(USER_ROUTES.DASHBOARD)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md transition-all"
            >
              Explore Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <button
                  onClick={() => removeFromWishlist(item.id)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-slate-200 text-red-500 hover:bg-red-50 flex items-center justify-center shadow-xs transition-colors z-10"
                >
                  <HiHeart className="w-4 h-4 fill-red-500" />
                </button>

                <div className="space-y-3 cursor-pointer" onClick={() => navigate(USER_ROUTES.ROOT + '/product')}>
                  <div className="w-full h-44 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{item.subtitle}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-base font-black text-slate-900">₹{item.price.toLocaleString('en-IN')}</span>
                      <span className={`text-[11px] font-extrabold ${item.stockColor}`}>{item.stock}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <HiOutlineShoppingBag className="w-4 h-4" />
                  <span>Move to Cart</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
