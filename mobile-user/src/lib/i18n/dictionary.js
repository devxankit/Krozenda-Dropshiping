// Runtime translation dictionary. The web app walks the DOM and swaps text nodes; here every
// <Text> from components/ui/Text looks its string up through this store, so API-supplied copy
// (product names, statuses...) is covered too. Transport: POST /translate { to, texts }.
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../axios'
import { useLanguageStore, DEFAULT_LANGUAGE } from './languageStore'

const CACHE_PREFIX = 'krozenda.i18n.v1.'
const MAX_PER_REQUEST = 200

export const useDictionary = create(() => ({ dict: {} }))

const loaded = new Set()
const pending = new Map() // lang -> Set(text)
const inflight = new Set() // `${lang}\0${text}`
let timer = null

async function loadLang(lang) {
  if (loaded.has(lang)) return
  loaded.add(lang)
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + lang)
    if (raw) {
      useDictionary.setState((s) => ({
        dict: { ...s.dict, [lang]: { ...JSON.parse(raw), ...(s.dict[lang] || {}) } },
      }))
    }
  } catch {
    // Corrupt cache - start cold.
  }
}

async function flush() {
  timer = null
  for (const [lang, set] of [...pending]) {
    const texts = [...set]
    pending.delete(lang)
    for (let i = 0; i < texts.length; i += MAX_PER_REQUEST) {
      const batch = texts.slice(i, i + MAX_PER_REQUEST)
      let merged = {}
      try {
        const { data } = await api.post('/translate', { to: lang, texts: batch })
        merged = data?.data?.translations ?? {}
      } catch {
        // Fall back to English and stop re-asking this session.
        for (const t of batch) merged[t] = t
      }
      for (const t of batch) inflight.delete(`${lang}\0${t}`)
      useDictionary.setState((s) => {
        const next = { ...(s.dict[lang] || {}), ...merged }
        AsyncStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(next)).catch(() => {})
        return { dict: { ...s.dict, [lang]: next } }
      })
    }
  }
}

function requestTranslation(lang, text) {
  const key = `${lang}\0${text}`
  if (inflight.has(key)) return
  inflight.add(key)
  if (!pending.has(lang)) pending.set(lang, new Set())
  pending.get(lang).add(text)
  if (!timer) timer = setTimeout(flush, 60)
}

const HAS_LETTER = /\p{L}/u

// Translation of `text` for the active language (the source text while it is on its way).
export function useTranslated(text) {
  const lang = useLanguageStore((s) => s.language)
  const translated = useDictionary((s) => s.dict[lang]?.[text])
  if (lang === DEFAULT_LANGUAGE || typeof text !== 'string' || !HAS_LETTER.test(text)) return text
  loadLang(lang)
  if (translated === undefined) {
    requestTranslation(lang, text)
    return text
  }
  return translated
}

// Imperative form for placeholders / alerts: const t = useT(); t('Search').
export function useT() {
  const lang = useLanguageStore((s) => s.language)
  const dict = useDictionary((s) => s.dict[lang])
  return (text) => {
    if (lang === DEFAULT_LANGUAGE || typeof text !== 'string' || !HAS_LETTER.test(text)) return text
    loadLang(lang)
    const hit = dict?.[text]
    if (hit === undefined) {
      requestTranslation(lang, text)
      return text
    }
    return hit
  }
}
