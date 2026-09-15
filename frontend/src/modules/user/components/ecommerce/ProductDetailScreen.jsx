import React, { useRef, useState } from 'react'
import {
  HiArrowLeft,
  HiOutlineHeart,
  HiHeart,
  HiShare,
  HiStar,
  HiOutlineShoppingBag,
  HiTruck,
  HiShieldCheck,
  HiArrowPath,
  HiCheck,
  HiMapPin,
} from 'react-icons/hi2'
import { useLocation, useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { USER_ROUTES } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useProductController } from '../../controllers/useProductsController'
import { useProductReviewsController } from '../../controllers/useProductReviewsController'

export function ProductDetailScreen({ onBack = () => {}, onAddToCart = () => {}, onBuyNow = () => {} }) {
  const navigate = useNavigate()
  const location = useLocation()
  const productId = location.state?.productId

  const { product, isLoading, isError } = useProductController(productId)
  const { reviews, isLoading: loadingReviews } = useProductReviewsController(productId)

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [pincode, setPincode] = useState('')
  const [pincodeChecked, setPincodeChecked] = useState(false)
  const [activeTab, setActiveTab] = useState('description')

  const scrollRef = useRef(null)

  const isWishlisted = useWishlistStore((state) => (productId ? state.isWishlisted(productId) : false))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)
  const addToCart = useCartStore((state) => state.addItem)

  if (!productId) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">No product selected</h2>
        <p className="text-xs text-slate-500 max-w-sm">Go back and pick a product from the catalog to view its details.</p>
        <button onClick={onBack} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
          Back to browsing
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="text-xs font-semibold text-slate-400">Loading product...</span>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">This product is unavailable</h2>
        <p className="text-xs text-slate-500 max-w-sm">It may have been removed or is currently out of listing.</p>
        <button onClick={onBack} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
          Back to browsing
        </button>
      </div>
    )
  }

  const displayPrice = product.salePrice ?? product.price
  const hasDiscount = product.salePrice != null && product.salePrice < product.price
  const images = product.images.length > 0 ? product.images : ['/images/placeholder.png']
  const inStock = product.stock > 0

  const handleToggleWishlist = () =>
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle: product.brand?.name || product.category?.name || '',
      image: images[0],
      price: displayPrice,
    })

  const cartLineItem = () => ({
    id: product.id,
    name: product.name,
    variant: '',
    image: images[activeImageIndex] || images[0],
    price: displayPrice,
    originalPrice: product.price,
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
      scrollRef.current.scrollTo({ left: index * scrollRef.current.clientWidth, behavior: 'smooth' })
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Breadcrumb Navigation (Desktop) */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-semibold text-slate-500">
          <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">Home</span>
          {product.category && (
            <>
              <span>/</span>
              <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">{product.category.name}</span>
            </>
          )}
          {product.brand && (
            <>
              <span>/</span>
              <span onClick={onBack} className="hover:text-blue-600 cursor-pointer">{product.brand.name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 font-bold truncate">{product.name}</span>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          {/* Left Column: Image Gallery & Trust Badges */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs relative h-80 sm:h-96 flex flex-col items-center justify-center overflow-hidden group">
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

              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none space-x-0 cursor-grab active:cursor-grabbing"
              >
                {images.map((imgUrl, idx) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-2">
                    <img
                      src={imgUrl}
                      alt={`${product.name} View ${idx + 1}`}
                      className="max-h-full max-w-full object-contain drop-shadow-md select-none transition-transform group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        activeImageIndex === idx ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="hidden md:flex items-center justify-center space-x-3">
                {images.map((img, idx) => (
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
            )}

            {/* Trust Badges */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
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

          {/* Right Column: Product Details, Pricing & Actions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 lg:p-8 shadow-xs space-y-6">
            <div className="space-y-2 border-b border-slate-100 pb-4">
              {product.sku && (
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                  SKU: {product.sku}
                </span>
              )}
              <h1 className="text-xl lg:text-3xl font-black text-slate-900 leading-tight">{product.name}</h1>
              {(product.brand || product.category) && (
                <p className="text-xs font-semibold text-slate-500">
                  {[product.brand?.name, product.category?.name].filter(Boolean).join(' · ')}
                </p>
              )}

              {product.reviewsCount > 0 && (
                <div className="flex items-center space-x-3 pt-1">
                  <div className="flex items-center space-x-1 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg text-xs font-black">
                    <span>{product.rating.toFixed(1)}</span>
                    <HiStar className="w-3.5 h-3.5 fill-slate-950" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">({product.reviewsCount} Reviews)</span>
                </div>
              )}
            </div>

            {/* Price & Discount */}
            <div className="space-y-3">
              <div className="flex items-baseline space-x-3 flex-wrap gap-y-1">
                <span className="text-2xl lg:text-3xl font-black text-slate-900">
                  ₹{displayPrice.toLocaleString('en-IN')}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-sm text-slate-400 line-through font-semibold">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                    {product.discountPercent > 0 && (
                      <span className="text-sm font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        {product.discountPercent}% OFF
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Inclusive of all taxes.</p>

              <div className="pt-1">
                {inStock ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                    <HiCheck className="w-4 h-4" />
                    <span>In Stock</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-red-600">Out of Stock</span>
                )}
              </div>
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
                  onClick={() => setPincodeChecked(pincode.length === 6)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                >
                  Check
                </button>
              </div>

              {pincodeChecked && (
                <div className="text-xs font-bold text-emerald-600 flex items-center space-x-1 pt-1">
                  <HiCheck className="w-4 h-4" />
                  <span>Delivery available at {pincode}</span>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className="w-full bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 border-2 border-blue-700 font-extrabold py-4 px-4 rounded-2xl shadow-xs transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                <span>Add to Cart</span>
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!inStock}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-extrabold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Tabs Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 lg:p-8 shadow-xs space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
            {[
              { id: 'description', label: 'Product Overview' },
              { id: 'reviews', label: `Customer Reviews (${product.reviewsCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'description' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-600">
              <h3 className="text-sm font-black text-slate-900">Product Overview</h3>
              <p className="whitespace-pre-line">
                {product.description || 'No description provided for this product yet.'}
              </p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-5 rounded-2xl border border-slate-200/80 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-black text-slate-900">{product.rating.toFixed(1)}</span>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <HiStar key={s} className={`w-5 h-5 ${s <= Math.round(product.rating) ? 'fill-amber-400' : 'fill-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Based on {product.reviewsCount} verified buyer reviews</p>
                </div>

                <button
                  onClick={() => navigate(USER_ROUTES.ROOT + '/orders/review')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs self-start sm:self-auto"
                >
                  Write a Review
                </button>
              </div>

              {loadingReviews ? (
                <p className="text-xs font-semibold text-slate-400 text-center py-6">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400 text-center py-6">No reviews yet — be the first to review this product.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{review.author}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <HiCheck className="w-3 h-3" />
                            <span>Verified Buyer</span>
                          </span>
                        </div>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(review.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <HiStar key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'fill-amber-400' : 'fill-slate-200'}`} />
                        ))}
                      </div>
                      {review.reviewText && <p className="text-slate-700 leading-relaxed font-medium">{review.reviewText}</p>}
                      {review.photos.length > 0 && (
                        <div className="flex items-center space-x-2 pt-1">
                          {review.photos.map((photo, idx) => (
                            <img key={idx} src={photo} alt="Review" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
