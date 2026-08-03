import React, { useState } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'

export function SignupScreen4Email({ onBack = () => {}, onNext = () => {}, onSkip = () => {} }) {
  const [email, setEmail] = useState('')
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans">
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200"><HiArrowLeft className="w-5 h-5" /></button>
          <button onClick={onSkip} className="text-xs font-bold text-slate-400">Skip</button>
        </div>
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-black text-slate-900">Add Email Address</h2>
          <p className="text-xs text-slate-500">For order updates & invoice receipts</p>
        </div>
        <input type="email" placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-white border rounded-2xl text-xs font-bold mb-4" />
        <button onClick={onNext} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Verify Email & Continue</button>
      </div>
    </div>
  )
}
