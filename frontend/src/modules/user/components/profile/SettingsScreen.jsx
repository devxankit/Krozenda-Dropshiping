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
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'

export function SettingsScreen({
  onBack = () => {},
}) {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)

  const accountItems = [
    { label: 'Personal Information', Icon: HiUser, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Change Password', Icon: HiLockClosed, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Manage Addresses', Icon: HiMapPin, route: USER_ROUTES.ROOT + '/profile/addresses' },
    { label: 'Saved Cards', Icon: HiCreditCard, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Notifications', Icon: HiBell, route: USER_ROUTES.ROOT + '/notifications' },
  ]

  const otherItems = [
    { label: 'Help & Support', Icon: HiQuestionMarkCircle, route: USER_ROUTES.ROOT + '/support' },
    { label: 'Privacy Policy', Icon: HiShieldCheck, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Terms & Conditions', Icon: HiDocumentText, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Logout', Icon: HiArrowRightOnRectangle, route: AUTH_ROUTES.LOGIN, isLogout: true },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        
        <div className="md:hidden">
          
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Settings</h2>
          </div>
        </div>

        {/* Settings Body */}
        <div className="p-4 space-y-5">
          {/* Account Group */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider px-1">
              Account
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
              {accountItems.map((item, idx) => {
                const IconComp = item.Icon

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(item.route)}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <IconComp className="w-5 h-5 text-slate-700 shrink-0" />
                      <span className="text-xs font-bold text-slate-800">{item.label}</span>
                    </div>

                    <HiChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preferences Group */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider px-1">
              Preferences
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
              {/* Language */}
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <HiGlobeAlt className="w-5 h-5 text-slate-700 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Language</span>
                </div>

                <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500">
                  <span>English</span>
                  <HiChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Currency */}
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <HiCurrencyRupee className="w-5 h-5 text-slate-700 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Currency</span>
                </div>

                <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500">
                  <span>INR (₹)</span>
                  <HiChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Dark Mode */}
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <HiMoon className="w-5 h-5 text-slate-700 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Dark Mode</span>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                    darkMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Others Group */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider px-1">
              Others
            </h3>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
              {otherItems.map((item, idx) => {
                const IconComp = item.Icon

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(item.route)}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <IconComp
                        className={`w-5 h-5 shrink-0 ${
                          item.isLogout ? 'text-red-500' : 'text-slate-700'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold ${
                          item.isLogout ? 'text-red-600' : 'text-slate-800'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    <HiChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
