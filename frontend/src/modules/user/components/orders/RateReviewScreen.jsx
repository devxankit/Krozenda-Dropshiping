import React, { useEffect, useRef, useState } from 'react'
import { HiArrowLeft, HiStar, HiPlus, HiXMark } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { Toast } from '../../../../components/ui'
import { useSubmitReviewController } from '../../controllers/useSubmitReviewController'

const MAX_PHOTOS = 4

function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function RateReviewScreen({
  product = {
    id: 'samsung-galaxy-s23-5g',
    name: 'Samsung Galaxy S23 5G',
    subtitle: '(128GB, Phantom Black)',
    price: 49999,
    deliveredDate: 'Delivered on 15 May 2024',
    image: '/images/samsung_s23.png',
  },
  onBack = () => {},
  onSubmitReview = () => {},
}) {
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('Amazing phone! Super fast delivery and genuine product. Highly recommended.')
  const [photos, setPhotos] = useState([]) // [{ file, previewUrl }]
  const fileInputRef = useRef(null)
  const { submitReview, isSubmitting, isError, error } = useSubmitReviewController()

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  // Object URLs are only a local preview of the picked file — the actual
  // upload happens on submit via reviewService (multipart POST). Revoke
  // them on unmount/replace so we don't leak memory.
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [photos])

  const handlePickPhotos = (event) => {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    const next = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    setPhotos((prev) => [...prev, ...next])
    event.target.value = ''
  }

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async () => {
    const review = await submitReview({
      productId: product.id ?? slugify(product.name),
      productName: product.name,
      rating,
      reviewText,
      photoFiles: photos.map((photo) => photo.file),
    })
    onSubmitReview(review)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
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
            <h2 className="text-base font-bold text-slate-900">Rate & Review</h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Delivered Product Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {product.deliveredDate}
            </span>

            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-slate-50 rounded-xl p-1.5 shrink-0 flex items-center justify-center border border-slate-100">
                <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-900 leading-snug">
                  {product.name} {product.subtitle}
                </h3>
                <span className="text-xs font-black text-slate-900 mt-1 inline-block">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Star Rating Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-center space-y-3">
            <h3 className="text-xs font-bold text-slate-900">
              How would you rate this product?
            </h3>

            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <HiStar
                    className={`w-8 h-8 ${
                      star <= rating ? 'text-amber-400 fill-current' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-amber-600 block">
              {ratingLabels[rating]}
            </span>
          </div>

          {/* Review Text Input Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Write a Review <span className="text-slate-400 font-normal">(Optional)</span></span>
              <span className="text-[10px] text-slate-400 font-normal">{reviewText.length}/500</span>
            </div>

            <textarea
              rows={4}
              maxLength={500}
              placeholder="Write your detailed review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-inner"
            />
          </div>

          {/* Add Photos Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5">
            <label className="block text-xs font-bold text-slate-900">
              Add Photos <span className="text-slate-400 font-normal">({photos.length}/{MAX_PHOTOS})</span>
            </label>

            <div className="flex items-center space-x-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.previewUrl}
                  className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-0.5 relative"
                >
                  <img src={photo.previewUrl} alt={`Selected photo ${index + 1}`} className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    aria-label="Remove photo"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/80 text-white flex items-center justify-center"
                  >
                    <HiXMark className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-500 transition-colors"
                >
                  <HiPlus className="w-6 h-6" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePickPhotos}
              />
            </div>
          </div>

          {isError && <Toast tone="danger" message={error?.message ?? 'Could not submit your review. Please try again.'} />}

          {/* Submit Review Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}
