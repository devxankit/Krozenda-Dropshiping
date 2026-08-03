import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiCheckCircle,
  HiExclamationTriangle,
  HiShieldCheck,
  HiCheck,
} from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function ReturnReplacementScreen({
  order = {
    id: 'KRO1234567890',
    date: 'Delivered on 15 May 2024',
    item: 'Samsung Galaxy S23 5G (128GB, Phantom Black)',
    price: 49999,
    image: '/images/samsung_s23.png',
  },
  onBack = () => {},
  onContinue = () => {},
}) {
  const [selectedReason, setSelectedReason] = useState('Damaged Product')
  const [requestType, setRequestType] = useState('Replacement')

  const returnReasons = [
    'Damaged Product',
    'Defective / Not Working',
    'Wrong Item Delivered',
    'Missing Accessories',
    'Quality Not as Expected',
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        
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
            <h2 className="text-base font-bold text-slate-900">Return / Replacement</h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Policy Summary Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center space-x-3 text-xs text-emerald-800">
            <HiShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold">7-Day Free Replacement Guarantee</h4>
              <p className="text-[11px] text-emerald-700">
                Eligible for instant door-step replacement or full refund to wallet.
              </p>
            </div>
          </div>

          {/* Selected Product Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Item to Return ({order.date})
            </span>

            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-slate-50 rounded-xl p-1.5 shrink-0 flex items-center justify-center border border-slate-100">
                <img src={order.image} alt={order.item} className="w-full h-full object-contain" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-900 leading-snug">{order.item}</h3>
                <span className="text-xs font-black text-slate-900 mt-1 inline-block">
                  ₹{order.price.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Request Type Selector */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Select Option
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setRequestType('Replacement')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  requestType === 'Replacement'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <h4 className="text-xs font-bold text-slate-900">Replacement</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Deliver a new unit</p>
              </div>

              <div
                onClick={() => setRequestType('Refund')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  requestType === 'Refund'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <h4 className="text-xs font-bold text-slate-900">Refund</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Refund to original source</p>
              </div>
            </div>
          </div>

          {/* Reason Selection List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Reason for Return
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs divide-y divide-slate-100">
              {returnReasons.map((reason, idx) => {
                const isSelected = selectedReason === reason
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedReason(reason)}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-800">{reason}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <HiCheck className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50 max-w-3xl mx-auto">
        <button
          onClick={() => onContinue({ requestType, selectedReason })}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide"
        >
          Submit Request
        </button>
      </div>
    </div>
  )
}
