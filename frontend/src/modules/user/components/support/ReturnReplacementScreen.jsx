import React, { useState } from 'react'
import { HiArrowLeft, HiCheckCircle, HiShieldCheck, HiArrowPath, HiBanknotes } from 'react-icons/hi2'
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
    'Damaged Product received',
    'Defective / Electronics Not Working',
    'Wrong Item Delivered by Courier',
    'Missing Product Accessories',
    'Quality Not as Expected',
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Request Return or Replacement</h1>
              <p className="text-xs text-slate-500 mt-0.5">Submit 7-day hassle-free replacement or refund claim.</p>
            </div>
          </div>
        </div>

        {/* 2-Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Target Item Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex items-center space-x-4">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                <img src={order.image} alt={order.item} className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Order #{order.id}</span>
                <h3 className="text-sm font-bold text-slate-900">{order.item}</h3>
                <span className="text-sm font-black text-blue-700 mt-1 block">₹{order.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Request Type Selector */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">
                1. Select Action Required
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setRequestType('Replacement')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    requestType === 'Replacement'
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <HiArrowPath className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Replacement</h4>
                      <p className="text-xs text-slate-500">Free courier pickup & replacement unit</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setRequestType('Refund')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    requestType === 'Refund'
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <HiBanknotes className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Full Refund</h4>
                      <p className="text-xs text-slate-500">Refund credited back to original bank/UPI</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">
                2. Reason for Claim
              </h3>
              <div className="space-y-2.5">
                {returnReasons.map((reason) => {
                  const isSelected = selectedReason === reason
                  return (
                    <div
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected ? 'border-blue-600 bg-blue-50/40 font-bold text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs">{reason}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Claim Overview
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Request Type:</span>
                  <span className="font-bold text-blue-700">{requestType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Claim Reason:</span>
                  <span className="font-bold text-slate-900">{selectedReason}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Doorstep Pickup:</span>
                  <span className="font-bold text-emerald-600">FREE Courier Pickup</span>
                </div>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-center space-x-2 text-[11px] font-semibold text-emerald-800">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Protected by 7-Day KroZenda Buyer Guarantee</span>
              </div>

              <button
                onClick={() => onContinue({ requestType, selectedReason })}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
              >
                Submit Return Claim →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
