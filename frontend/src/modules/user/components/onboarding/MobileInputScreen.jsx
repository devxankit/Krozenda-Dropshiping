import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HiArrowLeft,
  HiShieldCheck,
  HiBolt,
  HiTag,
  HiExclamationCircle,
  HiArrowPath,
  HiXMark,
  HiArrowRight,
  HiLockClosed,
} from 'react-icons/hi2'

export function MobileInputScreen({
  onBack = () => {},
  onNext = () => {},
  initialPhone = '',
  isLoading = false,
  error = null,
  onSwitchToRegister = () => {},
}) {
  const [phone, setPhone] = useState(initialPhone || '')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [localError, setLocalError] = useState('')

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(digitsOnly)
    if (localError) setLocalError('')
  }

  const handleClearPhone = () => {
    setPhone('')
    if (localError) setLocalError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleanNumber = phone.replace(/\D/g, '')
    if (cleanNumber.length !== 10) {
      setLocalError('Please enter a valid 10-digit mobile number')
      return
    }
    if (!acceptedTerms) {
      setLocalError('Please accept the Terms & Conditions and Privacy Policy to continue')
      return
    }
    setLocalError('')
    onNext(cleanNumber)
  }

  const activeError = localError || error

  return (
    <div className="w-full h-full min-h-full bg-slate-50 flex flex-col justify-between font-sans">
      {/* App Top Bar */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95"
          aria-label="Back"
        >
          <HiArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Step 1 of 2
        </span>
      </div>

      {/* Content Body */}
      <div className="px-5 sm:px-8 py-4 flex-1 flex flex-col justify-center items-center text-center space-y-4">
        {/* Logo */}
        <img
          src="/images/logo.png"
          alt="Krozenda Logo"
          className="h-16 sm:h-20 w-auto object-contain"
        />

        {/* Titles */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Customer Sign In
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your mobile number. New users are registered automatically!
          </p>
        </div>

        {/* Error Alert */}
        {activeError && (
          <div className="w-full max-w-sm flex items-start space-x-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left animate-shake">
            <HiExclamationCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="font-medium leading-snug">{activeError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3.5 text-left">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Mobile Number
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                {phone.length}/10 digits
              </span>
            </div>

            <div className="flex items-center bg-white border border-slate-300 rounded-2xl p-2.5 sm:p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 transition-all">
              <div className="flex items-center space-x-1 text-xs font-bold text-slate-800 border-r border-slate-200 pr-2.5 mr-2.5 shrink-0 select-none">
                <span>🇮🇳 +91</span>
              </div>

              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={handlePhoneChange}
                disabled={isLoading}
                autoFocus
                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 focus:outline-none placeholder-slate-400 tracking-wider disabled:opacity-60"
              />

              {phone.length > 0 && !isLoading && (
                <button
                  type="button"
                  onClick={handleClearPhone}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full shrink-0"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="pt-0.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                id="accept-terms-mobile-screen"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  if (localError && e.target.checked) setLocalError('')
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer accent-blue-700 shrink-0 transition-all"
              />
              <span className="text-[11px] sm:text-xs text-slate-600 leading-snug group-hover:text-slate-900 transition-colors">
                I agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  className="font-bold text-blue-700 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-700 transition-colors"
                >
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  className="font-bold text-blue-700 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-700 transition-colors"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || phone.length !== 10}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold h-12 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <HiArrowPath className="w-4 h-4 animate-spin" />
                <span>Sending OTP...</span>
              </>
            ) : (
              <>
                <span>Continue with OTP</span>
                <HiArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Feature Highlight Pill */}
        <div className="w-full max-w-sm py-2 px-3 bg-blue-50/70 rounded-xl border border-blue-100 text-left flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
          <span className="text-[11px] text-blue-900 font-medium leading-tight">
            Instant OTP verification. No complex password required.
          </span>
        </div>

        {/* Trust Features Strip */}
        <div className="w-full max-w-sm pt-2 grid grid-cols-3 gap-2 border-t border-slate-200/60 text-center text-[10px] font-semibold text-slate-500">
          <div className="flex flex-col items-center space-y-1">
            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HiShieldCheck className="w-4 h-4" />
            </div>
            <span>100% Safe</span>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <HiBolt className="w-4 h-4" />
            </div>
            <span>Fast Login</span>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HiTag className="w-4 h-4" />
            </div>
            <span>Best Deals</span>
          </div>
        </div>
      </div>

      {/* Compact App Footer */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-center space-x-2 text-[10.5px] text-slate-400 shrink-0">
        <HiLockClosed className="w-3.5 h-3.5 text-emerald-600" />
        <span>256-Bit SSL Encrypted • 100% Secure</span>
      </div>
    </div>
  )
}

export default MobileInputScreen
