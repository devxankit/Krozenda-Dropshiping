const https = require('https');
const { URL } = require('url');

// The ONLY place an HTTPS request reaches Shopify.
//
// Built on node https rather than axios, matching services/shipping/
// shiprocketClient.js, so the retry policy, the credential scrubbing and the
// response cap are all visible in one file instead of spread across
// interceptors.
//
// Three things here are specific to Shopify's GraphQL Admin API and are the
// reason this is not just a copy of the Shiprocket client:
//
//  1. A GraphQL error is HTTP 200. Status alone tells you nothing, so the
//     `errors` array and `userErrors` are inspected on every response.
//  2. Rate limiting is a calculated-cost leaky bucket, not a request count.
//     Every response reports the bucket state in extensions.cost, and this
//     client reads it and makes the NEXT call wait if the bucket is too low to
//     afford it — rather than firing blindly and handling the throttle after
//     the fact.
//  3. THROTTLED arrives as an error extension inside a 200, so it has to be
//     mapped to "retryable" by hand.

const DEFAULT_TIMEOUT_MS = Number(process.env.SHOPIFY_GRAPHQL_TIMEOUT_MS) || 20000;
const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-10';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ENOTFOUND',
  'ESOCKETTIMEDOUT',
]);

class ShopifyError extends Error {
  constructor(message, { status = 0, code = 'SHOPIFY_ERROR', retryable = false, isTimeout = false, body = null } = {}) {
    super(message);
    this.name = 'ShopifyError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.isTimeout = isTimeout;
    this.body = body;
  }
}

// Nothing matching this ever reaches a log line.
const SENSITIVE_KEYS =
  /^(password|token|access_token|authorization|client_secret|client_id|api_key|apikey|secret|x-shopify-access-token|x-shopify-hmac-sha256)$/i;

function scrub(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : scrub(val, depth + 1);
  }
  return out;
}

function log(entry) {
  console.log(JSON.stringify({ scope: 'SHOPIFY', at: new Date().toISOString(), ...entry }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Shopify's bucket is per app-and-store pair, and every response tells us
// exactly how much of it is left. Holding that here and waiting BEFORE a call
// that cannot afford itself is cheaper than being throttled and retrying: a
// throttled call still costs a round trip, and a burst of them is how an
// import ends up taking minutes longer than it needs to.
//
// Restore rates (points/second): Standard 100, Advanced 200, Plus 1000.
const RESTORE_RATES = { STANDARD: 100, ADVANCED: 200, PLUS: 1000 };

const throttle = {
  currentlyAvailable: null,
  maximumAvailable: null,
  restoreRate: RESTORE_RATES[String(process.env.SHOPIFY_RATE_PLAN || 'STANDARD').toUpperCase()] || 100,
  observedAt: 0,
};

function noteThrottleStatus(cost) {
  const status = cost?.throttleStatus;
  if (!status) return;
  if (Number.isFinite(status.currentlyAvailable)) throttle.currentlyAvailable = status.currentlyAvailable;
  if (Number.isFinite(status.maximumAvailable)) throttle.maximumAvailable = status.maximumAvailable;
  if (Number.isFinite(status.restoreRate) && status.restoreRate > 0) throttle.restoreRate = status.restoreRate;
  throttle.observedAt = Date.now();
}

// What the bucket holds right now, projecting the refill since we last saw it.
function projectedAvailable() {
  if (throttle.currentlyAvailable === null) return null;
  const elapsedSec = (Date.now() - throttle.observedAt) / 1000;
  const refilled = throttle.currentlyAvailable + elapsedSec * throttle.restoreRate;
  return throttle.maximumAvailable === null ? refilled : Math.min(refilled, throttle.maximumAvailable);
}

async function waitForBudget(estimatedCost) {
  const available = projectedAvailable();
  if (available === null || available >= estimatedCost) return;

  const deficit = estimatedCost - available;
  const waitMs = Math.ceil((deficit / throttle.restoreRate) * 1000);
  // Never sleep longer than it could plausibly take to refill the whole
  // bucket; a wildly wrong estimate must not stall a request indefinitely.
  const capped = Math.min(Math.max(waitMs, 0), 10000);
  if (capped > 0) {
    log({ event: 'SHOPIFY_SELF_THROTTLE', waitMs: capped, available: Math.floor(available), estimatedCost });
    await sleep(capped);
  }
}

function throttleSnapshot() {
  return {
    currentlyAvailable: throttle.currentlyAvailable,
    maximumAvailable: throttle.maximumAvailable,
    restoreRate: throttle.restoreRate,
    projected: projectedAvailable(),
  };
}

// ---------------------------------------------------------------------------
// One HTTP attempt
// ---------------------------------------------------------------------------
function once({ shopDomain, apiVersion, accessToken, body, timeoutMs, pathOverride }) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(pathOverride || `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`);
    } catch {
      reject(new ShopifyError('Invalid Shopify URL', { code: 'BAD_URL' }));
      return;
    }

    const payload = Buffer.from(JSON.stringify(body), 'utf8');

    const request = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          ...(accessToken ? { 'X-Shopify-Access-Token': accessToken } : {}),
        },
      },
      (response) => {
        const chunks = [];
        let bytes = 0;

        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new ShopifyError('Shopify response too large', { code: 'RESPONSE_TOO_LARGE' }));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            // Shopify answers with an HTML page for some auth and 5xx cases.
            parsed = null;
          }
          resolve({ status: response.statusCode, body: parsed, raw: text });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      reject(new ShopifyError('Shopify request timed out', { code: 'TIMEOUT', isTimeout: true, retryable: true }));
    });

    request.on('error', (err) => {
      reject(
        new ShopifyError(err.message, {
          code: err.code || 'NETWORK_ERROR',
          retryable: RETRYABLE_NETWORK_CODES.has(err.code),
        })
      );
    });

    request.end(payload);
  });
}

