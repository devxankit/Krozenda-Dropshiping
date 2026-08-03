import React, { useState } from 'react'
import { HiArrowLeft, HiEnvelope } from 'react-icons/hi2'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function SignupScreen4Email({
  onBack = () => {},
  onNext = () => {},
  onSkip = () => {},
}) {
  const [email, setEmail] = useState('rahul@example.com')

  const handleSubmit = (e) => {
    e.preventDefault()
    onNext(email)
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Stay Updated with Automatic Invoicing"
        subtitle="Get instant Tax Invoices, shipping dispatch alerts, and promotional cashback codes in your inbox."
        tag="EMAIL VERIFICATION"
      />

      {/* RIGHT SIDE: AUTH STEP FLOW */}
      <div className="w-full md:w-[480px] lg:w-[540px] shrink-0 min-h-screen bg-white flex flex-col justify-between shadow-2xl relative">
        

        <div className="px-6 py-2 flex items-center">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-10 py-4 flex-1 flex flex-col items-center text-center space-y-6">
          <img src="/images/logo.png" alt="Krozenda Logo" className="h-28 md:h-32 w-auto object-contain" />

          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              Verify Email <span className="text-xs font-bold text-slate-500 block mt-0.5">(Optional)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Enter your email address to receive important updates and offers
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                <HiEnvelope className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Send Verification Link
            </button>
          </form>

          <div className="pt-2">
            <button
              onClick={onSkip}
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              Skip for Now
            </button>
          </div>
        </div>

        <BottomWaveGraphic />
      </div>
    </div>
  )
}
