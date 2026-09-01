import React, { useState } from 'react'
import {
  HiMagnifyingGlass,
  HiOutlineShoppingBag,
  HiChevronRight,
  HiSparkles,
  HiCheckBadge,
  HiBuildingStorefront,
  HiArrowRight,
  HiSquares2X2,
  HiListBullet,
  HiArrowLeft,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'

export function CategoryListScreen() {
  const navigate = useNavigate()
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [layoutMode, setLayoutMode] = useState('grid') // 'grid' or 'list'

  const allCategories = [
    {
      id: 'mobiles',
      filterGroup: 'tech',
      name: 'Mobiles & Tablets',
      itemCount: '1,250+ Curated Products',
      image: '/images/cat_mobiles.jpg',
      discount: 'Up to 40% OFF - New Tiers',
      badge: 'BESTSELLER',
      margin: '₹8,500 Margin / Unit',
      subcategories: ['5G Smartphones', 'iPhones & iPads', 'Android Tablets', 'Mobile Accessories'],
    },
    {
      id: 'laptops',
      filterGroup: 'tech',
      name: 'Laptops & Workstat...',
      fullName: 'Laptops & Workstations',
      itemCount: '1,250+ Curated Products',
      image: '/images/cat_laptops_new.jpg',
      discount: 'Up to 40% OFF - New Tiers',
      badge: 'POPULAR',
      margin: '₹12,000 Margin / Unit',
      subcategories: ['Gaming Laptops', 'Ultrabooks', 'MacBooks', 'Monitors & Docks'],
    },
    {
      id: 'watches',
      filterGroup: 'tech',
      name: 'Smartwatches',
      itemCount: '1,120+ Curated Products',
      image: '/images/cat_watches_new.jpg',
      discount: 'Max Savings 60% OFF',
      badge: 'TRENDING',
      margin: '₹1,100 Margin / Unit',
      subcategories: ['AMOLED Smartwatches', 'Fitness Trackers', 'Rugged Watches', 'Strips & Chargers'],
    },
    {
      id: 'audio',
      filterGroup: 'tech',
      name: 'Audio & Headphones',
      itemCount: '2,350+ Curated Products',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      discount: 'Flash Sale: Up to 75% OFF',
      badge: 'HOT',
      margin: 'Wholesale Tier 1',
      subcategories: ['TWS Earbuds', 'ANC Headphones', 'Bluetooth Speakers', 'Neckbands'],
    },
    {
      id: 'fashion',
      filterGroup: 'lifestyle',
      name: 'Fashion & Apparel',
      itemCount: '3,400+ Curated Products',
      image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&auto=format&fit=crop&q=80',
      discount: 'Max Savings 60% OFF',
      badge: 'NEW TIERS',
      margin: 'Fast Moving',
      subcategories: ['Men Jackets', 'Hoodies & Sweatshirts', 'Women Wear', 'Casual Denim'],
    },
    {
      id: 'shoes',
      filterGroup: 'lifestyle',
      name: 'Shoes & Footwear',
      itemCount: '1,890+ Curated Products',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
      discount: 'Max Savings 60% OFF',
      badge: 'TOP SELLER',
      margin: '₹1,200 Margin / Unit',
      subcategories: ['Sports Sneakers', 'Running Shoes', 'Formal Leather', 'Casual Slides'],
    },
    {
      id: 'appliances',
      filterGroup: 'home',
      name: 'Home Appliances',
      itemCount: '1,250+ Curated Products',
      image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
      discount: 'Upto 45% OFF',
      topLeftBadge: 'ESSENTIAL',
      badge: 'ESSENTIAL',
      margin: 'High Value Tier',
      subcategories: ['Coffee Makers', 'Air Fryers', 'Blenders & Grinders', 'Smart Vacuums'],
    },
    {
      id: 'beauty',
      filterGroup: 'lifestyle',
      name: 'Beauty & Skincare',
      itemCount: '1,560+ Curated Products',
      image: 'https://images.unsplash.com/photo-1608248597261-833258657b45?w=600&auto=format&fit=crop&q=80',
      discount: 'Upto 55% OFF',
      topLeftBadge: 'POPULAR',
      badge: 'POPULAR',
      margin: 'High Reorder Rate',
      subcategories: ['Serums & Oils', 'Moisturizers', 'Cleansers', 'Makeup Kits'],
    },
    {
      id: 'gaming',
      filterGroup: 'tech',
      name: 'Gaming Consoles',
      itemCount: '940+ Curated Products',
      image: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=600&auto=format&fit=crop&q=80',
      discount: 'Upto 35% OFF',
      topLeftBadge: 'PRO TECH',
      badge: 'PRO TECH',
      margin: 'Official Supplier',
      subcategories: ['Controllers', 'Gaming Keyboards', 'VR Headsets', 'Console Accessories'],
    },
    {
      id: 'smartgadgets',
      filterGroup: 'tech',
      name: 'Smart Gadgets',
      itemCount: '1,680+ Curated Products',
      image: '/images/cat_watches_new.jpg',
      discount: 'Flash Sale: Up to 75% OFF',
      topLeftBadge: 'POPULAR',
      badge: 'POPULAR',
      margin: 'White-Label Ready',
      subcategories: ['Smart Plugs', 'Security Cameras', 'LED Strip Lights', 'Sensor Hubs'],
    },
    {
      id: 'home',
      filterGroup: 'home',
      name: 'Home & Kitchen',
      itemCount: '2,100+ Curated Products',
      image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80',
      discount: 'Upto 40% OFF',
      topLeftBadge: 'BULK READY',
      badge: 'BULK READY',
      margin: 'Direct Mill Rate',
      subcategories: ['Desk Setup', 'Ergonomic Chairs', 'Ambient Lighting', 'Storage Solutions'],
    },
    {
      id: 'all',
      filterGroup: 'all',
      name: 'Explore All Catalogs...',
      itemCount: '100k+ Catalog',
      image: '/images/cat_mobiles.jpg',
      discount: 'All Direct Tiers',
      topLeftBadge: 'VIEW ALL',
      badge: 'VIEW ALL',
      isBrowseAll: true,
      margin: 'Full Access',
      subcategories: ['All Categories', 'Supplier Directory', 'Exclusive Dropship Tiers'],
      collageImages: [
        '/images/cat_mobiles.jpg',
        '/images/cat_watches_new.jpg',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=80',
      ],
    },
  ]

  const filterChips = [
    { id: 'all', label: 'All Categories' },
    { id: 'tech', label: 'Mobiles & Tech' },
    { id: 'lifestyle', label: 'Fashion & Beauty' },
    { id: 'home', label: 'Home & Kitchen' },
  ]

  const filteredCategories = allCategories.filter((cat) => {
    const matchesFilter = selectedFilter === 'all' || cat.filterGroup === selectedFilter || cat.id === 'all'
    const matchesSearch =
      searchQuery.trim() === '' ||
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.subcategories.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const handleCategoryClick = (cat) => {
    if (cat.id === 'all') return
    navigate(USER_ROUTES.ROOT + '/listing', { state: { category: cat.name || cat.id } })
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(USER_ROUTES.DASHBOARD)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <HiArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wide">
                    All Categories ({allCategories.length})
                  </span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <HiCheckBadge className="w-4 h-4 text-emerald-500" />
                    <span>Factory Direct</span>
                  </span>
                </div>
                <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Explore All Categories
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Browse complete wholesale & dropshipping product collections.
                </p>
              </div>
            </div>

            {/* Right Action Icons & Search */}
            <div className="flex items-center space-x-3">
              <div className="relative flex-1 md:w-64">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search all categories..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Layout Switcher */}
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layoutMode === 'grid' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Grid View"
                >
                  <HiSquares2X2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLayoutMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layoutMode === 'list' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Detailed List View"
                >
                  <HiListBullet className="w-4 h-4" />
                </button>
              </div>

              {/* Cart Button */}
              <button
                onClick={() => navigate(USER_ROUTES.ROOT + '/cart')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 relative shrink-0 transition-colors border border-slate-200/80"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  3
                </span>
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto pt-2 pb-1 scrollbar-none">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setSelectedFilter(chip.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  selectedFilter === chip.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Banner */}
        <div
          onClick={() => navigate(USER_ROUTES.ROOT + '/listing')}
          className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-lg cursor-pointer group border border-slate-800"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider">
                <HiSparkles className="w-3.5 h-3.5" />
                <span>Featured Brand Mega Deals</span>
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
                Up to 70% Off On Premium Tech & Fashion Bulk Tiers
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                White-label dropshipping products with guaranteed profit margins and zero inventory hold.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button className="px-5 py-2.5 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-extrabold flex items-center space-x-2 shadow-lg transition-all">
                <span>Explore All Deals</span>
                <HiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* All Categories Grid / List View */}
        {layoutMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative"
              >
                {/* Top Badge (Single Pill Badge) */}
                <div className="flex items-center justify-between z-10 w-full mb-1">
                  <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider text-slate-600 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white px-2 py-0.5 rounded-md uppercase transition-colors">
                    {cat.badge}
                  </span>
                </div>

                {/* Product Image Area - Fitted edge-to-edge to card */}
                {cat.isBrowseAll ? (
                  <div className="w-full aspect-[4/3] grid grid-cols-2 gap-1 p-1 bg-slate-50 rounded-xl overflow-hidden my-1 border border-slate-100">
                    {(cat.collageImages || [cat.image, cat.image, cat.image, cat.image]).map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center bg-white"
                      >
                        <img
                          src={imgUrl}
                          alt="Mini catalog thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] relative rounded-xl overflow-hidden my-1 bg-slate-100 flex items-center justify-center">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    />
                  </div>
                )}

                {/* Offer Tag Pill below Image */}
                {cat.discount && (
                  <div className="w-full mt-1">
                    <div className="w-full bg-slate-50 border border-slate-200/60 rounded-lg py-1 px-1.5 text-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-blue-700 tracking-tight block truncate">
                        {cat.discount}
                      </span>
                    </div>
                  </div>
                )}

                {/* Title & Product Count */}
                <div className="pt-2.5 space-y-0.5 text-left border-t border-slate-100 mt-2">
                  <h3
                    className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate tracking-tight"
                    title={cat.fullName || cat.name}
                  >
                    {cat.name}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span className="truncate">{cat.itemCount}</span>
                    <HiArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Detailed Horizontal Cards List View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className="bg-white rounded-3xl border border-slate-200/90 p-4 flex items-center space-x-4 shadow-xs hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer group"
              >
                <div className="w-24 h-24 rounded-2xl bg-slate-50 p-2 flex items-center justify-center border border-slate-100 shrink-0 group-hover:scale-105 transition-transform">
                  <img src={cat.image} alt={cat.name} className="max-h-full max-w-full object-contain drop-shadow-xs" />
                </div>

                <div className="flex-1 space-y-1 min-w-0 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {cat.badge}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">
                      {cat.discount}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{cat.itemCount} • {cat.margin}</p>
                  
                  {cat.subcategories && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {cat.subcategories.join(', ')}
                    </p>
                  )}
                </div>

                <HiChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Bottom Partnership Callout */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0">
              <HiBuildingStorefront className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Looking for Custom B2B Sourcing?</h4>
              <p className="text-xs text-slate-500">Get direct factory quotes, unbranded packaging, and custom bulk tiers.</p>
            </div>
          </div>

          <button
            onClick={() => navigate(USER_ROUTES.ROOT + '/support')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            Contact B2B Team
          </button>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="categories" />
      </div>
    </div>
  )
}
