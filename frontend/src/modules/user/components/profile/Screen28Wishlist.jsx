import React, { useState } from 'react'
import { HiArrowLeft, HiHeart } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen28Wishlist({ onBack = () => {} }) {
  const [items] = useState([
    { id: 1, name: 'iPhone 14 128GB', price: 59999, image: '/images/iphone_14.png' },
    { id: 2, name: 'boAt Airdopes 141', price: 1299, image: '/images/boat_airdopes.png' },
  ])
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b flex items-center space-x-3"><button onClick={onBack}><HiArrowLeft className="w-5 h-5" /></button><h2 className="text-base font-bold">Wishlist</h2></div>
        <div className="p-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3"><img src={item.image} alt={item.name} className="w-12 h-12 object-contain" /><div><h4 className="text-xs font-bold">{item.name}</h4><span className="text-xs font-black">₹{item.price.toLocaleString('en-IN')}</span></div></div>
              <HiHeart className="w-5 h-5 text-red-500 fill-current" />
            </div>
          ))}
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="wishlist" /></div>
    </div>
  )
}
