import React, { useState } from 'react'
import { HiArrowLeft, HiMapPin } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function DeliveryOptionsScreen({ onBack = () => {}, onChangeAddress = () => {}, onNext = () => {} }) {
  const [selectedOption, setSelectedOption] = useState('standard')
  const deliveryOptions = [
    { id: 'standard', title: 'Standard Delivery', tag: 'FREE', days: '3-5 Business Days', price: 0 },
    { id: 'express', title: 'Express Delivery', days: '1-2 Business Days', price: 99 },
    { id: 'sameday', title: 'Same Day Delivery', days: 'Within 6 Hours', price: 199 },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100"><HiArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-bold text-slate-900">Delivery Options</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <HiMapPin className="w-5 h-5 text-blue-600" />
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Deliver to</span>
                <p className="text-xs font-bold text-slate-900">Home - 123, Sunrise Apartments...</p>
              </div>
            </div>
            <button onClick={onChangeAddress} className="text-xs font-bold text-blue-600">Change</button>
          </div>
          <div className="space-y-3">
            {deliveryOptions.map((item) => (
              <div key={item.id} onClick={() => setSelectedOption(item.id)} className={`p-4 rounded-2xl border cursor-pointer ${selectedOption === item.id ? 'border-blue-600 bg-blue-50/40' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    <p className="text-[10px] text-slate-500">{item.days}</p>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.price === 0 ? '₹0' : `₹${item.price}`}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => onNext({ selectedOption })} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">
            Continue
          </button>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}
