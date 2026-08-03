import React, { useState } from 'react'
import { HiArrowLeft, HiDevicePhoneMobile } from 'react-icons/hi2'
import { Link } from 'react-router-dom'
import { AUTH_ROUTES } from '../../../../config/routes'

export function SignupScreen1Mobile({ onNext = () => {} }) {
  const [phone, setPhone] = useState('')

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans">
      <div>
        <div className="flex items-center justify-between mb-6">
          <Link to={AUTH_ROUTES.WELCOME} className="p-2 rounded-full hover:bg-slate-200 text-slate-700">
            <HiArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs font-bold text-slate-400">Step 1 of 5</span>
        </div>

        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-3">
            <HiDevicePhoneMobile className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Create Account</h2>
          <p className="text-xs text-slate-500">Enter your mobile number to get started</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center bg-white border border-slate-300 rounded-2xl p-3 shadow-xs">
            <span className="text-xs font-bold text-slate-700 border-r border-slate-200 pr-3 mr-3">+91</span>
            <input
              type="tel"
              placeholder="Enter 10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>

          <button onClick={() => onNext(phone)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs shadow-md">
            Continue & Get OTP
          </button>
        </div>
      </div>

      <div className="text-center text-xs font-semibold text-slate-500 pt-4">
        Already have an account?{' '}
        <Link to={AUTH_ROUTES.LOGIN} className="text-blue-600 font-bold hover:underline">
          Login
        </Link>
      </div>
    </div>
  )
}
