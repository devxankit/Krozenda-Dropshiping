// Transport + on-device cache for UI translations.
//
// The library that actually talks to Google (google-translate-api-x) cannot
// run here: the endpoint it calls sends no CORS headers, so a browser request
// always fails. It runs on the server instead and this posts to POST /translate.
//
// The localStorage cache in front of it is what makes a reload feel instant —
// without it, every page load re-asks the API for strings it already showed
// once, and the screen flashes English before settling.

import { api } from '../axios'

const CACHE_PREFIX = 'krozenda.i18n.'
// Bumped when the cache shape changes, so an old payload is dropped rather
// than read as if it had the new shape.
const CACHE_VERSION = 'v1'

// Same ceiling the API enforces (MAX_TEXTS_PER_REQUEST in
// backend/services/translationService.js). Splitting here rather than letting
// the request 400 means a screen with a long table still translates.
const MAX_PER_REQUEST = 200

const cacheKey = (lang) => `${CACHE_PREFIX}${CACHE_VERSION}.${lang}`

export function loadCache(lang) {
  try {
    const raw = localStorage.getItem(cacheKey(lang))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Private mode, quota, or corrupt JSON — an empty cache is always safe,
    // it just costs one round trip.
    return {}
  }
}

export function saveCache(lang, dictionary) {
  try {
    localStorage.setItem(cacheKey(lang), JSON.stringify(dictionary))
  } catch {
    // Over quota. The in-memory dictionary still serves this session; the
    // next load simply starts cold rather than breaking.
  }
}

export function clearCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Nothing was persisted to begin with.
  }
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Resolves to { [source]: translated }. Never rejects: a failed translation
// falls back to English, and a screen that renders in the wrong language is a
// far better outcome than a screen that throws.
export async function fetchTranslations(texts, lang) {
  const batches = chunk(texts, MAX_PER_REQUEST)
  const settled = await Promise.allSettled(
    batches.map((batch) => api.post('/translate', { to: lang, texts: batch })),
  )

  const merged = {}
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value.data?.data?.translations ?? {})
      return
    }
    // Offline, rate limited, or the endpoint is down. Map these strings to
    // themselves so the provider stops re-requesting them every render; the
    // next language switch or reload retries.
    for (const source of batches[i]) merged[source] = source
  })

  return merged
}
