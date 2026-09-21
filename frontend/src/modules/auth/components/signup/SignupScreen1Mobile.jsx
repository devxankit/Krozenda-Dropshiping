import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { HiArrowLeft } from 'react-icons/hi2'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'
import { sanitizeIndianPhoneNumber } from '../../../../lib/phoneUtils'

export function SignupScreen1Mobile({
  onBack = () => {},
  onNext = () => {},
  onSwitchToLogin = () => {},
}) {
  const [phone, setPhone] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleanNumber = phone.replace(/\D/g, '')
    if (cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue')
      return
    }
    setError('')
    onNext(cleanNumber)
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
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Create Account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your mobile number to get started
            </p>
          </div>

          {error && (
            <div className="w-full max-w-sm p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mobile Number
              </label>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                <div className="flex items-center space-x-1 text-xs font-bold text-slate-800 border-r border-slate-200 pr-2.5 mr-2.5 shrink-0">
                  <span>🇮🇳 +91</span>
                </div>

                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={16}
                  placeholder="Enter mobile number"
                  value={phone}
                  onChange={(e) => {
                    const val = sanitizeIndianPhoneNumber(e.target.value)
                    setPhone(val)
                    if (error) setError('')
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    const pasted = e.clipboardData?.getData('text') || ''
                    const val = sanitizeIndianPhoneNumber(pasted)
                    setPhone(val)
                    if (error) setError('')
                  }}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
                />
              </div>
            </div>

            {/* Terms & Privacy Policy Agreement Checkbox */}
            <div className="pt-0.5 pb-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  id="signup-accept-terms"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked)
                    if (error && e.target.checked) setError('')
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer accent-blue-700 shrink-0 transition-all"
                />
                <span className="text-xs text-slate-600 leading-snug group-hover:text-slate-900 transition-colors">
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
              disabled={phone.length !== 10}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
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
