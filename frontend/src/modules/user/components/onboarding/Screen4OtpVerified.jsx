import React from 'react'
import { HiArrowLeft, HiShieldCheck } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function Screen4OtpVerified({ onNext = () => {} }) {
  const navigate = useNavigate()

  const handleProceed = () => {
    onNext()
    navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Verification Complete! Ready to Trade"
        subtitle="Access live wholesale catalogs, real-time inventory updates, and pan-India order execution."
        tag="AUTHENTICATED"
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
            onClick={handleProceed}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-10 py-8 flex-1 flex flex-col justify-center items-center text-center space-y-8">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div className="absolute top-2 left-4 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <div className="absolute top-6 right-2 w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="absolute bottom-4 left-2 w-2 h-2 rounded-full bg-emerald-400" />
            <div className="absolute bottom-2 right-6 w-3 h-3 rounded-full bg-blue-400" />

            <div className="w-28 h-28 bg-gradient-to-tr from-blue-600 to-blue-500 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform">
              <HiShieldCheck className="w-16 h-16 text-white" />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-2xl font-black text-slate-900">OTP Verified!</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your number has been successfully verified.
            </p>
          </div>

          <div className="w-full max-w-sm pt-4">
            <button
              onClick={handleProceed}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Continue
            </button>
          </div>
        </div>

        <div className="pb-8" />
      </div>
    </div>
  )
}
