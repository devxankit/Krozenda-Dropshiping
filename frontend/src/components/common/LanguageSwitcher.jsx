import { HiChevronDown, HiLanguage } from 'react-icons/hi2'
import { LANGUAGES, languageShort, useLanguageStore, useTranslation } from '../../lib/i18n'

// A native <select> in both variants, on purpose: on Android it opens the OS
// picker, which is the control a buyer already knows, handles a 14-item list
// without a scroll trap, and reads correctly to a screen reader for free. The
// compact variant keeps that select — full size, just invisible — layered over
// the button, rather than reimplementing a dropdown.
//
// Each option is labelled in its OWN script — हिन्दी, not "Hindi" — because
// someone looking for their language is scanning for letters they recognise,
// and by definition cannot be relied on to read the English name. <option> is
// on the DOM translator's skip list so these names are never themselves
// translated into the language being switched away from.

function Spinner({ className }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 ${className}`}
    />
  )
}

function Options() {
  return LANGUAGES.map(({ code, native, label }) => (
    // Both names in the option: the native script to recognise, the English
    // one so a shared device's owner can undo someone else's pick.
    <option key={code} value={code}>
      {native}
      {native === label ? '' : ` — ${label}`}
    </option>
  ))
}

// The buyer app is styled on the slate palette; the admin and vendor panels are
// styled on the design tokens. Same control, two skins — rather than two
// components that would drift apart.
const COMPACT_TONES = {
  buyer: {
    chrome: 'rounded-xl border-slate-200/80 bg-slate-50 text-slate-700',
    chevron: 'text-slate-400',
  },
  panel: {
    chrome: 'rounded-md border-border bg-surface-muted text-ink-subtle hover:border-border-strong',
    chevron: 'text-ink-faint',
  },
}

export function LanguageSwitcher({ className = '', variant = 'field', tone = 'buyer' }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const { translating } = useTranslation()

  if (variant === 'compact') {
    const skin = COMPACT_TONES[tone] ?? COMPACT_TONES.buyer
    return (
      <div className={`relative shrink-0 ${className}`}>
        <div
          className={`pointer-events-none flex items-center gap-1 border px-2 py-1.5 transition-colors ${skin.chrome}`}
        >
          {translating ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <HiLanguage className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {/* Marked off from the DOM translator: this is the name of a
              language, not copy about one. Translating it would render the
              current language's own label in that same language. */}
          <span data-no-translate className="text-[11px] font-black leading-none">
            {languageShort(language)}
          </span>
          <HiChevronDown className={`h-3 w-3 shrink-0 ${skin.chevron}`} aria-hidden="true" />
        </div>
        {/* The real control, invisible but full size on top, so the tap target
            is the button and the picker is still the platform's own. */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Change language"
          aria-busy={translating || undefined}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:opacity-100"
        >
          <Options />
        </select>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <HiLanguage className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Change language"
        aria-busy={translating || undefined}
        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
      >
        <Options />
      </select>
      {/* Swapped for a spinner while a batch is in flight, so a switch on a
          slow connection reads as working rather than as nothing happening. */}
      {translating ? (
        <Spinner className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      ) : (
        <HiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
    </div>
  )
}
