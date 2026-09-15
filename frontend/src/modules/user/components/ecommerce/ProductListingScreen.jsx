import React, { useMemo, useState } from 'react'
import {
  HiArrowLeft,
  HiSquares2X2,
  HiListBullet,
  HiStar,
  HiHeart,
  HiOutlineHeart,
  HiMagnifyingGlass,
  HiCheck,
  HiXMark,
  HiFunnel,
  HiBuildingStorefront,
} from 'react-icons/hi2'
import { useLocation, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useProductsController, useCategoriesController, useBrandsController } from '../../controllers/useProductsController'

const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
  { label: 'All Ratings', value: 0 },
]

export function ProductListingScreen({ onBack, onSelectProduct }) {
  const navigate = useNavigate()
  const location = useLocation()

  const initialCategoryId = location.state?.categoryId || null
  const initialCategoryName = location.state?.category || 'All Categories'
  const initialBrandId = location.state?.brandId || null
  // HomeScreen's "View All" links on the Flash Sale / Trending rails.
  const quickFilter = location.state?.filter || null

  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId)
  const wishlistItems = useWishlistStore((state) => state.items)
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const [isGridView, setIsGridView] = useState(true)
  const [brandSearch, setBrandSearch] = useState('')
  const [selectedBrandIds, setSelectedBrandIds] = useState(initialBrandId ? [initialBrandId] : [])
  const [priceRange, setPriceRange] = useState(200000)
  const [minRating, setMinRating] = useState(0)
  const [sortBy, setSortBy] = useState('relevance')
  const [showMobileFilterModal, setShowMobileFilterModal] = useState(false)

  const { categories } = useCategoriesController()
  const { brands } = useBrandsController()
  const { products, isLoading } = useProductsController({ limit: 100 })

  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const quickFilterLabel = quickFilter === 'flash_sale' ? 'Flash Sale' : quickFilter === 'trending' ? 'Trending' : null
  const activeCategoryName =
    activeCategory?.name || (activeCategoryId ? initialCategoryName : quickFilterLabel || 'All Categories')

  const toggleWishlist = (item, e) => {
    e.stopPropagation()
    toggleWishlistItem(item)
  }

  const isWishlisted = (id) => wishlistItems.some((entry) => entry.id === id)

  const toggleBrand = (brandId) => {
    setSelectedBrandIds((prev) => (prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId]))
  }

  const resetFilters = () => {
    setActiveCategoryId(null)
    setSelectedBrandIds([])
    setPriceRange(200000)
    setMinRating(0)
  }

  const handleProductClick = (item) => {
    if (onSelectProduct) {
      onSelectProduct(item)
    } else {
      navigate(USER_ROUTES.ROOT + '/product', { state: { productId: item.id } })
    }
  }

  const handleBackClick = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(USER_ROUTES.DASHBOARD)
    }
  }

  const filteredBrands = brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()))

  const displayedProducts = useMemo(() => {
    let list = products.filter((p) => {
      const matchesCategory = !activeCategoryId || p.category?.id === activeCategoryId
      const matchesBrand = selectedBrandIds.length === 0 || (p.brand && selectedBrandIds.includes(p.brand.id))
      const price = p.salePrice ?? p.price
      const matchesPrice = price <= priceRange
      const matchesRating = p.rating >= minRating
      const matchesQuickFilter =
        !quickFilter || (quickFilter === 'flash_sale' ? p.isFlashsale : quickFilter === 'trending' ? p.isTrending : true)
      return matchesCategory && matchesBrand && matchesPrice && matchesRating && matchesQuickFilter
    })

    if (sortBy === 'low-high') {
      list = [...list].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price))
    } else if (sortBy === 'high-low') {
      list = [...list].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price))
    }

    return list
  }, [products, activeCategoryId, selectedBrandIds, priceRange, minRating, sortBy, quickFilter])

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Breadcrumb & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBackClick}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200/60"
            >
              <HiArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-400">
                <span>Home</span>
                <span>/</span>
                <span>Categories</span>
                <span>/</span>
                <span className="text-blue-600 font-bold">{activeCategoryName}</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 capitalize">
                {activeCategoryName} Catalog
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
              <HiBuildingStorefront className="w-4 h-4" />
              <span>Factory Direct Pricing</span>
            </span>

            <button
              onClick={() => setShowMobileFilterModal(true)}
              className="lg:hidden px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm"
            >
              <HiFunnel className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ================= LEFT SIDEBAR FILTER PANEL (DESKTOP) ================= */}
          <aside className="hidden lg:block w-64 lg:w-72 shrink-0 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-6 sticky top-24">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <HiFunnel className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Filter Products</h3>
                </div>
                <button onClick={resetFilters} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  Reset All
                </button>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">Categories</h4>
                <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-none pr-1">
                  <button
                    onClick={() => setActiveCategoryId(null)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                      !activeCategoryId ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>All Categories</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                        activeCategoryId === cat.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          activeCategoryId === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {cat.productCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Brands</h4>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <HiMagnifyingGlass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search brands..."
                    className="w-full px-2 bg-transparent text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-none pr-1">
                  {filteredBrands.map((brand) => {
                    const isChecked = selectedBrandIds.includes(brand.id)
                    return (
                      <label
                        key={brand.id}
                        onClick={() => toggleBrand(brand.id)}
                        className="flex items-center space-x-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none py-0.5 hover:text-slate-900"
                      >
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white hover:border-slate-400'
                          }`}
                        >
                          {isChecked && <HiCheck className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{brand.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="uppercase tracking-wider text-slate-400">Max Price</span>
                  <span className="text-blue-600 font-extrabold">₹{priceRange.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="200000"
                  step="500"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Min Rating</h4>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMinRating(option.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        minRating === option.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ================= RIGHT SIDE PRODUCTS SECTION ================= */}
          <section className="flex-1 min-w-0 space-y-4">
            <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <span className="text-slate-900 font-extrabold">{displayedProducts.length} Items</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium hidden sm:inline">Showing curated dropship inventory</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
                  <span className="text-slate-400 font-medium hidden sm:inline">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="low-high">Price: Low to High</option>
                    <option value="high-low">Price: High to Low</option>
                  </select>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setIsGridView(true)}
                    className={`p-1.5 rounded-lg transition-colors ${isGridView ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}`}
                    title="Grid View"
                  >
                    <HiSquares2X2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsGridView(false)}
                    className={`p-1.5 rounded-lg transition-colors ${!isGridView ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}`}
                    title="List View"
                  >
                    <HiListBullet className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {selectedBrandIds.length > 0 && (
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">Active:</span>
                {selectedBrandIds.map((brandId) => {
                  const brand = brands.find((b) => b.id === brandId)
                  if (!brand) return null
                  return (
                    <span
                      key={brandId}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shrink-0"
                    >
                      <span>{brand.name}</span>
                      <button onClick={() => toggleBrand(brandId)} className="hover:text-red-500">
                        <HiXMark className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-3 animate-pulse">
                    <div className="w-full aspect-[4/3] bg-slate-200 rounded-xl" />
                    <div className="h-3 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center">
                <p className="text-sm font-bold text-slate-700">No products match your filters</p>
                <p className="text-xs text-slate-500 mt-1">Try widening your price range or clearing a filter.</p>
                <button onClick={resetFilters} className="mt-4 text-xs font-bold text-blue-600 hover:underline">
                  Reset filters
                </button>
              </div>
            ) : isGridView ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedProducts.map((item) => {
                  const displayPrice = item.salePrice ?? item.price
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleProductClick(item)}
                      className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-xl hover:border-blue-400 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-3 relative"
                    >
                      <div className="w-full aspect-[4/3] bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100 relative group-hover:bg-blue-50/20 transition-colors">
                        {item.discountPercent > 0 && (
                          <span className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-xs">
                            {item.discountPercent}% OFF
                          </span>
                        )}

                        <button
                          onClick={(e) => toggleWishlist({ id: item.id, name: item.name, subtitle: item.brand?.name || '', image: item.images[0], price: displayPrice }, e)}
                          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors"
                        >
                          {isWishlisted(item.id) ? (
                            <HiHeart className="w-4 h-4 text-red-500 fill-red-500" />
                          ) : (
                            <HiOutlineHeart className="w-4 h-4" />
                          )}
                        </button>

                        <img
                          src={item.images[0] || '/images/placeholder.png'}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-108 transition-transform duration-500"
                        />
                      </div>

                      <div className="space-y-1.5 min-w-0 text-left">
                        {item.brand && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md inline-block">
                            {item.brand.name}
                          </span>
                        )}

                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {item.name}
                        </h3>

                        {item.reviewsCount > 0 && (
                          <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold pt-0.5">
                            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                            <span className="text-slate-900">{item.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({item.reviewsCount})</span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-slate-100 flex items-baseline justify-between">
                          <div>
                            <div className="text-sm font-black text-slate-900">₹{displayPrice.toLocaleString('en-IN')}</div>
                            {item.salePrice != null && item.salePrice < item.price && (
                              <div className="text-[11px] text-slate-400 line-through">₹{item.price.toLocaleString('en-IN')}</div>
                            )}
                          </div>

                          <button className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs">
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedProducts.map((item) => {
                  const displayPrice = item.salePrice ?? item.price
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleProductClick(item)}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="w-28 h-28 bg-slate-50 rounded-xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                          <img src={item.images[0] || '/images/placeholder.png'} alt={item.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1 text-left">
                          <div className="flex items-center space-x-2">
                            {item.brand && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">{item.brand.name}</span>
                            )}
                            {item.reviewsCount > 0 && (
                              <span className="text-xs text-amber-500 font-bold flex items-center space-x-1">
                                <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                                <span>{item.rating.toFixed(1)} ({item.reviewsCount})</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{item.name}</h3>

                          <div className="flex items-baseline space-x-2 pt-1">
                            <span className="text-base font-black text-slate-900">₹{displayPrice.toLocaleString('en-IN')}</span>
                            {item.salePrice != null && item.salePrice < item.price && (
                              <>
                                <span className="text-xs text-slate-400 line-through">₹{item.price.toLocaleString('en-IN')}</span>
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{item.discountPercent}% OFF</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleWishlist({ id: item.id, name: item.name, subtitle: item.brand?.name || '', image: item.images[0], price: displayPrice }, e)}
                        className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors shrink-0"
                      >
                        {isWishlisted(item.id) ? <HiHeart className="w-5 h-5 text-red-500 fill-red-500" /> : <HiOutlineHeart className="w-5 h-5" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Mobile Filter Modal Drawer */}
      {showMobileFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end lg:hidden">
          <div className="w-full max-w-xs bg-white h-full p-5 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Filter Products</h3>
              <button onClick={() => setShowMobileFilterModal(false)} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-400">Categories</h4>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setActiveCategoryId(null)
                    setShowMobileFilterModal(false)
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-left ${!activeCategoryId ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategoryId(cat.id)
                      setShowMobileFilterModal(false)
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-left ${activeCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setShowMobileFilterModal(false)} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs">
              Apply & Close
            </button>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
