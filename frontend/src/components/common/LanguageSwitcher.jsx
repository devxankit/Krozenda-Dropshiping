import { HiChevronDown, HiLanguage } from 'react-icons/hi2'
import { LANGUAGES, useLanguageStore, useTranslation } from '../../lib/i18n'

// A native <select> rather than a custom dropdown, on purpose: on Android it
// opens the OS picker, which is the control a buyer already knows, handles a
// 14-item list without a scroll trap, and reads correctly to a screen reader
// for free.
//
// Each option is labelled in its OWN script — हिन्दी, not "Hindi" — because
// someone looking for their language is scanning for letters they recognise,
// and by definition cannot be relied on to read the English name.
export function LanguageSwitcher({ className = '' }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const { t, translating } = useTranslation()

  return (
    <div className={`relative ${className}`}>
      <HiLanguage className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label={t('Change language')}
        aria-busy={translating || undefined}
        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
      >
        {LANGUAGES.map(({ code, native, label }) => (
          // Both names in the option: the native script to recognise, the
          // English one so a shared device's owner can undo someone else's pick.
          <option key={code} value={code}>
            {native}
            {native === label ? '' : ` — ${label}`}
          </option>
        ))}
      </select>
      <HiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}
