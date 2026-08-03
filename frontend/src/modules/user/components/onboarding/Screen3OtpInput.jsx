import React, { useState } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'

export function Screen3OtpInput({ phoneNumber = '98765 43210', onBack = () => {}, onVerifySuccess = () => {} }) {
  const [otp, setOtp] = useState(['', '', '', ''])
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans">
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200"><HiArrowLeft className="w-5 h-5" /></button>
          <span className="text-xs font-bold text-slate-400">Step 3 of 4</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Enter OTP</h2>
        <p className="text-xs text-slate-500 mb-6">Sent to +91 {phoneNumber}</p>
        <div className="flex justify-center space-x-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <input key={i} type="text" maxLength={1} value={otp[i]} onChange={(e) => { const n = [...otp]; n[i] = e.target.value; setOtp(n) }} className="w-12 h-12 bg-white border rounded-xl text-center font-black text-lg focus:ring-2 focus:ring-blue-600" />
          ))}
        </div>
        <button onClick={onVerifySuccess} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Verify & Continue</button>
      </div>
    </div>
  )
}
