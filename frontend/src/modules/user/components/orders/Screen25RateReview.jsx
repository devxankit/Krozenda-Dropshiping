import React, { useState } from 'react'
import { HiArrowLeft, HiStar } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen25RateReview({ onBack = () => {}, onSubmitReview = () => {} }) {
  const [rating, setRating] = useState(5)
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex items-center space-x-3">
          <button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-bold">Rate & Review</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border p-4 text-center space-y-3">
            <h3 className="text-xs font-bold">How would you rate this product?</h3>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((s) => (<HiStar key={s} onClick={() => setRating(s)} className={`w-8 h-8 cursor-pointer ${s <= rating ? 'text-amber-400 fill-current' : 'text-slate-200'}`} />))}
            </div>
          </div>
          <button onClick={onSubmitReview} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Submit Review</button>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}
