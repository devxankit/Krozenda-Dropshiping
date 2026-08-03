import React, { useState } from 'react'
import { HiArrowLeft, HiHeart, HiOutlineShoppingBag } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { USER_ROUTES } from '../../../../config/routes'

export function Screen28Wishlist({
  onBack = () => {},
}) {
  const navigate = useNavigate()
  const [wishlistItems, setWishlistItems] = useState([
    {
      id: 1,
      name: 'iPhone 14 128GB',
      subtitle: 'Blue',
      price: 59999,
      stock: 'In Stock',
      stockColor: 'text-emerald-600',
      image: '/images/iphone_14.png',
    },
    {
      id: 2,
      name: 'boAt Airdopes 141',
      subtitle: 'Wireless Earbuds',
      price: 1299,
      stock: 'In Stock',
      stockColor: 'text-emerald-600',
      image: '/images/boat_airdopes.png',
    },
    {
      id: 3,
      name: 'Fossil Chronograph',
      subtitle: "Men's Watch",
      price: 6495,
      stock: 'In Stock',
      stockColor: 'text-emerald-600',
      image: '/images/samsung_s23.png',
    },
    {
      id: 4,
      name: 'Nike Air Max Alpha',
      subtitle: "Men's Shoes",
      price: 5999,
      stock: 'Only 2 left',
      stockColor: 'text-amber-600',
      image: '/images/boat_airdopes.png',
    },
  ])

  const removeFromWishlist = (id) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        {/* MOBILE STATUS BAR */}
        <div className="md:hidden">
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>
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
            <h2 className="text-base font-bold text-slate-900">
              Wishlist ({wishlistItems.length})
            </h2>
          </div>
          <button className="text-xs font-bold text-blue-600 hover:underline">
            Edit
          </button>
        </div>

        {/* Wishlist Items List */}
        <div className="p-4 space-y-3">
          {wishlistItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-16 h-16 bg-slate-50 rounded-xl p-1 shrink-0 flex items-center justify-center border border-slate-100 relative">
                  <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between pr-2">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <button
                      onClick={() => removeFromWishlist(item.id)}
                      className="p-1 text-red-500 hover:text-red-600 transition-colors"
                    >
                      <HiHeart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{item.subtitle}</p>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block">
                    ₹{item.price.toLocaleString('en-IN')}
                  </span>
                  <span className={`text-[10px] font-bold ${item.stockColor}`}>
                    {item.stock}
                  </span>
                </div>
              </div>

              {/* Add to Cart Action */}
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
                className="ml-2 px-3 py-2 bg-white hover:bg-slate-50 text-blue-600 font-bold border border-blue-600 rounded-xl text-xs flex items-center space-x-1 shrink-0 transition-colors"
              >
                <HiOutlineShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Add to Cart</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="wishlist" />
      </div>
    </div>
  )
}
