import React from 'react'
import { useLocation } from 'react-router-dom'
import { HiCheck, HiTruck } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function OrderPlacedScreen({ onViewOrderDetails = () => {}, onContinueShopping = () => {} }) {
  const location = useLocation()
  const order = location.state?.order
  const orderId = order?.id ? `#${order.id.slice(-10).toUpperCase()}` : 'Order Confirmed'
  const amount = order?.total ?? 0
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col items-center justify-center">
        <div className="w-full bg-white rounded-3xl border border-slate-200/80 p-8 md:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
          {/* Top Decorative Sparkles */}
          <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 scale-105">
            <HiCheck className="w-14 h-14 stroke-[3]" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider rounded-full inline-block">
              🎉 Order Confirmed
            </span>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900">
              Order Placed Successfully!
            </h1>
            <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Thank you for shopping with KroZenda! We are processing your wholesale order and preparing it for express dispatch.
            </p>
          </div>

          {/* Order Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-xs max-w-md mx-auto space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Order Reference ID:</span>
              <span className="font-black text-slate-900 text-sm font-mono">{orderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Paid Amount:</span>
              <span className="font-black text-blue-700 text-base">₹{amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Estimated Delivery:</span>
              <span className="font-bold text-emerald-700 flex items-center space-x-1">
                <HiTruck className="w-4 h-4" />
                <span>3-5 Business Days</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
            <button
              onClick={onViewOrderDetails}
              className="w-full sm:w-1/2 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              View Order Details
            </button>
            <button
              onClick={onContinueShopping}
              className="w-full sm:w-1/2 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border border-slate-300 font-bold py-3.5 px-5 rounded-2xl shadow-xs transition-all text-xs"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
