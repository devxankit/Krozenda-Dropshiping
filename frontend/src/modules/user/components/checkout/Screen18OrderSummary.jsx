import React from 'react'
import { HiArrowLeft, HiShieldCheck } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen18OrderSummary({ onBack = () => {}, onEditCart = () => {}, onProceedToPayment = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100"><HiArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex justify-between items-center"><h3 className="text-xs font-bold uppercase">Items (3)</h3><button onClick={onEditCart} className="text-xs font-bold text-blue-600">Edit</button></div>
            <p className="text-xs text-slate-600">Samsung Galaxy S23 5G, boAt Airdopes 141, Portronics Power Bank</p>
          </div>
          <div className="bg-white rounded-2xl border p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span>Price (3 Items)</span><span>₹52,497</span></div>
            <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- ₹3,000</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-sm"><span>Total Amount</span><span>₹49,298</span></div>
          </div>
          <button onClick={onProceedToPayment} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">Proceed to Payment</button>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}
