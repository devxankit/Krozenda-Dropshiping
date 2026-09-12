import React, { useState, useEffect } from 'react'
import {
  HiArrowLeft,
  HiMagnifyingGlass,
  HiAdjustmentsHorizontal,
  HiStar,
  HiHeart,
  HiOutlineHeart,
  HiSquares2X2,
  HiListBullet,
  HiXMark,
} from 'react-icons/hi2'
import { useNavigate, useLocation } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'
import { useWishlistStore } from '../../../../lib/wishlistStore'

export function SearchFiltersScreen({
  onBack = () => {},
  onOpenFilters = () => {},
  onSelectProduct = () => {},
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState(location.state?.query || 'Shoes')
  const [activeQuickFilter, setActiveQuickFilter] = useState('All')
  const [isGridView, setIsGridView] = useState(true)
  const wishlistItems = useWishlistStore((state) => state.items)
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)

  useEffect(() => {
    if (location.state?.query) {
      setSearchQuery(location.state.query)
    }
  }, [location.state?.query])

  const quickFilters = ['All', 'Nike', 'Adidas', 'Puma', 'Under ₹5,000', '4★ & above']

  const allProducts = [
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
      brand: 'Nike',
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
      brand: 'Adidas',
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
      brand: 'Puma',
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
      brand: 'Reebok',
    },
  ]

  const searchResults = allProducts.filter((item) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q)
    if (activeQuickFilter === 'All') return matchesSearch || searchQuery.length > 0
    if (activeQuickFilter === 'Under ₹5,000') return item.price < 5000
    if (activeQuickFilter === '4★ & above') return item.rating >= 4.0
    return item.brand.toLowerCase().includes(activeQuickFilter.toLowerCase())
  })

  const toggleWishlist = (item, e) => {
    e.stopPropagation()
    toggleWishlistItem(item)
  }

  const isWishlisted = (id) => wishlistItems.some((entry) => entry.id === id)

  const handleOpenFilters = () => {
    if (onOpenFilters) {
      onOpenFilters()
    } else {
      navigate(USER_ROUTES.ROOT + '/filters')
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-4">
        {/* Main Search & Filter Control Bar */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 shrink-0">
              <HiArrowLeft className="w-5 h-5" />
            </button>

            {/* Editable Search Input Box */}
            <div className="flex-1 flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 focus-within:ring-2 focus-within:ring-blue-600 focus-within:bg-white transition-all">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-2 bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Switcher */}
            <button
              onClick={() => setIsGridView(!isGridView)}
              className={`p-2 rounded-xl border transition-colors ${
                !isGridView ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isGridView ? 'List View' : 'Grid View'}
            >
              {isGridView ? <HiSquares2X2 className="w-4 h-4" /> : <HiListBullet className="w-4 h-4" />}
            </button>

            {/* Dedicated Filter Button */}
            <button
              onClick={handleOpenFilters}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <HiAdjustmentsHorizontal className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Pill Chips Row */}
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1">
          {quickFilters.map((filter) => {
            const isActive = activeQuickFilter === filter
            return (
              <button
                key={filter}
                onClick={() => setActiveQuickFilter(filter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                {filter}
              </button>
            )
          })}
        </div>

        {/* Search Results Summary Row */}
        <div className="px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-semibold shadow-xs">
          <span>Showing {searchResults.length} Results for "{searchQuery || 'All Products'}"</span>
          <div className="flex items-center space-x-1 cursor-pointer hover:text-blue-600">
            <span>Sort: Popularity ▾</span>
          </div>
        </div>

        {/* Search Results Products Grid / List View */}
        {searchResults.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <HiMagnifyingGlass className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No products found matching "{searchQuery}"</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try searching with different keywords like "Shoes", "Samsung", "boAt", or "iPhone".
            </p>
          </div>
        ) : isGridView ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectProduct(item)}
                className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-2 relative"
              >
                <div className="w-full aspect-square bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-center overflow-hidden border border-slate-100/80 relative">
                  <button
                    onClick={(e) => toggleWishlist(item, e)}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                  >
                    {isWishlisted(item.id) ? (
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
          <div className="space-y-3 pt-2">
            {searchResults.map((item) => (
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
                  onClick={(e) => toggleWishlist(item, e)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors shrink-0"
                >
                  {isWishlisted(item.id) ? (
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
