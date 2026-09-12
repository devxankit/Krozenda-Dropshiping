import React, { useState } from 'react'
import {
  HiArrowLeft,
  HiChevronRight,
  HiUser,
  HiLockClosed,
  HiBell,
  HiGlobeAlt,
  HiMoon,
  HiDocumentText,
  HiShieldCheck,
  HiQuestionMarkCircle,
  HiArrowRightOnRectangle,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { AUTH_ROUTES, USER_ROUTES } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'

export function SettingsScreen({ onBack = () => {} }) {
  const navigate = useNavigate()
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [selectedLang, setSelectedLang] = useState('English (US)')

  const accountItems = [
    { label: 'Edit Profile Information', sub: 'Name, phone number & email address', Icon: HiUser, route: USER_ROUTES.ROOT + '/profile' },
    { label: 'Change Password & Security', sub: 'Two-factor auth and active sessions', Icon: HiLockClosed, route: USER_ROUTES.ROOT + '/settings' },
  ]

  const otherItems = [
    { label: 'Terms of Service', Icon: HiDocumentText, route: '/terms' },
    { label: 'Privacy Policy', Icon: HiShieldCheck, route: '/privacy-policy' },
    { label: 'Help & Customer Support', Icon: HiQuestionMarkCircle, route: USER_ROUTES.ROOT + '/support' },
    { label: 'Log Out of Account', Icon: HiArrowRightOnRectangle, route: AUTH_ROUTES.LOGIN, isLogout: true },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-12 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">App Settings</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage notifications, language, security, and account preferences.</p>
            </div>
          </div>
        </div>

        {/* 3-Section Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Section 1: Account Settings */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 px-1">Account & Security</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {accountItems.map(({ label, sub, Icon, route }) => (
                <div
                  key={label}
                  onClick={() => navigate(route)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{label}</span>
                      <span className="text-[10px] text-slate-400 font-medium block truncate">{sub}</span>
                    </div>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 px-1">Preferences</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {/* Push Notifications Toggle */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Push Notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Email Alerts Toggle */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Email Order Alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Language Selector */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <HiGlobeAlt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">App Language</span>
                </div>
                <span className="text-xs font-bold text-blue-600">{selectedLang}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Legal & Support */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 px-1">Others</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {otherItems.map(({ label, Icon, route, isLogout }) => (
                <div
                  key={label}
                  onClick={() => {
                    if (isLogout) {
                      useAuthStore.getState().clearSession()
                    }
                    navigate(route)
                  }}
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

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar />
      </div>
    </div>
  )
}
