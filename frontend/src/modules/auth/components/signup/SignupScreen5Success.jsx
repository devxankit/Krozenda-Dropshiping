import React from 'react'
import { HiCheck } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function SignupScreen5Success({ onComplete = () => {} }) {
  const navigate = useNavigate()

  const handleStartShopping = () => {
    onComplete()
    navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Account Ready! Welcome to KroZenda"
        subtitle="Start adding products to your catalog, managing orders, and experiencing factory wholesale margin profits."
        tag="REGISTRATION COMPLETE"
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

        <div className="px-6 md:px-10 py-8 flex-1 flex flex-col justify-center items-center text-center space-y-8">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div className="absolute top-1 left-4 w-2 h-3 bg-red-500 rounded-xs transform -rotate-12 animate-pulse" />
            <div className="absolute top-4 right-3 w-3 h-2 bg-amber-400 rounded-xs transform rotate-45" />
            <div className="absolute top-10 -left-2 w-2 h-2 bg-emerald-500 rounded-full" />
            <div className="absolute bottom-6 left-2 w-2.5 h-2 bg-blue-500 rounded-xs transform rotate-30" />
            <div className="absolute bottom-2 right-4 w-2 h-3 bg-purple-500 rounded-xs transform -rotate-45" />
            <div className="absolute top-2 right-12 w-2 h-2 bg-pink-500 rounded-full" />

            <div className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 scale-105 transition-transform">
              <HiCheck className="w-14 h-14 stroke-[3]" />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-2xl font-black text-slate-900">Registration Successful!</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Welcome to Krozenda<br />Your account has been created successfully.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3 pt-2">
            <button
              onClick={handleStartShopping}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Start Shopping
            </button>

            <button
              onClick={() => navigate(USER_ROUTES.DASHBOARD)}
              className="w-full bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-300 shadow-xs transition-all text-xs"
            >
              Go to Home
            </button>
          </div>
        </div>

        <BottomWaveGraphic />
      </div>
    </div>
  )
}
