import {
  HiArrowLeft,
  HiChevronRight,
  HiDocumentText,
  HiShieldCheck,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'

// Note there is no `t()` anywhere below, and there does not need to be: the
// provider mounted in modules/user/routes.jsx translates the rendered DOM, so
// the copy here is written in plain English exactly as it always was. Wrapping
// it would actually be wrong — the walker would then find a translation where
// it expected a source, and try to translate that.
export function SettingsScreen({ onBack }) {
  // Falls back to real navigation when no callback is supplied. The
  // router stopped passing one when every screen took ownership of its
  // own navigation; the previous `= () => {}` default silently turned
  // the back button into a no-op.

  const navigate = useNavigate()
  const handleBack = onBack || (() => navigate(-1))

  const settingsOptions = [
    {
      id: 'privacy-policy',
      label: 'Privacy Policy',
      description: 'Learn how your data, privacy, and personal information are protected',
      Icon: HiShieldCheck,
      iconColor: 'bg-emerald-50 text-emerald-600',
      action: () => navigate('/privacy-policy'),
    },
    {
      id: 'terms-conditions',
      label: 'Terms & Conditions',
      description: 'Review our platform marketplace rules, terms, and usage agreements',
      Icon: HiDocumentText,
      iconColor: 'bg-indigo-50 text-indigo-600',
      action: () => navigate('/terms'),
    },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="sticky top-0 z-50 hidden md:block">
        <WebHeader />
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 md:py-8 pb-28 md:pb-12 space-y-5">
        {/* Header Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={handleBack}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Back"
            >
              <HiArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900">Settings</h1>
              <p className="text-xs text-slate-500 mt-0.5">Language, privacy policy and terms &amp; conditions</p>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-black text-slate-900 block">Language</span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium block mt-0.5">
                Saved to your account, on every device, until you change it
              </span>
            </div>
            {/* An explicit, reserved slot so the row does not reflow when a
                longer language name replaces a shorter one. */}
            <LanguageSwitcher className="w-40 shrink-0 sm:w-48" />
          </div>
        </div>

        {/* The 2 Only Settings Options */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {settingsOptions.map(({ id, label, description, Icon, iconColor, action }) => (
            <div
              key={id}
              onClick={action}
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 cursor-pointer transition-colors group"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl ${iconColor} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-slate-900 block group-hover:text-blue-600 transition-colors">
                    {label}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400 font-medium block truncate mt-0.5">
                    {description}
                  </span>
                </div>
              </div>
              <HiChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2 rtl:rotate-180" />
            </div>
          ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}
