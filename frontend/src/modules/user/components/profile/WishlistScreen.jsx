import React from 'react'
import { HiArrowLeft, HiHeart, HiOutlineShoppingBag, HiTrash } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useCartStore } from '../../../../lib/cartStore'

export function WishlistScreen({ onBack = () => {} }) {
  const navigate = useNavigate()
  const wishlistItems = useWishlistStore((state) => state.items)
  const removeFromWishlist = useWishlistStore((state) => state.removeItem)
  const clearWishlist = useWishlistStore((state) => state.clear)
  const addToCart = useCartStore((state) => state.addItem)

  const moveToCart = (item, e) => {
    e.stopPropagation()
    addToCart(item)
    removeFromWishlist(item.id)
    navigate(USER_ROUTES.ROOT + '/cart')
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      {/* Compact Clean Header Bar */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">My Wishlist ({wishlistItems.length})</h1>
        </div>

        {wishlistItems.length > 0 && (
          <button
            onClick={clearWishlist}
            className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors flex items-center space-x-1"
          >
            <HiTrash className="w-4 h-4" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {wishlistItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl">
              <HiHeart className="w-8 h-8 text-red-500 fill-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Your wishlist is currently empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Save your favorite wholesale products by tapping the heart icon on product pages.
            </p>
            <button
              onClick={() => navigate(USER_ROUTES.DASHBOARD)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all"
            >
              Explore Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(USER_ROUTES.ROOT + '/product')}
                className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromWishlist(item.id)
                  }}
                  className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                >
                  <HiHeart className="w-4 h-4 fill-red-500" />
                </button>

                <div className="w-full h-32 sm:h-36 bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-bold block ${item.stockColor || 'text-emerald-600'}`}>
                    {item.stock || 'In Stock'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium truncate">{item.subtitle}</p>

                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      ₹{item.price.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={(e) => moveToCart(item, e)}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                    >
                      <HiOutlineShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
