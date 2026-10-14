import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TranslationContext } from './context'
import { useAuthStore } from '../authStore'
import { useLanguageStore, isRtl, DEFAULT_LANGUAGE } from './languageStore'
import { fetchTranslations, loadCache, saveCache } from './translationService'
import { restoreAll, startAutoTranslate } from './autoTranslate'

// Owns the dictionary, and drives the DOM translator that applies it.
//
// Mounted once around the buyer app. Screens underneath need no changes at
// all: autoTranslate.js walks whatever they render — including the product
// names, category titles and order statuses that arrive from the API — so
// there are no strings to wrap and nothing to keep in sync.
//
// The dictionary lives in a ref rather than in state because the DOM
// translator reads it synchronously, from a MutationObserver callback, after
// React has already committed. A `version` counter is bumped alongside every
// write so the handful of components that DO consume this context still
// re-render. Cache tiers below it: localStorage here, then Mongo and Google
// behind POST /translate.

export function TranslationProvider({ children, language: languageProp }) {
  const storeLanguage = useLanguageStore((s) => s.language)
  const adoptFromAccount = useLanguageStore((s) => s.adoptFromAccount)
  // An explicit prop wins over the store so a preview screen can be forced
  // into one language without changing what the visitor chose.
  const language = languageProp ?? storeLanguage

  // { [lang]: { [source]: translated } }
  const dictionaryRef = useRef({})
  const [version, setVersion] = useState(0)
  const [translating, setTranslating] = useState(false)
  const inFlightRef = useRef(0)
  // `${lang}\0${text}` -> the request that will resolve it. Two screens asking
  // for the same string at the same moment share one call.
  const waitingRef = useRef(new Map())

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const dictionaryFor = useCallback((lang) => {
    let dict = dictionaryRef.current[lang]
    if (!dict) {
      // Seeded from what a previous visit persisted, so a reload is already in
      // the right language on first paint instead of flashing English.
      dict = loadCache(lang)
      dictionaryRef.current[lang] = dict
    }
    return dict
  }, [])

  // Synchronous. `undefined` means "not known yet" — which is what tells the
  // DOM translator to leave the node alone and ask for it.
  //
  // Deliberately NOT keyed on `version`: it reads the ref at call time, so it
  // is always current without changing identity. Adding `version` here would
  // tear down and restart the MutationObserver — and re-walk the entire body —
  // on every batch of translations that lands.
  const lookup = useCallback(
    (text) => {
      if (language === DEFAULT_LANGUAGE) return text
      return dictionaryFor(language)[text]
    },
    [language, dictionaryFor],
  )

  // Resolves once every one of `texts` can be answered by `lookup`. Never
  // rejects: fetchTranslations maps a failure to the English source, so a
  // caller always makes progress and never loops waiting for a string that
  // will not arrive.
  const ensure = useCallback(
    (texts) => {
      if (language === DEFAULT_LANGUAGE) return Promise.resolve()

      const dict = dictionaryFor(language)
      const waits = []
      const fresh = []

      for (const text of texts) {
        if (dict[text] !== undefined) continue
        const key = `${language}:${text}`
        const existing = waitingRef.current.get(key)
        if (existing) waits.push(existing)
        else fresh.push(text)
      }

      if (fresh.length) {
        const request = fetchTranslations(fresh, language).then((translations) => {
          Object.assign(dict, translations)
          saveCache(language, dict)
          for (const text of fresh) waitingRef.current.delete(`${language}:${text}`)
          bump()
        })
        for (const text of fresh) waitingRef.current.set(`${language}:${text}`, request)
        waits.push(request)
      }

      if (!waits.length) return Promise.resolve()

      inFlightRef.current += 1
      setTranslating(true)
      return Promise.all(waits).then(() => {
        inFlightRef.current -= 1
        if (inFlightRef.current === 0) setTranslating(false)
      })
    },
    [language, dictionaryFor, bump],
  )

  // ---------------------------------------------------------------------
  // The DOM translator
  // ---------------------------------------------------------------------
  // Rooted at <body> rather than at a wrapper element so it also catches what
  // renders through a portal — modals, toasts, the bottom sheet — which are
  // siblings of the app root, not descendants. The provider only ever mounts
  // inside the buyer app, so nothing else is in the tree while it runs.
  useEffect(() => {
    const root = document.body

    // English is the source, so there is nothing to translate — but there may
    // be plenty to put BACK, if this is a switch away from another language.
    // One restore pass, then stay out of the way: no observer, no tree walks.
    if (language === DEFAULT_LANGUAGE) {
      restoreAll(root)
      return undefined
    }

    return startAutoTranslate({ root, lookup, ensure })
  }, [language, lookup, ensure])

  // ---------------------------------------------------------------------
  // The account owns the language
  // ---------------------------------------------------------------------
  // Runs on sign-in, on reload, and after a token refresh — anywhere a fresh
  // Customer lands in the auth store. `language: null` means the account has
  // never chosen, in which case whatever this device was showing is adopted
  // and saved up instead of the buyer being reset to English.
  const accountLanguage = useAuthStore((s) => s.user?.language)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (!isAuthenticated) return
    adoptFromAccount(accountLanguage ?? null)
  }, [isAuthenticated, accountLanguage, adoptFromAccount])

  // Urdu and Arabic mirror the whole layout, so this belongs on <html> once
  // rather than in every screen. `lang` also fixes font fallback and tells a
  // screen reader which voice to use.
  useEffect(() => {
    const root = document.documentElement
    const previousLang = root.lang
    const previousDir = root.dir
    root.lang = language
    root.dir = isRtl(language) ? 'rtl' : 'ltr'
    return () => {
      root.lang = previousLang
      root.dir = previousDir
    }
  }, [language])

  // ---------------------------------------------------------------------
  // t()
  // ---------------------------------------------------------------------
  // For strings that never reach the DOM as text and so cannot be picked up
  // by the walker: a document title, a string handed to a canvas, a value
  // built for an external SDK. Ordinary JSX does NOT need it — wrapping
  // rendered copy in `t()` would hand the walker a translation and invite it
  // to translate the translation.
  const pendingRef = useRef(new Set())
  const t = useCallback(
    (text) => {
      if (typeof text !== 'string' || !text) return text
      const hit = lookup(text)
      if (hit !== undefined) return hit
      pendingRef.current.add(text)
      return text
    },
    // `version` IS in the list here, unlike in `lookup`: a component that
    // called `t` and got English back has to be re-rendered once the real
    // translation arrives, and a new identity is what does that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookup, version],
  )

  // Whatever `t` collected during the pass is complete by the time this runs.
  useEffect(() => {
    if (!pendingRef.current.size) return
    const batch = [...pendingRef.current]
    pendingRef.current = new Set()
    ensure(batch)
  })

  const value = useMemo(
    () => ({ language, t, lookup, ensure, translating }),
    [language, t, lookup, ensure, translating],
  )

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}
