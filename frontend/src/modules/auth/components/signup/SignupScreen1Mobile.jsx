import React, { useState } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function SignupScreen1Mobile({
  onBack = () => {},
  onNext = () => {},
  onSwitchToLogin = () => {},
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
        title="Start Your Dropshipping Empire Today"
        subtitle="Join 100,000+ business owners buying wholesale products directly from verified manufacturers."
        tag="FREE ACCOUNT REGISTRATION"
      />

      {/* RIGHT SIDE: AUTH STEP FLOW */}
      <div className="w-full md:w-[480px] lg:w-[540px] shrink-0 min-h-screen bg-white flex flex-col justify-between shadow-2xl relative">
        <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
          <span>9:41</span>
          <div className="flex items-center space-x-1.5 text-xs">
            <span>📶</span>
            <span>📡</span>
            <span>🔋</span>
          </div>
        </div>

        <div className="px-6 py-2 flex items-center">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-10 py-4 flex-1 flex flex-col items-center text-center space-y-6">
          <img src="/images/logo.png" alt="Krozenda Logo" className="h-16 md:h-18 w-auto object-contain" />

          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Create Account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your mobile number to get started
            </p>
          </div>

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
              Send OTP
            </button>
          </form>

          <div className="text-xs font-semibold text-slate-500 pt-2">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-700 font-bold hover:underline"
            >
              Login
            </button>
          </div>
        </div>

        <BottomWaveGraphic />
      </div>
    </div>
  )
}
