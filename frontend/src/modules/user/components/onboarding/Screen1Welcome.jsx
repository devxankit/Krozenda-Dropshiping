import React from 'react'
import { Link } from 'react-router-dom'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function Screen1Welcome({ onNext = () => {} }) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between p-6 text-slate-800 font-sans text-center">
      <div className="my-auto space-y-6">
        <img src="/images/logo.png" alt="KroZenda Logo" className="h-16 w-auto mx-auto object-contain" />
        <div>
          <h1 className="text-2xl font-black text-slate-900">Welcome to KroZenda</h1>
          <p className="text-xs text-slate-500 mt-2">India's leading B2B & B2C Dropshipping Marketplace</p>
        </div>
        <div className="space-y-3">
          <Link to={AUTH_ROUTES.LOGIN} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs block shadow-md">
            Login to Account
          </Link>
          <Link to={AUTH_ROUTES.REGISTER} className="w-full bg-white hover:bg-slate-100 text-blue-600 font-bold py-3.5 rounded-xl text-xs block border border-blue-600">
            Create New Account
          </Link>
          <Link to={USER_ROUTES.DASHBOARD} className="text-xs font-semibold text-slate-500 hover:underline block pt-2">
            Continue as Guest →
          </Link>
        </div>
      </div>
    </div>
  )
}
