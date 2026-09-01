import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiSquares2X2,
  HiListBullet,
  HiAdjustmentsHorizontal,
  HiStar,
  HiHeart,
  HiOutlineHeart,
  HiMagnifyingGlass,
  HiCheck,
  HiXMark,
  HiChevronRight,
  HiFunnel,
  HiBuildingStorefront,
} from 'react-icons/hi2'
import { useLocation, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'

export function ProductListingScreen({ onBack, onSelectProduct }) {
  const navigate = useNavigate()
  const location = useLocation()
  
  const initialCategory = location.state?.category || 'Mobiles & Tablets'

  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [wishlist, setWishlist] = useState({})
  const [isGridView, setIsGridView] = useState(true)
  const [brandSearch, setBrandSearch] = useState('')
  const [selectedBrands, setSelectedBrands] = useState(['Samsung', 'Apple', 'boAt'])
  const [priceRange, setPriceRange] = useState(100000)
  const [selectedRating, setSelectedRating] = useState('4★ & above')
  const [sortBy, setSortBy] = useState('relevance')
  const [showMobileFilterModal, setShowMobileFilterModal] = useState(false)

  const categories = [
    { name: 'Mobiles & Tablets', count: '1,250' },
    { name: 'Laptops & Workstations', count: '820' },
    { name: 'Smartwatches', count: '1,120' },
    { name: 'Audio & Headphones', count: '2,350' },
    { name: 'Fashion & Apparel', count: '3,400' },
    { name: 'Shoes & Footwear', count: '1,890' },
    { name: 'Home Appliances', count: '1,250' },
    { name: 'Beauty & Skincare', count: '1,560' },
    { name: 'Gaming Consoles', count: '940' },
    { name: 'Smart Gadgets', count: '1,680' },
    { name: 'Home & Kitchen', count: '2,100' },
  ]

  const brandsList = ['Samsung', 'Apple', 'boAt', 'OnePlus', 'Xiaomi', 'Nike', 'Sony', 'Dyson']

  const allProducts = [
    {
      id: 1,
      category: 'Mobiles & Tablets',
      name: 'Samsung Galaxy S23 5G',
      subtitle: '(Phantom Black, 128GB)',
      rating: 4.5,
      reviews: '1,245',
      price: 49999,
      originalPrice: 74999,
      discount: '33% OFF',
      image: '/images/samsung_s23.png',
      margin: '₹8,500 Profit / Unit',
      brand: 'Samsung',
    },
    {
      id: 2,
      category: 'Audio & Headphones',
      name: 'boAt Airdopes 141 Wireless Earbuds',
      subtitle: '(Active Noise Cancellation)',
      rating: 4.6,
      reviews: '3,890',
      price: 1299,
      originalPrice: 4490,
      discount: '71% OFF',
      image: '/images/boat_airdopes.png',
      margin: '₹650 Profit / Unit',
      brand: 'boAt',
    },
    {
      id: 3,
      category: 'Mobiles & Tablets',
      name: 'Apple iPhone 14 128GB',
      subtitle: '(Blue, 128GB)',
      rating: 4.7,
      reviews: '5,120',
      price: 59999,
      originalPrice: 69900,
      discount: '14% OFF',
      image: '/images/iphone_14.png',
      margin: '₹9,200 Profit / Unit',
      brand: 'Apple',
    },
    {
      id: 4,
      category: 'Laptops & Workstations',
      name: 'MacBook Air M2 (8GB / 256GB SSD)',
      subtitle: '(Starlight Gray • Retina Display)',
      rating: 4.8,
      reviews: '2,140',
      price: 92990,
      originalPrice: 114900,
      discount: '19% OFF',
      image: '/images/cat_laptops_new.jpg',
      margin: '₹14,500 Profit / Unit',
      brand: 'Apple',
    },
    {
      id: 5,
      category: 'Smartwatches',
      name: 'Apple Watch Series 9 GPS 45mm',
      subtitle: '(Midnight Aluminum • Sport Band)',
      rating: 4.7,
      reviews: '1,820',
      price: 39999,
      originalPrice: 44900,
      discount: '11% OFF',
      image: '/images/cat_watches_new.jpg',
      margin: '₹4,800 Profit / Unit',
      brand: 'Apple',
    },
    {
      id: 6,
      category: 'Shoes & Footwear',
      name: 'Nike Air Max Flyknit Sneakers',
      subtitle: '(Crimson Red / Black • Unisex)',
      rating: 4.6,
      reviews: '3,410',
      price: 8495,
      originalPrice: 14995,
      discount: '43% OFF',
      image: '/images/cat_shoes.jpg',
      margin: '₹2,200 Profit / Unit',
      brand: 'Nike',
    },
    {
      id: 7,
      category: 'Fashion & Apparel',
      name: 'Casual Men Denim Jacket & Hoodie',
      subtitle: '(Vintage Blue Wash • 100% Cotton)',
      rating: 4.4,
      reviews: '890',
      price: 1999,
      originalPrice: 4999,
      discount: '60% OFF',
      image: '/images/cat_fashion.jpg',
      margin: '₹950 Profit / Unit',
      brand: 'Zara',
    },
    {
      id: 8,
      category: 'Home Appliances',
      name: 'Barista Pro Espresso Coffee Machine',
      subtitle: '(15-Bar Pump • Stainless Steel)',
      rating: 4.5,
      reviews: '640',
      price: 14999,
      originalPrice: 24999,
      discount: '40% OFF',
      image: '/images/cat_appliances.jpg',
      margin: '₹3,500 Profit / Unit',
      brand: 'DeLonghi',
    },
  ]

  const toggleWishlist = (id, e) => {
    e.stopPropagation()
    setWishlist((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const resetFilters = () => {
    setActiveCategory(initialCategory)
    setSelectedBrands(['Samsung', 'Apple', 'boAt'])
    setPriceRange(100000)
    setSelectedRating('4★ & above')
  }

  const handleProductClick = (item) => {
    if (onSelectProduct) {
      onSelectProduct(item)
    } else {
      navigate(USER_ROUTES.ROOT + '/product', { state: { product: item } })
    }
  }

  const handleBackClick = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(USER_ROUTES.DASHBOARD)
    }
  }

  const filteredBrandsList = brandsList.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase())
  )

  // Filter products by selected activeCategory if matched or show catalog
  const displayedProducts = allProducts.filter((p) => {
    const matchesCategory =
      !activeCategory ||
      activeCategory === 'All' ||
      p.category.toLowerCase().includes(activeCategory.toLowerCase()) ||
      activeCategory.toLowerCase().includes(p.category.toLowerCase())
    return matchesCategory
  })

  // Fallback to all products if filter returns empty for demo richness
  const finalProducts = displayedProducts.length > 0 ? displayedProducts : allProducts

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* Desktop Web Header */}
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
                <span className="text-blue-600 font-bold">{activeCategory}</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 capitalize">
                {activeCategory} Catalog
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
              <HiBuildingStorefront className="w-4 h-4" />
              <span>Factory Direct Pricing</span>
            </span>

            {/* Mobile Filter Button */}
            <button
              onClick={() => setShowMobileFilterModal(true)}
              className="lg:hidden px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm"
            >
              <HiFunnel className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Main Layout: Left Sidebar Filters + Right Side Products Grid */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ================= LEFT SIDEBAR FILTER PANEL (DESKTOP) ================= */}
          <aside className="hidden lg:block w-64 lg:w-72 shrink-0 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-6 sticky top-24">
              {/* Filter Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <HiFunnel className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Filter Products
                  </h3>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Reset All
                </button>
              </div>

              {/* 1. Category Filter Section */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
                  Categories
                </h4>
                <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-none pr-1">
                  {categories.map((cat) => {
                    const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase()
                    return (
                      <button
                        key={cat.name}
                        onClick={() => setActiveCategory(cat.name)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Brand Filter Section */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Popular Brands
                </h4>
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
                  {filteredBrandsList.map((brand) => {
                    const isChecked = selectedBrands.includes(brand)
                    return (
                      <label
                        key={brand}
                        onClick={() => toggleBrand(brand)}
                        className="flex items-center space-x-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none py-0.5 hover:text-slate-900"
                      >
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white hover:border-slate-400'
                          }`}
                        >
                          {isChecked && <HiCheck className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{brand}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 3. Price Filter Section */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="uppercase tracking-wider text-slate-400">Max Price</span>
                  <span className="text-blue-600 font-extrabold">₹{priceRange.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="150000"
                  step="1000"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* 4. Customer Rating Section */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Min Rating
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {['4★ & above', '3★ & above', 'All Ratings'].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSelectedRating(rating)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedRating === rating
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ================= RIGHT SIDE PRODUCTS SECTION ================= */}
          <section className="flex-1 min-w-0 space-y-4">
            {/* Top Sub-Bar Controls */}
            <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <span className="text-slate-900 font-extrabold">{finalProducts.length} Items</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium hidden sm:inline">Showing curated dropship inventory</span>
              </div>

              <div className="flex items-center space-x-3">
                {/* Sort Dropdown */}
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
                    <option value="margin">Highest Margin</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setIsGridView(true)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isGridView ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Grid View"
                  >
                    <HiSquares2X2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsGridView(false)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      !isGridView ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="List View"
                  >
                    <HiListBullet className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filters Tag Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Active:</span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shrink-0">
                <span>{activeCategory}</span>
              </span>
              {selectedBrands.map((brand) => (
                <span
                  key={brand}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shrink-0"
                >
                  <span>{brand}</span>
                  <button onClick={() => toggleBrand(brand)} className="hover:text-red-500">
                    <HiXMark className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Product Cards Container (Grid View vs List View) */}
            {isGridView ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {finalProducts.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleProductClick(item)}
                    className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-xl hover:border-blue-400 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-3 relative"
                  >
                    {/* Top Floating Badge & Wishlist Heart */}
                    <div className="w-full aspect-[4/3] bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100 relative group-hover:bg-blue-50/20 transition-colors">
                      <span className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-xs">
                        {item.discount}
                      </span>

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
                        className="max-h-full max-w-full object-contain group-hover:scale-108 transition-transform duration-500"
                      />
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1.5 min-w-0 text-left">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                        {item.margin}
                      </span>

                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium truncate">{item.subtitle}</p>

                      <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold pt-0.5">
                        <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                        <span className="text-slate-900">{item.rating}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({item.reviews})</span>
                      </div>

                      <div className="pt-1 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            ₹{item.price.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-slate-400 line-through">
                            ₹{item.originalPrice.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <button className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View Mode */
              <div className="space-y-3">
                {finalProducts.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleProductClick(item)}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="w-28 h-28 bg-slate-50 rounded-xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1 text-left">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {item.margin}
                          </span>
                          <span className="text-xs text-amber-500 font-bold flex items-center space-x-1">
                            <HiStar className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{item.rating} ({item.reviews})</span>
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
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
                      className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-600 hover:text-red-500 transition-colors shrink-0"
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
          </section>
        </div>
      </main>

      {/* Mobile Filter Modal Drawer */}
      {showMobileFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end lg:hidden">
          <div className="w-full max-w-xs bg-white h-full p-5 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Filter Products</h3>
              <button
                onClick={() => setShowMobileFilterModal(false)}
                className="p-1 rounded-full text-slate-500 hover:bg-slate-100"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-400">Categories</h4>
              <div className="space-y-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => {
                      setActiveCategory(cat.name)
                      setShowMobileFilterModal(false)
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold text-left ${
                      activeCategory.toLowerCase() === cat.name.toLowerCase()
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowMobileFilterModal(false)}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Apply & Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
