import React, { useState, useRef } from 'react'
import {
  HiArrowLeft,
  HiOutlineHeart,
  HiHeart,
  HiShare,
  HiStar,
  HiOutlineShoppingBag,
  HiChevronRight,
  HiCreditCard,
  HiTruck,
  HiShieldCheck,
  HiArrowPath,
  HiCheck,
  HiSparkles,
  HiMapPin,
  HiBuildingStorefront,
  HiCheckCircle,
  HiBolt,
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'

export function ProductDetailScreen({
  product = {
    name: 'Samsung Galaxy S23 5G',
    subtitle: '(128GB, Phantom Black)',
    rating: 4.5,
    reviews: '2,351',
    price: 49999,
    originalPrice: 74999,
    discount: '33% OFF',
    images: ['/images/samsung_s23.png', '/images/iphone_14.png', '/images/boat_airdopes.png'],
  },
  onBack = () => {},
  onAddToCart = () => {},
  onBuyNow = () => {},
}) {
  const [selectedStorage, setSelectedStorage] = useState('128GB')
  const [selectedColor, setSelectedColor] = useState('Phantom Black')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [pincode, setPincode] = useState('380051')
  const [pincodeChecked, setPincodeChecked] = useState(true)
  const [activeTab, setActiveTab] = useState('specs')
  const [quantityTier, setQuantityTier] = useState(1)

  const scrollRef = useRef(null)

  const storageOptions = ['128GB', '256GB', '512GB']
  const colorOptions = ['Phantom Black', 'Cream', 'Green']

  const productId = product.id || product._id || product.name
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(productId))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addToCart = useCartStore((state) => state.addItem)

  const handleToggleWishlist = () =>
    toggleWishlistItem({
      id: productId,
      name: product.name,
      subtitle: product.subtitle,
      image: product.images?.[0],
      price: product.price,
    })

  const cartLineItem = () => ({
    id: productId,
    name: product.name,
    variant: `${selectedColor} • ${selectedStorage}`,
    image: product.images?.[activeImageIndex] || product.images?.[0],
    price: product.price,
    originalPrice: product.originalPrice,
  })

  const handleAddToCart = () => {
    addToCart(cartLineItem())
    onAddToCart()
  }

  const handleBuyNow = () => {
    addToCart(cartLineItem())
    onBuyNow()
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, clientWidth } = scrollRef.current
    const newIndex = Math.round(scrollLeft / clientWidth)
    if (newIndex !== activeImageIndex) {
      setActiveImageIndex(newIndex)
    }
  }

  const scrollToIndex = (index) => {
    setActiveImageIndex(index)
    if (scrollRef.current) {
      const clientWidth = scrollRef.current.clientWidth
      scrollRef.current.scrollTo({
        left: index * clientWidth,
        behavior: 'smooth',
      })
    }
  }

  const specs = [
    { label: 'In the Box', value: 'Handset, Type-C Cable, Ejection Pin, Quick Start Guide' },
    { label: 'Model Name', value: 'Galaxy S23 5G' },
    { label: 'Display Size', value: '15.49 cm (6.1 inch) Dynamic AMOLED 2X 120Hz' },
    { label: 'Resolution', value: '2340 x 1080 Pixels (FHD+)' },
    { label: 'Processor', value: 'Qualcomm Snapdragon 8 Gen 2 for Galaxy (4nm)' },
    { label: 'Primary Camera', value: '50MP (OIS) + 12MP (Ultra-Wide) + 10MP (3x Telephoto)' },
    { label: 'Front Camera', value: '12MP Dual Pixel Dual Audio Selfie Camera' },
    { label: 'Battery Capacity', value: '3900 mAh with 25W Fast Charging & Wireless PowerShare' },
    { label: 'Warranty', value: '1 Year Brand Manufacturer Warranty for Device & 6 Months for Accessories' },
  ]

  const bulkTiers = [
    { qty: '1 - 4 Units', price: '₹49,999', badge: 'Standard' },
    { qty: '5 - 19 Units', price: '₹47,999', badge: 'Save ₹2,000/pc' },
    { qty: '20+ Units', price: '₹45,999', badge: 'Wholesale Tier' },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Breadcrumb Navigation (Desktop) */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-semibold text-slate-500">
          <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">Home</span>
          <span>/</span>
          <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">Mobiles & Tablets</span>
          <span>/</span>
          <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">Samsung</span>
          <span>/</span>
          <span className="text-slate-900 font-bold truncate">Samsung Galaxy S23 5G</span>
        </div>

        {/* Clean Edge-to-Edge Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-between py-2 px-1">
          <button onClick={onBack} className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs">
            <HiArrowLeft className="w-4 h-4 text-slate-700" />
            <span>Back</span>
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={handleToggleWishlist} className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-700">
              {isWishlisted ? <HiHeart className="w-4 h-4 text-red-500 fill-red-500" /> : <HiOutlineHeart className="w-4 h-4" />}
            </button>
            <button className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-700">
              <HiShare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Amazon & Flipkart Styled 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          {/* Left Column: Premium Swipeable Image Showcase & Seller Info */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs relative h-80 sm:h-96 flex flex-col items-center justify-center overflow-hidden group">
              {/* Desktop Floating Wishlist & Share Buttons */}
              <div className="hidden md:flex flex-col space-y-2 absolute top-4 right-4 z-20">
                <button
                  onClick={handleToggleWishlist}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-white transition-all"
                >
                  {isWishlisted ? <HiHeart className="w-5 h-5 text-red-500 fill-red-500" /> : <HiOutlineHeart className="w-5 h-5" />}
                </button>
                <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-white transition-all">
                  <HiShare className="w-5 h-5" />
                </button>
              </div>

              {/* Horizontally Scrollable / Swipeable Image Gallery */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none space-x-0 cursor-grab active:cursor-grabbing"
              >
                {product.images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-2"
                  >
                    <img
                      src={imgUrl}
                      alt={`${product.name} View ${idx + 1}`}
                      className="max-h-full max-w-full object-contain drop-shadow-md select-none transition-transform group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>

              {/* Clean Indicator Dots Bar */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
                {product.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      activeImageIndex === idx ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop Thumbnail Selector */}
            <div className="hidden md:flex items-center justify-center space-x-3">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToIndex(idx)}
                  className={`w-20 h-20 bg-white rounded-2xl border p-2 flex items-center justify-center transition-all ${
                    activeImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            {/* Seller & Verified Supplier Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <HiBuildingStorefront className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center space-x-1">
                      <span>Samsung India Electronics B2B</span>
                      <HiCheckCircle className="w-4 h-4 text-blue-600" />
                    </h4>
                    <p className="text-[11px] text-slate-500">Verified Factory Supplier • 4.9 ★ Rating</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                  10,000+ Orders
                </span>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <HiShieldCheck className="w-4 h-4 text-blue-600 mx-auto" />
                  <span className="font-bold text-slate-800 block text-[10px]">100% Genuine</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <HiArrowPath className="w-4 h-4 text-emerald-600 mx-auto" />
                  <span className="font-bold text-slate-800 block text-[10px]">7 Days Return</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <HiTruck className="w-4 h-4 text-indigo-600 mx-auto" />
                  <span className="font-bold text-slate-800 block text-[10px]">Express Courier</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Product Details, Pricing, Wholesale & Actions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 lg:p-8 shadow-xs space-y-6">
            {/* Title & Rating */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  DIRECT FACTORY SUPPLY
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  GST INVOICE ELIGIBLE
                </span>
              </div>
              <h1 className="text-xl lg:text-3xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>
              <p className="text-xs font-semibold text-slate-500">{product.subtitle}</p>

              <div className="flex items-center space-x-3 pt-1">
                <div className="flex items-center space-x-1 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg text-xs font-black">
                  <span>{product.rating}</span>
                  <HiStar className="w-3.5 h-3.5 fill-slate-950" />
                </div>
                <span className="text-xs font-bold text-slate-600">({product.reviews} Ratings & 412 Reviews)</span>
              </div>
            </div>

            {/* Price & Discount */}
            <div className="space-y-3">
              <div className="flex items-baseline space-x-3">
                <span className="text-2xl lg:text-3xl font-black text-slate-900">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-slate-400 line-through font-semibold">
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                  {product.discount}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Inclusive of all taxes. Save ₹{(product.originalPrice - product.price).toLocaleString('en-IN')} on this order!
              </p>

              {/* B2B Wholesale Quantity Tier Prices */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-900 block">B2B Wholesale Quantity Tier Prices:</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {bulkTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      onClick={() => setQuantityTier(idx + 1)}
                      className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                        quantityTier === idx + 1
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-500 block">{tier.qty}</span>
                      <span className="text-xs font-black block mt-0.5">{tier.price}</span>
                      <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">{tier.badge}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Offer Cards Box */}
              <div className="space-y-2.5 pt-2">
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <HiCreditCard className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-slate-900">Bank Offer</h4>
                    <p className="text-[11px] text-slate-600">Upto ₹2,000 instant discount on HDFC & ICICI Cards</p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <HiSparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-slate-900">No Cost EMI</h4>
                    <p className="text-[11px] text-slate-600">Upto 9 months No Cost EMI available starting at ₹4,166/mo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Variants */}
            <div className="space-y-2.5 pt-2">
              <label className="text-xs font-bold text-slate-900 block">Select Storage Variant:</label>
              <div className="flex flex-wrap gap-3">
                {storageOptions.map((storage) => (
                  <button
                    key={storage}
                    onClick={() => setSelectedStorage(storage)}
                    className={`px-5 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                      selectedStorage === storage
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {storage}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Variants */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-900 block">Select Color:</label>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-4 py-2 rounded-2xl border text-xs font-bold transition-all ${
                      selectedColor === color
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropship Resell Margin Calculator Box */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-400 flex items-center space-x-1.5">
                  <HiBolt className="w-4 h-4 text-amber-400" />
                  <span>Dropshipper Reseller Profit Margin</span>
                </span>
                <span className="text-emerald-400 font-black text-sm">+ ₹5,000 / Unit</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Suggested Resell Price on Shopify/Meesho: <strong>₹54,999</strong>
              </p>
            </div>

            {/* Delivery Pincode Checker */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <HiMapPin className="w-4 h-4 text-blue-600" />
                <span>Delivery & Service Availability</span>
              </label>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Enter 6-digit Pincode"
                  className="w-44 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                <button
                  onClick={() => setPincodeChecked(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                >
                  Check
                </button>
              </div>

              {pincodeChecked && (
                <div className="text-xs font-bold text-emerald-600 flex items-center space-x-1 pt-1">
                  <HiCheck className="w-4 h-4" />
                  <span>Free Express Delivery by Tomorrow at {pincode}</span>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleAddToCart}
                className="w-full bg-white hover:bg-slate-50 text-blue-700 border-2 border-blue-700 font-extrabold py-4 px-4 rounded-2xl shadow-xs transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                <span>Add to Cart</span>
              </button>

              <button
                onClick={handleBuyNow}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-extrabold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Tabs Section (Amazon / Flipkart Style) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 lg:p-8 shadow-xs space-y-6">
          {/* Tab Navigation */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
            {[
              { id: 'specs', label: 'Technical Specifications' },
              { id: 'description', label: 'Product Overview' },
              { id: 'reviews', label: 'Customer Reviews (2,351)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content 1: Technical Specifications Table */}
          {activeTab === 'specs' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900">Specifications & Features</h3>
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                {specs.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 p-3.5 text-xs hover:bg-slate-50/50">
                    <span className="font-bold text-slate-500 sm:col-span-1">{item.label}</span>
                    <span className="font-semibold text-slate-900 sm:col-span-2 mt-0.5 sm:mt-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content 2: Overview / Description */}
          {activeTab === 'description' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-600">
              <h3 className="text-sm font-black text-slate-900">Product Overview</h3>
              <p>
                The Samsung Galaxy S23 5G is powered by the custom Snapdragon 8 Gen 2 for Galaxy processor, offering blazing-fast speed and incredible power efficiency. Capture night photography like never before with the 50MP triple camera system with Advanced Nightography and Optical Image Stabilization.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                  <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <HiSparkles className="w-4 h-4 text-purple-600" />
                    <span>Epic Nightography</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">Capture crystal clear photos and videos from dusk until dawn.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                  <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <HiBolt className="w-4 h-4 text-amber-500" />
                    <span>Snapdragon 8 Gen 2</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">Custom tuned 4nm processor for elite mobile gaming and multitasking.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Verified Customer Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-5 rounded-2xl border border-slate-200/80 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-black text-slate-900">4.5</span>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <HiStar key={s} className="w-5 h-5 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Based on 2,351 verified buyer reviews</p>
                </div>

                <button className="bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs self-start sm:self-auto">
                  Write a Review
                </button>
              </div>

              {/* Sample Verified Reviews */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">Ankit Ahirwar</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <HiCheck className="w-3 h-3" />
                        <span>Verified Buyer</span>
                      </span>
                    </div>
                    <span className="text-slate-400 text-[10px]">2 days ago</span>
                  </div>
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <HiStar key={s} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    Awesome phone! Delivered super fast with factory sealed GST invoice. Battery lasts full day and camera is top notch.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
