// Runtime UI translation, backed by Google Translate.
//
// This lives on the server and not in the browser on purpose: the underlying
// library talks to an endpoint that sends no CORS headers, so a direct call
// from a page always fails. The frontend posts its strings to /translate and
// gets a source -> translated map back.
//
// Three things keep this from being slow or getting us rate-limited:
//
//   1. Every translated string is written to the `translations` collection and
//      read from there forever after. Google is a one-time source, not a
//      per-request dependency.
//   2. A small in-process cache sits in front of Mongo so a warm page costs
//      zero database round trips.
//   3. Identical calls that arrive while a fetch is already in flight wait on
//      that same promise instead of firing their own.
//
// It never throws at the caller. A translation that cannot be produced falls
// back to the English source, because a page in the wrong language is a far
// better outcome than a page that fails to render.

const crypto = require('crypto');
const { translate, isSupported } = require('google-translate-api-x');
const Translation = require('../Models/Translation');

// The source language of every string in the codebase.
const SOURCE_LANG = 'en';

// Google's batch endpoint starts failing on very large payloads. Forty short
// UI strings per call is comfortably inside what it accepts and still covers
// most screens in one or two round trips.
const CHUNK_SIZE = 40;

// Strings longer than this are almost certainly user-generated content that
// was posted by mistake, not UI copy.
const MAX_TEXT_LENGTH = 5000;
const MAX_TEXTS_PER_REQUEST = 200;

// Languages we offer in the switcher. Deliberately shorter than the 251 the
// library supports — these are the ones the marketplace actually serves, and
// an unbounded list would let a caller warm the cache in any language at our
// expense.
const SUPPORTED_LANGUAGES = Object.freeze([
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
]);

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

function isSupportedLanguage(code) {
  return SUPPORTED_CODES.has(String(code || '').toLowerCase());
}

function hashText(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

// Nothing to translate: blank strings, pure numbers, prices, dates and lone
// punctuation come back identical from Google anyway, so spending a network
// call and a cache row on them is pure waste.
const NON_TRANSLATABLE = /^[\s\d\p{P}\p{S}]*$/u;

// Order ids, tracking numbers, coupon codes, SKUs — a token containing a digit
// and no space. Left alone because translating one CORRUPTS it: Google happily
// turns ORD-2024-0011 into ओआरडी-2024-0011, which no longer matches anything a
// buyer can search, read out to support, or paste into a carrier's site.
//
// Real UI copy containing a number almost always has a space somewhere
// ("2 items", "Save 20%"), so this separates the two cleanly. The frontend
// applies the same rule before it sends, but the check belongs here too: the
// endpoint has to be safe for any caller, not only for the one we wrote.
const IDENTIFIER = /^(?=.*\d)\S+$/u;

function needsTranslation(text) {
  return (
    typeof text === 'string' &&
    text.length > 0 &&
    !NON_TRANSLATABLE.test(text) &&
    !IDENTIFIER.test(text)
  );
}

// ---------------------------------------------------------------------------
// Tier 1: in-process cache
// ---------------------------------------------------------------------------
// Keyed `<lang>:<sha1>`. Capped so a long-running process cannot grow without
// bound; eviction is oldest-inserted-first, which for UI copy is close enough
// to least-recently-used and costs nothing to maintain.
const MEMORY_CACHE_LIMIT = 20000;
const memoryCache = new Map();

function cacheKey(lang, hash) {
  return `${lang}:${hash}`;
}

function readMemory(lang, hash) {
  return memoryCache.get(cacheKey(lang, hash));
}

function writeMemory(lang, hash, text) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(cacheKey(lang, hash), text);
}

