import React, { useState } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen19Payment({ amount = 49298, onBack = () => {}, onPaymentSuccess = () => {} }) {
  const [selectedMethod, setSelectedMethod] = useState('upi')
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>
      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100"><HiArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-bold text-slate-900">Payment</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border p-4 flex justify-between items-center">
            <div><span className="text-[10px] text-slate-400 font-medium block">Total Amount</span><span className="text-lg font-black">₹{amount.toLocaleString('en-IN')}</span></div>
          </div>
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase">Recommended</h3>
            {['UPI', 'Credit / Debit Card', 'Net Banking', 'Wallets', 'Razorpay UPI'].map((m, idx) => (
              <div key={idx} onClick={() => setSelectedMethod(m)} className={`p-3 rounded-xl border cursor-pointer text-xs font-bold ${selectedMethod === m ? 'border-blue-600 bg-blue-50' : ''}`}>{m}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg z-50 max-w-3xl mx-auto">
        <button onClick={onPaymentSuccess} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs">Pay ₹{amount.toLocaleString('en-IN')}</button>
      </div>
    </div>
  )
}
