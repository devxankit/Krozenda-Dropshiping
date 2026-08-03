import React from 'react'
import { HiCheck, HiDocumentDuplicate } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen20OrderPlaced({ orderId = 'KRO1234567890', amount = 49298, onViewOrderDetails = () => {}, onContinueShopping = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-20 md:pb-12 max-w-xl mx-auto w-full md:px-6 md:py-8">
        <div className="bg-white rounded-3xl border p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg"><HiCheck className="w-10 h-10 stroke-[3]" /></div>
          <div><h2 className="text-2xl font-black text-slate-900">Order Placed!</h2><p className="text-xs text-slate-500 mt-1">Thank you for shopping with Krozenda.</p></div>
          <div className="bg-slate-50 border rounded-2xl p-4 text-xs space-y-2">
            <div className="flex justify-between"><span>Order ID</span><span className="font-bold">{orderId}</span></div>
            <div className="flex justify-between"><span>Order Amount</span><span className="font-bold">₹{amount.toLocaleString('en-IN')}</span></div>
          </div>
          <div className="space-y-2">
            <button onClick={onViewOrderDetails} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">View Order Details</button>
            <button onClick={onContinueShopping} className="w-full bg-white text-slate-800 border rounded-xl font-semibold py-3.5 text-xs">Continue Shopping</button>
          </div>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"><BottomNavbar activeTab="orders" /></div>
    </div>
  )
}
