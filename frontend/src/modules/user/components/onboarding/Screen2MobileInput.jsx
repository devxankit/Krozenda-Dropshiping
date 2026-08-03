import React, { useState } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'
import { Link } from 'react-router-dom'
import { AUTH_ROUTES } from '../../../../config/routes'

export function Screen2MobileInput({ onBack = () => {}, onNext = () => {} }) {
  const [mobile, setMobile] = useState('')
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans">
      <div>
        <div className="flex items-center justify-between mb-6">
          <Link to={AUTH_ROUTES.WELCOME} className="p-2 rounded-full hover:bg-slate-200"><HiArrowLeft className="w-5 h-5" /></Link>
          <span className="text-xs font-bold text-slate-400">Step 2 of 4</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Enter Mobile Number</h2>
        <p className="text-xs text-slate-500 mb-6">We will send an OTP verification code</p>
        <input type="tel" placeholder="Enter 10-digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full p-3.5 bg-white border rounded-2xl text-xs font-bold mb-4" />
        <button onClick={() => onNext(mobile)} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Continue</button>
      </div>
    </div>
  )
}
