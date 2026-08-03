import React from 'react'
import { HiMagnifyingGlass, HiOutlineShoppingBag, HiSquares2X2 } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'

export function CategoryListScreen() {
  const navigate = useNavigate()

  const categories = [
    { id: 'mobiles', name: 'Mobiles', image: '/images/samsung_s23.png' },
    { id: 'electronics', name: 'Electronics', image: '/images/boat_airdopes.png' },
    { id: 'fashion', name: 'Fashion', image: '/images/iphone_14.png' },
    { id: 'home', name: 'Home & Kitchen', image: '/images/deals_banner.png' },
    { id: 'beauty', name: 'Beauty', image: '/images/boat_airdopes.png' },
    { id: 'sports', name: 'Sports', image: '/images/samsung_s23.png' },
    { id: 'toys', name: 'Toys & Games', image: '/images/iphone_14.png' },
    { id: 'books', name: 'Books', image: '/images/samsung_s23.png' },
    { id: 'automotive', name: 'Automotive', image: '/images/boat_airdopes.png' },
    { id: 'groceries', name: 'Groceries', image: '/images/iphone_14.png' },
    { id: 'pets', name: 'Pets', image: '/images/samsung_s23.png' },
    { id: 'all', name: 'Browse All', isBrowseAll: true },
  ]

  const handleCategoryClick = (catId) => {
    navigate(USER_ROUTES.ROOT + '/listing', { state: { category: catId } })
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">Categories</h1>
            <p className="text-xs text-slate-500 mt-0.5">Explore wholesale & dropshipping product lines.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/search')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiMagnifyingGlass className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 relative transition-colors"
            >
              <HiOutlineShoppingBag className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                3
              </span>
            </button>
          </div>
        </div>

        {/* Categories Grid (Exact Reference Matching: 3 Cols Mobile, 4 Cols Tablet, 6 Cols Desktop) */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 flex flex-col items-center justify-center space-y-3 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group aspect-square"
            >
              {cat.isBrowseAll ? (
                <div className="w-14 sm:w-16 h-14 sm:h-16 flex items-center justify-center text-slate-800 group-hover:scale-110 transition-transform">
                  <HiSquares2X2 className="w-10 sm:w-12 h-10 sm:h-12" />
                </div>
              ) : (
                <div className="w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center transition-transform group-hover:scale-105">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="max-h-full max-w-full object-contain drop-shadow-sm"
                  />
                </div>
              )}

              <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors text-center truncate w-full">
                {cat.name}
              </h3>
            </div>
          ))}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
