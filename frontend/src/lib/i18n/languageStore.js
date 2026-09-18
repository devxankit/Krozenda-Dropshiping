// The chosen UI language, persisted per device.
//
// Deliberately separate from the translation cache and the provider: the
// choice belongs to the visitor and has to survive a reload and a sign-out,
// while the cache is disposable and the provider is per-tree. Keeping it in
// its own store also means a screen can read the language without subscribing
// to translation state and re-rendering on every batch that lands.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Kept in sync with SUPPORTED_LANGUAGES in backend/services/translationService.js,
// which is the source of truth — GET /translate/languages serves it. This copy
// exists so the switcher can render instantly on first paint instead of waiting
// on a round trip, and so an unrecognised persisted value can be rejected.
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', label: 'Urdu', native: 'اردو' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
])

export const DEFAULT_LANGUAGE = 'en'

// Urdu and Arabic read right to left. The provider sets dir/lang on <html> from
// this so the whole layout mirrors, rather than each screen handling it.
const RTL = new Set(['ur', 'ar'])

const CODES = new Set(LANGUAGES.map((l) => l.code))

export const isRtl = (code) => RTL.has(code)
export const languageLabel = (code) => LANGUAGES.find((l) => l.code === code)?.native ?? code

export const useLanguageStore = create(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      // A code that is no longer offered (list trimmed, value hand-edited in
      // devtools) falls back to English instead of pinning the app to a
      // language the API will reject on every request.
      setLanguage: (code) => set({ language: CODES.has(code) ? code : DEFAULT_LANGUAGE }),
    }),
    {
      name: 'krozenda.language',
      // storage.clearAll() wipes this on sign-out along with everything else on
      // the origin. That is correct: the next person on a shared device should
      // get the default, not inherit the last visitor's language.
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state && !CODES.has(state.language)) state.language = DEFAULT_LANGUAGE
      },
    },
  ),
)
