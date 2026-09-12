import React from 'react'
import { HiArrowLeft, HiShieldCheck, HiSparkles, HiShoppingBag, HiLockClosed } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'

export function OtpVerifiedScreen({ onNext = () => {}, user = null, isNewUser = false }) {
  const navigate = useNavigate()

  const handleProceed = () => {
    if (onNext) {
      onNext()
    } else {
      navigate(USER_ROUTES.DASHBOARD)
    }
  }

  const displayName = user?.name || (user?.mobileNumber ? `Customer ${user.mobileNumber.slice(-4)}` : 'Customer')
  const displayPhone = user?.mobileNumber || user?.phone || ''

  return (
    <div className="w-full h-full min-h-full bg-slate-50 flex flex-col justify-between font-sans">
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={handleProceed}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95"
          aria-label="Proceed"
        >
          <HiArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
          Verified
        </span>
      </div>

      <div className="px-5 sm:px-8 py-6 flex-1 flex flex-col justify-center items-center text-center space-y-5">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/30 transform rotate-3 hover:rotate-0 transition-transform">
            <HiShieldCheck className="w-12 h-12 text-white" />
          </div>
        </div>

        <div className="space-y-2 max-w-xs">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
            {isNewUser ? (
              <>
                <HiSparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>New Customer Registered</span>
              </>
            ) : (
              <>
                <HiShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Welcome Back</span>
              </>
            )}
          </div>

          <h2 className="text-2xl font-black text-slate-900">
            {isNewUser ? 'Welcome to KroZenda!' : `Welcome Back, ${displayName}!`}
          </h2>

          <p className="text-xs text-slate-500 leading-relaxed">
            {displayPhone ? (
              <>
                Verified mobile:{' '}
                <strong className="text-slate-800 font-semibold">+91 {displayPhone}</strong>
              </>
            ) : (
              'Your number has been successfully verified.'
            )}
          </p>
        </div>

        <div className="w-full max-w-sm pt-2">
          <button
            type="button"
            onClick={handleProceed}
            className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold h-12 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
          >
            <HiShoppingBag className="w-4 h-4" />
            <span>Continue to Shopping & Orders</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-center space-x-2 text-[10.5px] text-slate-400 shrink-0">
        <HiLockClosed className="w-3.5 h-3.5 text-emerald-600" />
        <span>100% Verified Customer Session</span>
      </div>
    </div>
  )
}

export default OtpVerifiedScreen
