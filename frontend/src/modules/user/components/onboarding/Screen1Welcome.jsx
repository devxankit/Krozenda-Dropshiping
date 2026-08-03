import React from 'react'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function Screen1Welcome({ onNext = () => {}, onGuest = () => {} }) {
  const navigate = useNavigate()

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE (Full width left column on Desktop) */}
      <DesktopLeftShowcase
        title="Smart Commerce for Every Business"
        subtitle="Connect directly with top factory suppliers, enjoy zero upfront inventory costs, and scale your dropshipping business pan-India."
        tag="B2B & B2C MARKETPLACE"
      />

      {/* RIGHT SIDE: AUTH STEP FLOW (Exact mobile UI inside full-height right panel) */}
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

        {/* Content Body */}
        <div className="px-6 md:px-10 pt-10 pb-6 flex-1 flex flex-col justify-center items-center text-center space-y-8">
          {/* Logo & Subtitle */}
          <div className="space-y-3">
            <div className="flex flex-col items-center">
              <img src="/images/logo.png" alt="Krozenda Logo" className="h-20 md:h-24 w-auto object-contain" />
              <span className="text-[10px] md:text-xs font-black tracking-widest text-slate-400 uppercase mt-1">
                B2B • B2C • MARKETPLACE
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-slate-900 pt-4">
              Smart Commerce<br />for Every Business
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-sm space-y-3.5 pt-4">
            <button
              onClick={onNext}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Login / Register
            </button>

            <button
              onClick={() => navigate(USER_ROUTES.DASHBOARD)}
              className="w-full bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-300 shadow-xs transition-all text-xs"
            >
              Continue as Guest
            </button>
          </div>

          {/* Terms & Privacy */}
          <p className="text-[11px] text-slate-400 max-w-xs leading-tight pt-2">
            By continuing, you agree to our{' '}
            <a href="#terms" className="text-blue-700 font-bold hover:underline">Terms & Conditions</a> and{' '}
            <a href="#privacy" className="text-blue-700 font-bold hover:underline">Privacy Policy</a>
          </p>
        </div>

        {/* Bottom Decorative Wave Graphic */}
        <BottomWaveGraphic />
      </div>
    </div>
  )
}
