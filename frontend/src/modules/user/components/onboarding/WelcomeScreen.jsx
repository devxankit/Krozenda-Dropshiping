import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'
import { HiArrowRight, HiLockClosed } from 'react-icons/hi2'

export function WelcomeScreen({ onNext = () => {}, onGuest = () => {} }) {
  const navigate = useNavigate()

  const handleGuest = () => {
    if (onGuest) onGuest()
    else navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full h-full min-h-full bg-slate-50 flex flex-col justify-between font-sans">
      <div className="px-5 sm:px-8 pt-8 pb-6 flex-1 flex flex-col justify-center items-center text-center space-y-6">
        {/* Logo & Subtitle */}
        <div className="space-y-2 flex flex-col items-center">
          <img
            src="/images/logo.png"
            alt="Krozenda Logo"
            className="h-20 sm:h-24 w-auto object-contain"
          />
          <span className="text-[10px] sm:text-xs font-black tracking-widest text-slate-400 uppercase">
            B2B • B2C • MARKETPLACE
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 pt-2">
            Smart Commerce<br />for Every Business
          </h1>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Direct factory wholesale deals, real-time inventory updates, and pan-India order fulfillment.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3 pt-2">
          <button
            type="button"
            onClick={onNext}
            className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold h-12 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
          >
            <span>Sign In / Register with Mobile</span>
            <HiArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleGuest}
            className="w-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 font-bold h-12 rounded-2xl border border-slate-200 shadow-2xs transition-all text-xs"
          >
            Explore Marketplace as Guest
          </button>
        </div>

        {/* Terms & Privacy */}
        <p className="text-[11px] text-slate-400 max-w-xs leading-tight pt-1">
          By continuing, you agree to our{' '}
          <Link to="/terms" target="_blank" className="text-blue-700 font-bold hover:underline">
            Terms & Conditions
          </Link>{' '}
          and{' '}
          <Link to="/privacy-policy" target="_blank" className="text-blue-700 font-bold hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>

      <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-center space-x-2 text-[10.5px] text-slate-400 shrink-0">
        <HiLockClosed className="w-3.5 h-3.5 text-emerald-600" />
        <span>India's Leading Dropshipping Hub • 100% Secure</span>
      </div>
    </div>
  )
}

export default WelcomeScreen
