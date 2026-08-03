import React, { useState } from 'react'
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
} from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

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
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [pincode, setPincode] = useState('380051')
  const [pincodeChecked, setPincodeChecked] = useState(true)

  const storageOptions = ['128GB', '256GB', '512GB']
  const colorOptions = ['Phantom Black', 'Cream', 'Green']

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-8">
        {/* Mobile Header Bar */}
        <div className="md:hidden py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs px-4 rounded-xl mb-4">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsWishlisted(!isWishlisted)} className="p-2 rounded-full hover:bg-slate-100">
              {isWishlisted ? <HiHeart className="w-5 h-5 text-red-500 fill-red-500" /> : <HiOutlineHeart className="w-5 h-5 text-slate-700" />}
            </button>
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiShare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Amazon & Flipkart Styled 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left Column: Image Gallery & Thumbnails */}
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs relative flex items-center justify-center h-80 sm:h-96">
              {/* Wishlist & Share Floating Buttons (Desktop) */}
              <div className="hidden md:flex flex-col space-y-2 absolute top-4 right-4 z-10">
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all"
                >
                  {isWishlisted ? <HiHeart className="w-5 h-5 text-red-500 fill-red-500" /> : <HiOutlineHeart className="w-5 h-5" />}
                </button>
                <button className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all">
                  <HiShare className="w-5 h-5" />
                </button>
              </div>

              {/* Main Product Image */}
              <img
                src={product.images[activeImageIndex] || product.images[0]}
                alt={product.name}
                className="max-h-full max-w-full object-contain drop-shadow-lg transition-transform hover:scale-105"
              />

              {/* Mobile Dots */}
              <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5">
                {product.images.map((_, idx) => (
                  <span
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      activeImageIndex === idx ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300'
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
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 h-20 bg-white rounded-2xl border p-2 flex items-center justify-center transition-all ${
                    activeImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            {/* Trust Features Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <HiShieldCheck className="w-5 h-5 text-blue-600 mx-auto" />
                <span className="font-bold text-slate-900 block text-[11px]">100% Genuine</span>
                <span className="text-[10px] text-slate-400">Direct Brand Warranty</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <HiArrowPath className="w-5 h-5 text-emerald-600 mx-auto" />
                <span className="font-bold text-slate-900 block text-[11px]">7 Days Return</span>
                <span className="text-[10px] text-slate-400">Hassle-Free Exchange</span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <HiTruck className="w-5 h-5 text-indigo-600 mx-auto" />
                <span className="font-bold text-slate-900 block text-[11px]">Express Shipping</span>
                <span className="text-[10px] text-slate-400">Pan-India Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Product Info & Purchase Actions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 lg:p-8 shadow-xs space-y-6">
            {/* Title & Rating */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                BRAND AUTHORIZED SUPPLIER
              </span>
              <h1 className="text-xl lg:text-3xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>
              <p className="text-xs font-semibold text-slate-500">{product.subtitle}</p>

              <div className="flex items-center space-x-3 pt-1">
                <div className="flex items-center space-x-1 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg text-xs font-black">
                  <span>{product.rating}</span>
                  <HiStar className="w-3.5 h-3.5 fill-slate-950" />
                </div>
                <span className="text-xs font-bold text-slate-600">({product.reviews} Ratings & Reviews)</span>
              </div>
            </div>

            {/* Price & Offers */}
            <div className="space-y-3">
              <div className="flex items-baseline space-x-3">
                <span className="text-2xl lg:text-3xl font-black text-slate-900">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-slate-400 line-through font-semibold">
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {product.discount}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Inclusive of all taxes & GST Invoicing</p>

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
                    <p className="text-[11px] text-slate-600">Upto 9 months No Cost EMI available from ₹5,555/mo</p>
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
                <span className="text-amber-400 flex items-center space-x-1">
                  <span>⚡</span>
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
                onClick={onAddToCart}
                className="w-full bg-white hover:bg-slate-50 text-blue-700 border-2 border-blue-700 font-extrabold py-4 px-4 rounded-2xl shadow-xs transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                <span>Add to Cart</span>
              </button>

              <button
                onClick={onBuyNow}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-extrabold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