// Exposed for the admin flow that corrects a translation: the edited row is
// useless while a stale copy is still being served from memory.
function invalidate(lang, source) {
  if (!lang) {
    memoryCache.clear();
    return;
  }
  if (!source) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${lang}:`)) memoryCache.delete(key);
    }
    return;
  }
  memoryCache.delete(cacheKey(lang, hashText(source)));
}

// ---------------------------------------------------------------------------
// Tier 3: Google, de-duplicated
// ---------------------------------------------------------------------------
// Two visitors opening the same untranslated screen at the same moment must
// produce one call, not two. Keyed by language + the exact chunk contents.
const inFlight = new Map();

async function fetchChunk(texts, lang) {
  const key = `${lang}:${JSON.stringify(texts)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = translate(texts, { from: SOURCE_LANG, to: lang, forceTo: true })
    .then((results) =>
      texts.map((source, i) => {
        const translated = results?.[i]?.text;
        return typeof translated === 'string' && translated.length > 0 ? translated : source;
      })
    )
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
// Returns { [sourceText]: translatedText } covering every input string. Input
// order and duplicates do not matter — callers look results up by source.
async function translateBatch(texts, lang) {
  const target = String(lang || '').toLowerCase();
  const unique = [...new Set(texts.filter(needsTranslation).map((t) => t.slice(0, MAX_TEXT_LENGTH)))];
  const out = {};

  // Asking for English back, or for a language we do not offer, is answered
  // with the source text rather than an error — the caller gets a usable page.
  if (!unique.length || target === SOURCE_LANG || !isSupportedLanguage(target) || !isSupported(target)) {
    for (const t of texts) if (typeof t === 'string') out[t] = t;
    return out;
  }

  const hashes = new Map(unique.map((t) => [t, hashText(t)]));
  const missing = [];

  for (const text of unique) {
    const hit = readMemory(target, hashes.get(text));
    if (hit !== undefined) out[text] = hit;
    else missing.push(text);
  }

  // Tier 2: the translation memory in Mongo.
  if (missing.length) {
    try {
      const rows = await Translation.find({
        lang: target,
        hash: { $in: missing.map((t) => hashes.get(t)) },
      })
        .select('hash text')
        .lean();

      const byHash = new Map(rows.map((r) => [r.hash, r.text]));
      for (let i = missing.length - 1; i >= 0; i -= 1) {
        const stored = byHash.get(hashes.get(missing[i]));
        if (stored === undefined) continue;
        out[missing[i]] = stored;
        writeMemory(target, hashes.get(missing[i]), stored);
        missing.splice(i, 1);
      }
    } catch (err) {
      // A database that is down is a reason to go to Google, not to fail.
      console.error('[translate] translation memory read failed:', err.message);
    }
  }

  if (missing.length) {
    const chunks = chunk(missing, CHUNK_SIZE);
    const settled = await Promise.allSettled(chunks.map((c) => fetchChunk(c, target)));
    const fresh = [];

    settled.forEach((result, i) => {
      const sources = chunks[i];
      if (result.status !== 'fulfilled') {
        // Rate limited, offline, or Google changed its response shape. Serve
        // English for these strings and try again on the next request.
        console.error('[translate] fetch failed:', result.reason?.message);
        for (const source of sources) out[source] = source;
        return;
      }
      result.value.forEach((text, j) => {
        const source = sources[j];
        out[source] = text;
        writeMemory(target, hashes.get(source), text);
        // Only worth persisting when it actually differs from the source; an
        // unchanged string means Google had nothing to offer.
        if (text !== source) fresh.push({ hash: hashes.get(source), lang: target, source, text });
      });
    });

    if (fresh.length) persist(fresh);
  }

  // Anything the caller sent that we skipped (blank, numeric, duplicate)
  // still has to come back so the client never renders `undefined`.
  for (const t of texts) if (typeof t === 'string' && out[t] === undefined) out[t] = t;

  return out;
}

// Writes issued but not yet acknowledged. Tracked so a shutdown — or a test
// tearing down its database — can wait for them instead of severing the
// connection mid-write and logging a failure for work that was fine.
const pendingWrites = new Set();

function flushPendingWrites() {
  return Promise.all([...pendingWrites]);
}

// Fire-and-forget: the response should not wait on the cache write, and a
// failed write only costs the next visitor one more call to Google.
// `reviewed: true` rows are left alone so a hand-corrected string is never
// overwritten by the machine.
function persist(rows) {
  const write = Translation.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { hash: row.hash, lang: row.lang, reviewed: { $ne: true } },
        update: { $set: row },
        upsert: true,
      },
    })),
    { ordered: false }
  ).catch((err) => {
    // A duplicate key here means a parallel request won the race and stored
    // the same translation first, which is the outcome we wanted anyway.
    if (err?.code !== 11000) console.error('[translate] translation memory write failed:', err.message);
  });

  pendingWrites.add(write);
  write.finally(() => pendingWrites.delete(write));
}

module.exports = {
  translateBatch,
  isSupportedLanguage,
  invalidate,
  flushPendingWrites,
  SUPPORTED_LANGUAGES,
  SOURCE_LANG,
  MAX_TEXTS_PER_REQUEST,
  MAX_TEXT_LENGTH,
};
