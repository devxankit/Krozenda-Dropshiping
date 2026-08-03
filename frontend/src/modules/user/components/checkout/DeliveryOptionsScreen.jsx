import React, { useState } from 'react'
import { HiArrowLeft, HiMapPin, HiCheck, HiTruck, HiChevronRight } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function DeliveryOptionsScreen({ onBack = () => {}, onChangeAddress = () => {}, onNext = () => {} }) {
  const [selectedOption, setSelectedOption] = useState('standard')
  const deliveryOptions = [
    { id: 'standard', title: 'Standard Delivery', tag: 'FREE', days: '3-5 Business Days', price: 0, desc: 'Reliable Pan-India Surface shipping' },
    { id: 'express', title: 'Express Air Delivery', days: '1-2 Business Days', price: 99, desc: 'Priority Air shipping with instant dispatch' },
    { id: 'sameday', title: 'Same Day Metro Express', days: 'Within 6 Hours', price: 199, desc: 'Guaranteed same-day metro delivery' },
  ]

  const activeOption = deliveryOptions.find(d => d.id === selectedOption) || deliveryOptions[0]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Responsive Checkout Stepper */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Mobile Stepper */}
          <div className="sm:hidden flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="text-blue-700 font-black">Step 2 of 4: Delivery</span>
            <span className="text-slate-400">Next: Summary</span>
          </div>

          {/* Desktop Stepper */}
          <div className="hidden sm:flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Address</span>
            </div>
            <div className="h-0.5 bg-blue-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-blue-700">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px]">2</span>
              <span className="font-black">Delivery</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">3</span>
              <span>Summary</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[11px]">4</span>
              <span>Payment</span>
            </div>
          </div>
        </div>

        {/* 2 Column Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-3">
                <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base sm:text-xl font-black text-slate-900">Choose Shipping Speed</h1>
              </div>
            </div>

            {/* Destination Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <HiMapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Delivering To</span>
                  <p className="text-xs font-bold text-slate-900 truncate">Rahul Sharma - 123, Sunrise Apartments, SG Highway, Ahmedabad</p>
                </div>
              </div>
              <button onClick={onChangeAddress} className="text-xs font-bold text-blue-600 hover:underline shrink-0 whitespace-nowrap">
                Change
              </button>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {deliveryOptions.map((item) => {
                const isSelected = selectedOption === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedOption(item.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</h4>
                            {item.tag && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-extrabold text-[9px] uppercase rounded-full">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-blue-700 mt-0.5">{item.days}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">
                        {item.price === 0 ? 'FREE' : `₹${item.price}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-md space-y-5 lg:sticky lg:top-24">
              <h3 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-3">
                Selected Shipping Option
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs">
                  <HiTruck className="w-4 h-4" />
                  <span>{activeOption.title}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{activeOption.days}</p>
                <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-bold text-slate-900">
                  <span>Shipping Fee</span>
                  <span className="text-blue-700">{activeOption.price === 0 ? 'FREE' : `₹${activeOption.price}`}</span>
                </div>
              </div>

              <button
                onClick={() => onNext({ selectedOption })}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <span>Continue to Order Summary</span>
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
