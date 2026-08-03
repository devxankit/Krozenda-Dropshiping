import React, { useState } from 'react'
import { HiArrowLeft, HiOutlineHeart, HiHeart, HiShare, HiStar, HiOutlineShoppingBag, HiChevronRight, HiCreditCard, HiBuildingLibrary } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen14ProductDetail({
  product = {
    name: 'Samsung Galaxy S23 5G',
    subtitle: '(Phantom Black, 128GB)',
    rating: 4.5,
    reviews: '1,245',
    price: 49999,
    originalPrice: 74999,
    discount: '33% OFF',
    image: '/images/samsung_s23.png',
  },
  onBack = () => {},
  onAddToCart = () => {},
  onBuyNow = () => {},
}) {
  const [selectedVariant, setSelectedVariant] = useState('128GB')
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const variants = ['128GB', '256GB', '512GB']

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <div className="flex-1 pb-24 md:pb-12 max-w-4xl mx-auto w-full md:px-6 md:py-6">
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

        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsWishlisted(!isWishlisted)} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              {isWishlisted ? <HiHeart className="w-5 h-5 text-red-500" /> : <HiOutlineHeart className="w-5 h-5" />}
            </button>
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiShare className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white md:rounded-3xl md:border border-slate-200/80 md:p-6 shadow-xs">
          <div className="relative w-full h-64 md:h-80 bg-slate-50 flex items-center justify-center p-4">
            <img src={product.image} alt={product.name} className="max-h-full object-contain drop-shadow-md" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5">
              {[0, 1, 2].map((idx) => (
                <span key={idx} onClick={() => setActiveImageIndex(idx)} className={`h-2 rounded-full transition-all cursor-pointer ${activeImageIndex === idx ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300'}`} />
              ))}
            </div>
          </div>

          <div className="p-5 md:px-0 space-y-4">
            <div>
              <h1 className="text-base md:text-xl font-bold text-slate-900 leading-snug">{product.name} {product.subtitle}</h1>
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex items-center bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-amber-700 text-xs font-bold">
                  <HiStar className="w-3.5 h-3.5 fill-current text-amber-500 mr-1" />
                  <span>{product.rating}</span>
                  <span className="text-slate-400 font-normal ml-1">({product.reviews} reviews)</span>
                </div>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">Bestseller</span>
              </div>
            </div>

            <div className="border-t border-b border-slate-100 py-3">
              <div className="flex items-baseline space-x-3">
                <span className="text-2xl font-black text-slate-900">₹{product.price.toLocaleString('en-IN')}</span>
                <span className="text-xs text-slate-400 line-through">₹{product.originalPrice.toLocaleString('en-IN')}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{product.discount}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center space-x-3">
                  <HiCreditCard className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">No Cost EMI</h4>
                    <p className="text-[10px] text-slate-500">From ₹2,778/month</p>
                  </div>
                </div>
                <HiChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">Select Variant</label>
              <div className="flex items-center space-x-3">
                {variants.map((v) => (
                  <button key={v} onClick={() => setSelectedVariant(v)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${selectedVariant === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex items-center space-x-3">
          <button onClick={onAddToCart} className="flex-1 flex items-center justify-center space-x-2 bg-white text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-600 text-xs">
            <HiOutlineShoppingBag className="w-4 h-4" />
            <span>Add to Cart</span>
          </button>
          <button onClick={onBuyNow} className="flex-1 bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">
            Buy Now
          </button>
        </div>
      </div>
    </div>
  )
}