function isThrottled(errors) {
  return (errors || []).some((e) => String(e?.extensions?.code || '').toUpperCase() === 'THROTTLED');
}

function firstMessage(errors, fallback) {
  const message = (errors || []).map((e) => e?.message).filter(Boolean).join('; ');
  return message || fallback;
}

/**
 * Run one GraphQL operation.
 *
 * @param {object}  args
 * @param {string}  args.query          the GraphQL document
 * @param {object}  [args.variables]
 * @param {string}  args.shopDomain
 * @param {string}  args.accessToken
 * @param {string}  [args.apiVersion]
 * @param {boolean} [args.isMutation]   a mutation is NOT retried by default
 * @param {number}  [args.estimatedCost] points, for the pre-flight wait
 * @returns {Promise<object>} the `data` object
 */
async function graphql({
  query,
  variables = {},
  shopDomain,
  accessToken,
  apiVersion = DEFAULT_API_VERSION,
  isMutation = false,
  estimatedCost = 10,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  operationName = null,
}) {
  if (!shopDomain) throw new ShopifyError('Shopify is not connected', { code: 'NOT_CONNECTED' });

  // A mutation is never retried unless the caller opts in. Shopify's mutations
  // are not idempotent — orderCreate in particular — so a blind retry after a
  // timeout can raise a second supplier order for the same sale. Callers that
  // need safety under retry carry their own fingerprint instead.
  const maxAttempts = isMutation ? 1 : MAX_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForBudget(estimatedCost);

    let response;
    try {
      response = await once({ shopDomain, apiVersion, accessToken, body: { query, variables }, timeoutMs });
    } catch (err) {
      lastError = err;
      if (err.retryable && attempt < maxAttempts) {
        await sleep(Math.min(300 * 2 ** (attempt - 1), 4000) + Math.floor(Math.random() * 200));
        continue;
      }
      throw err;
    }

    const { status, body, raw } = response;

    if (status === 401 || status === 403) {
      throw new ShopifyError(firstMessage(body?.errors, 'Shopify refused the credentials'), {
        status,
        code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        body: scrub(body),
      });
    }

    if (RETRYABLE_STATUS.has(status)) {
      lastError = new ShopifyError(`Shopify returned ${status}`, { status, code: 'UPSTREAM', retryable: true });
      if (attempt < maxAttempts) {
        await sleep(Math.min(500 * 2 ** (attempt - 1), 5000) + Math.floor(Math.random() * 300));
        continue;
      }
      throw lastError;
    }

    if (status < 200 || status >= 300) {
      throw new ShopifyError(firstMessage(body?.errors, `Shopify returned ${status}`), {
        status,
        code: 'BAD_STATUS',
        body: scrub(body) || raw?.slice(0, 500),
      });
    }

    if (!body) {
      throw new ShopifyError('Shopify returned an unreadable response', { status, code: 'UNPARSEABLE' });
    }

    noteThrottleStatus(body.extensions?.cost);

    // A throttle arrives as a 200 with an error extension. Retrying it is safe
    // even for a mutation: being throttled means it was never executed.
    if (isThrottled(body.errors)) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      log({ event: 'SHOPIFY_THROTTLED', attempt, waitMs: wait, operationName });
      if (attempt < MAX_ATTEMPTS) {
        await sleep(wait);
        continue;
      }
      throw new ShopifyError('Shopify rate limit exceeded', { status: 429, code: 'THROTTLED', retryable: true });
    }

    if (body.errors?.length) {
      throw new ShopifyError(firstMessage(body.errors, 'Shopify rejected the query'), {
        status,
        code: 'GRAPHQL_ERROR',
        body: scrub(body.errors),
      });
    }

    return body.data;
  }

  throw lastError || new ShopifyError('Shopify request failed', { code: 'UNKNOWN' });
}

/**
 * Collect the `userErrors` a mutation returns.
 *
 * Shopify reports a refused mutation as a 200 with an empty result and a
 * populated userErrors array, so a caller that only checks for thrown errors
 * will read a refusal as a success. Every mutation must pass its payload
 * through here.
 */
function userErrorsOf(payload) {
  const errors = payload?.userErrors || payload?.userErrors === null ? payload?.userErrors : null;
  if (!errors || errors.length === 0) return null;
  return errors.map((e) => `${(e.field || []).join('.') || 'request'}: ${e.message}`).join('; ');
}

module.exports = {
  graphql,
  userErrorsOf,
  ShopifyError,
  throttleSnapshot,
  scrub,
  log,
  DEFAULT_API_VERSION,
};
