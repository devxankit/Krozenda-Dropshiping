import React, { useState } from 'react'
import { HiArrowLeft, HiShieldCheck, HiCreditCard, HiBuildingLibrary, HiQrCode, HiWallet, HiChevronRight } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'

export function PaymentScreen({ amount = 49347, onBack = () => {}, onPaymentSuccess = () => {} }) {
  const [selectedMethod, setSelectedMethod] = useState('upi')

  const paymentMethods = [
    { id: 'upi', name: 'Google Pay / PhonePe / Paytm UPI', icon: HiQrCode, tag: 'Instant Discount ₹50', badge: 'RECOMMENDED' },
    { id: 'card', name: 'Credit / Debit Card (Visa, MasterCard, RuPay)', icon: HiCreditCard },
    { id: 'netbanking', name: 'Net Banking (All Major Indian Banks)', icon: HiBuildingLibrary },
    { id: 'wallet', name: 'Wallets (Paytm, Mobikwik, Amazon Pay)', icon: HiWallet },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Responsive Stepper */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Mobile Stepper */}
          <div className="sm:hidden flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="text-blue-700 font-black">Step 4 of 4: Payment</span>
            <span className="text-emerald-600 font-bold">Final Step</span>
          </div>

          {/* Desktop Stepper */}
          <div className="hidden sm:flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Address</span>
            </div>
            <div className="h-0.5 bg-emerald-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Delivery</span>
            </div>
            <div className="h-0.5 bg-emerald-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-emerald-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">✓</span>
              <span>Summary</span>
            </div>
            <div className="h-0.5 bg-blue-600 flex-1 mx-3" />
            <div className="flex items-center space-x-2 text-blue-700">
              <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px]">4</span>
              <span className="font-black">Payment</span>
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
                <h1 className="text-base sm:text-xl font-black text-slate-900">Select Payment Method</h1>
              </div>
            </div>

            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const IconComponent = method.icon
                const isSelected = selectedMethod === method.id
                return (
                  <div
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">{method.name}</h4>
                            {method.badge && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[9px] uppercase rounded-full">
                                {method.badge}
                              </span>
                            )}
                          </div>
                          {method.tag && <p className="text-xs font-semibold text-emerald-600 mt-0.5">{method.tag}</p>}
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
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
                Payment Summary
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Grand Total</span>
                  <span className="text-sm font-black text-blue-700">₹{amount.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Inclusive of all taxes & GST invoice</p>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-center space-x-2 text-[11px] font-semibold text-emerald-800">
                <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>256-Bit SSL Encrypted 100% Safe Payment Gateway</span>
              </div>

              <button
                onClick={onPaymentSuccess}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
              >
                <span>Pay ₹{amount.toLocaleString('en-IN')} Now</span>
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
