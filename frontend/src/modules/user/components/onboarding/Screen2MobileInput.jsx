import React, { useState } from 'react'
import { HiArrowLeft, HiShieldCheck, HiBolt, HiTag, HiEnvelope } from 'react-icons/hi2'
import { FaGoogle, FaApple } from 'react-icons/fa'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function Screen2MobileInput({
  onBack = () => {},
  onNext = () => {},
  onSwitchToRegister = () => {},
}) {
  const [phone, setPhone] = useState('98765 43210')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (phone) {
      onNext(phone)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Welcome Back to KroZenda"
        subtitle="Manage your products, track pan-India orders, and access exclusive factory supplier margin discounts."
        tag="SECURE LOGIN"
      />

      {/* RIGHT SIDE: AUTH STEP FLOW */}
      <div className="w-full md:w-[480px] lg:w-[540px] shrink-0 min-h-screen bg-white flex flex-col justify-between shadow-2xl relative">
        {/* Status Bar */}
        <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
          <span>9:41</span>
          <div className="flex items-center space-x-1.5 text-xs">
            <span>📶</span>
            <span>📡</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Header Bar with Back Arrow */}
        <div className="px-6 py-2 flex items-center">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 md:px-10 py-4 flex-1 flex flex-col items-center text-center space-y-5">
          {/* Logo */}
          <img src="/images/logo.png" alt="Krozenda Logo" className="h-14 md:h-16 w-auto object-contain" />

          {/* Titles */}
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Welcome Back!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Login to continue shopping with Krozenda
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mobile Number
              </label>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                <div className="flex items-center space-x-1 text-xs font-bold text-slate-800 border-r border-slate-200 pr-2.5 mr-2.5 shrink-0">
                  <span>🇮🇳 +91</span>
                  <span className="text-[10px] text-slate-400">∨</span>
                </div>

                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Continue
            </button>
          </form>

          {/* Or Continue With */}
          <div className="w-full max-w-sm space-y-3 pt-1">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 absolute">
                or continue with
              </span>
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button className="flex items-center justify-center p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors">
                <FaGoogle className="w-4 h-4 text-red-500" />
              </button>
              <button className="flex items-center justify-center p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors">
                <FaApple className="w-4 h-4 text-slate-900" />
              </button>
              <button className="flex items-center justify-center p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors">
                <HiEnvelope className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>

          {/* Trust Features */}
          <div className="w-full max-w-sm pt-3 space-y-2 text-left border-t border-slate-100">
            <div className="flex items-center space-x-3 text-xs">
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <HiShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Secure & Safe</h4>
                <p className="text-[10px] text-slate-400">Your data is 100% protected</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <HiBolt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Quick Login</h4>
                <p className="text-[10px] text-slate-400">Login in just a few seconds</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <HiTag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Best Deals</h4>
                <p className="text-[10px] text-slate-400">Exclusive offers for our users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Decorative Wave Graphic */}
        <BottomWaveGraphic />
      </div>
    </div>
  )
}
