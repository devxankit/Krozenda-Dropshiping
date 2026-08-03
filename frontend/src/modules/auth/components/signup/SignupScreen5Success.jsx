import React from 'react'
import { HiCheck } from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { USER_ROUTES } from '../../../../config/routes'

export function SignupScreen5Success() {
  const navigate = useNavigate()
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans text-center">
      <div className="my-auto space-y-6">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg"><HiCheck className="w-10 h-10 stroke-[3]" /></div>
        <h2 className="text-2xl font-black text-slate-900">Registration Successful!</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">Welcome to KroZenda Marketplace. Your account is ready.</p>
        <button onClick={() => navigate(USER_ROUTES.DASHBOARD)} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs">Start Shopping</button>
      </div>
    </div>
  )
}
