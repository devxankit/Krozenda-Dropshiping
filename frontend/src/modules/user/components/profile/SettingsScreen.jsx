import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiUser,
  HiLockClosed,
  HiMapPin,
  HiCreditCard,
  HiBell,
  HiGlobeAlt,
  HiCurrencyRupee,
  HiMoon,
  HiQuestionMarkCircle,
  HiShieldCheck,
  HiDocumentText,
  HiArrowRightOnRectangle,
  HiChevronRight,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function SettingsScreen({ onBack = () => {} }) {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)

  const accountItems = [
    { label: 'Personal Information', Icon: HiUser, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Change Password', Icon: HiLockClosed, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Manage Addresses', Icon: HiMapPin, route: USER_ROUTES.ROOT + '/profile/addresses' },
    { label: 'Saved Cards', Icon: HiCreditCard, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Notifications', Icon: HiBell, route: USER_ROUTES.ROOT + '/notifications' },
  ]

  const preferenceItems = [
    { label: 'Language', Icon: HiGlobeAlt, value: 'English' },
    { label: 'Currency', Icon: HiCurrencyRupee, value: 'INR (₹)' },
  ]

  const otherItems = [
    { label: 'Help & Support', Icon: HiQuestionMarkCircle, route: USER_ROUTES.ROOT + '/support' },
    { label: 'Privacy Policy', Icon: HiShieldCheck, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Terms & Conditions', Icon: HiDocumentText, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Logout', Icon: HiArrowRightOnRectangle, route: AUTH_ROUTES.LOGIN, isLogout: true },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">Settings</h1>
              <p className="text-xs text-slate-500 hidden sm:block">Manage your account credentials, preferences and support</p>
            </div>
          </div>
        </div>

        {/* Responsive Grid Layout (3 Columns on Desktop, Stacked Cards on Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Section 1: Account */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 px-1">Account</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {accountItems.map(({ label, Icon, route }) => (
                <div
                  key={label}
                  onClick={() => navigate(route)}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">{label}</span>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 px-1">Preferences</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {preferenceItems.map(({ label, Icon, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">{label}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500">
                    <span>{value}</span>
                    <HiChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              ))}

              {/* Dark Mode Toggle Item */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center space-x-3">
                  <HiMoon className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">Dark Mode</span>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                    darkMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      darkMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Others */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 px-1">Others</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {otherItems.map(({ label, Icon, route, isLogout }) => (
                <div
                  key={label}
                  onClick={() => navigate(route)}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isLogout ? 'text-red-500' : 'text-slate-600'}`} />
                    <span className={`text-xs font-semibold ${isLogout ? 'text-red-500 font-bold' : 'text-slate-800'}`}>
                      {label}
                    </span>
                  </div>
                  <HiChevronRight className={`w-4 h-4 shrink-0 ${isLogout ? 'text-red-400' : 'text-slate-400'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
