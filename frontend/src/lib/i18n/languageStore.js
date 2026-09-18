// The chosen UI language, for whichever panel is open.
//
// The ACCOUNT owns it, not the device — `Customer.language` for a buyer,
// `User.language` for an admin or staff member, `Vendor.language` for a seller
// or dropshipping partner. That field is what persists;
// localStorage is a render cache in front of it so the first paint after a
// reload is already in the right language instead of flashing English while
// /auth/me comes back. That means the choice follows a buyer to a new phone,
// survives a reinstall, and — the actual requirement — never changes on its
// own. Nothing here infers a language from the browser or the locale: it
// changes when the buyer changes it, and at no other time.
//
// A signed-out visitor has no account to write to, so for them localStorage is
// all there is. What they picked is carried INTO the account on sign-in if
// that account has never had a language of its own (`language: null`).
//
// One store, not one per panel: only one panel is open at a time, and the
// account behind it is whoever is signed in.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../axios'
import { useAuthStore } from '../authStore'

// Kept in sync with SUPPORTED_LANGUAGES in backend/services/translationService.js,
// which is the source of truth — GET /translate/languages serves it. This copy
// exists so the switcher can render instantly on first paint instead of waiting
// on a round trip, and so an unrecognised persisted value can be rejected.
// `short` is what the header button shows — the native name clipped to a
// couple of glyphs, not the ISO code, so the control is recognisable to
// someone who cannot read the Latin alphabet. The full native name is one tap
// away in the picker.
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English', native: 'English', short: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', short: 'हिं' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', short: 'বাং' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', short: 'मरा' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', short: 'తెలు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', short: 'தமி' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', short: 'ગુજ' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', short: 'ಕನ್ನ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', short: 'മല' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', short: 'ਪੰਜ' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ', short: 'ଓଡ଼ି' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া', short: 'অস' },
  { code: 'ur', label: 'Urdu', native: 'اردو', short: 'اردو' },
  { code: 'ar', label: 'Arabic', native: 'العربية', short: 'عربي' },
])

export const DEFAULT_LANGUAGE = 'en'

// Urdu and Arabic read right to left. The provider sets dir/lang on <html> from
// this so the whole layout mirrors, rather than each screen handling it.
const RTL = new Set(['ur', 'ar'])

const CODES = new Set(LANGUAGES.map((l) => l.code))

export const isRtl = (code) => RTL.has(code)
export const isSupportedLanguage = (code) => CODES.has(code)
export const languageLabel = (code) => LANGUAGES.find((l) => l.code === code)?.native ?? code
export const languageShort = (code) => LANGUAGES.find((l) => l.code === code)?.short ?? code.toUpperCase()

// Buyers, admins/staff and vendors live in three separate collections behind
// three separate auth middlewares, so each panel has its own endpoint. Which
// one to call is decided by PERMISSION, not by role name or by the URL: the
// admin panel's roles are role NAMES ('super_admin', or whatever a staff role
// was called), so matching on them would break the moment someone adds a role,
// whereas `admin.access` and `vendor.access` are the same stable keys RoleGuard
// already gates these panels on.
function languageEndpoint() {
  const { permissions } = useAuthStore.getState()
  if (permissions.includes('admin.access')) return '/admin/auth/language'
  // Sellers and dropshipping partners are two front-ends over one Vendor
  // account, and both carry vendor.access.
  if (permissions.includes('vendor.access')) return '/vendor/auth/language'
  return '/auth/language'
}

// Fire-and-forget. A failed write is not worth a toast: the switch has already
// taken effect on screen and in localStorage, and the next successful change
// (or the next sign-in from a device that did save) reconciles it. Surfacing an
// error here would be alarming out of all proportion to what was lost.
function pushToAccount(code) {
  if (!useAuthStore.getState().isAuthenticated) return
  api.put(languageEndpoint(), { language: code }).then(
    () => {
      // Keep the cached user in step so a reload does not read a stale
      // language off localStorage and bounce the UI back.
      const user = useAuthStore.getState().user
      if (user) useAuthStore.getState().setUser({ ...user, language: code })
    },
    () => {},
  )
}

export const useLanguageStore = create(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,

      // The buyer tapped the switcher. Applies immediately and writes through
      // to the account in the background.
      setLanguage: (code) => {
        const next = CODES.has(code) ? code : DEFAULT_LANGUAGE
        if (next === get().language) return
        set({ language: next })
        pushToAccount(next)
      },

      // Called when a session lands (sign-in, reload, token refresh) with
      // whatever `Customer.language` holds.
      //
      //   a code  -> the account has chosen; it wins, full stop
      //   null    -> the account has never chosen, so adopt what this device
      //              was already showing and save it up
      adoptFromAccount: (accountLanguage) => {
        if (accountLanguage && CODES.has(accountLanguage)) {
          if (accountLanguage !== get().language) set({ language: accountLanguage })
          return
        }
        if (!accountLanguage) pushToAccount(get().language)
      },
    }),
    {
      name: 'krozenda.language',
      // storage.clearAll() wipes this on sign-out along with everything else on
      // the origin. That is correct: the next person on a shared device should
      // get the default, not inherit the last visitor's language — and the
      // real copy is on the account, so signing back in restores it.
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state && !CODES.has(state.language)) state.language = DEFAULT_LANGUAGE
      },
    },
  ),
)
