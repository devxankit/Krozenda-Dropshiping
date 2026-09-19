const crypto = require('crypto');

// In-process TTL cache for CJ reads — NOT Redis. This codebase has an
// existing, explicit decision against Redis (see
// services/shipping/serviceabilityService.js's own in-process cache and its
// comment citing that decision) — this mirrors that same pattern rather
// than introducing a new dependency for one integration.
//
// Different TTLs for different volatility (master plan §12/§13): category
// trees and product detail barely change; search result freshness matters
// less than stock/price, which this cache does NOT hold at all — inventory
// sync (cjInventoryService) always hits CJ live, on purpose.
const TTL = Object.freeze({
  CATEGORY: 10 * 60 * 1000, // 10 min — a slow-changing tree (master plan §5)
  SEARCH: 60 * 1000, // 1 min — fresh enough for browsing, cheap enough to reuse across a burst of clicks
  DETAIL: 2 * 60 * 1000, // 2 min — admin may reopen the same product while comparing a few
  VARIANTS: 2 * 60 * 1000,
});

const store = new Map(); // key -> { value, expiresAt }
const inFlight = new Map(); // key -> Promise, so concurrent identical requests share one CJ call

function makeKey(namespace, params) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(params ?? null)).digest('hex');
  return `${namespace}:${hash}`;
}

function readCache(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Wraps a fetcher with cache-then-fetch-then-dedup: a cache hit skips the
// network entirely; a miss with an identical request already in flight
// (master plan §21 — "avoid duplicate CJ requests" when multiple admins hit
// the same thing at once) awaits that instead of starting a second one.
async function cached(namespace, params, ttlMs, fetcher) {
  const key = makeKey(namespace, params);

  const hit = readCache(key);
  if (hit !== undefined) return hit;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetcher()
    .then((value) => {
      writeCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

function clearAll() {
  store.clear();
  inFlight.clear();
}

module.exports = { TTL, cached, clearAll };
