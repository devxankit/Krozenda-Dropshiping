import React, { useState } from 'react'
import { HiArrowLeft, HiLockClosed, HiEye, HiEyeSlash } from 'react-icons/hi2'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function SignupScreen3Password({
  onBack = () => {},
  onNext = () => {},
}) {
  const [password, setPassword] = useState('password123')
  const [confirmPassword, setConfirmPassword] = useState('password123')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password && password === confirmPassword) {
      onNext(password)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Secure Your Account Credentials"
        subtitle="Set up a encrypted password to protect your store orders and wallet funds."
        tag="PASSWORD SETUP"
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
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Set Password</h2>
            <p className="text-xs text-slate-500 mt-1">
              Create a strong password to secure your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                <HiLockClosed className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  {showPassword ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex space-x-1">
                  <div className="w-1/3 bg-emerald-500 rounded-full h-full" />
                  <div className="w-1/3 bg-emerald-500 rounded-full h-full" />
                  <div className="w-1/3 bg-emerald-500 rounded-full h-full" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-600 block">
                  Strong Password
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Confirm Password
              </label>

              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                <HiLockClosed className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  {showConfirm ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide mt-2"
            >
              Continue
            </button>
          </form>
        </div>

        <BottomWaveGraphic />
      </div>
    </div>
  )
}
