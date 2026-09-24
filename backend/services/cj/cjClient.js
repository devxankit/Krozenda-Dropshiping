const https = require('https');
const { URL } = require('url');
const pointsGuard = require('./cjPointsGuard');

// The ONLY place an HTTP request reaches CJ Dropshipping's API. Mirrors
// services/shipping/shiprocketClient.js on purpose — same failure model
// (timeouts that abort, retry that distinguishes safe from unsafe, errors
// that never carry a credential) — but CJ has its own base URL, its own
// auth header shape (CJ-Access-Token, not Bearer) and its own rate-limit
// signal, so it gets its own client rather than a generic HTTP module.
//
// This module knows nothing about products, orders or sync. Business
// meaning is the service layer's job.

const DEFAULT_BASE_URL = 'https://developers.cjdropshipping.com/api2.0';
const DEFAULT_TIMEOUT_MS = 20000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ENOTFOUND',
]);

class CjError extends Error {
  constructor(message, { status = 0, code = 'CJ_ERROR', retryable = false, body = null, isTimeout = false } = {}) {
    super(message);
    this.name = 'CjError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.isTimeout = isTimeout;
    this.body = body;
  }
}

function baseUrl() {
  return (process.env.CJ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

const SENSITIVE_KEYS = /^(password|token|accesstoken|refreshtoken|cj-access-token|authorization|api_?key|secret)$/i;

function scrub(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : scrub(val, depth + 1);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One HTTP round trip. No retry here — layered on top in call().
function once({ method, path, accessToken, body, query, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(`${baseUrl()}${path}`);
    } catch {
      reject(new CjError('Invalid CJ URL', { code: 'BAD_URL' }));
      return;
    }

    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

    const request = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          // CJ authenticates business calls with this header, not a Bearer
          // Authorization header — the login/refresh calls themselves carry
          // no token at all (accessToken is null for those).
          ...(accessToken ? { 'CJ-Access-Token': accessToken } : {}),
        },
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        const MAX_BYTES = 5 * 1024 * 1024;

        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new CjError('CJ response too large', { code: 'RESPONSE_TOO_LARGE' }));
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
            parsed = null;
          }

          const status = response.statusCode || 0;
          // CJ wraps its own business-level failures in HTTP 200 responses
          // with { result: false, code, message } — that has to be treated
          // as an error too, not just a non-2xx HTTP status.
          const businessFailed = status >= 200 && status < 300 && parsed && parsed.result === false;

          pointsGuard.record(parsed?.pointsInfo);

          if (status >= 200 && status < 300 && !businessFailed) {
            resolve({ status, body: parsed });
            return;
          }

          const cjCode = parsed?.code;
          const message = cjMessage(parsed, status);
          const code = mapErrorCode(status, cjCode, message);
          if (code === 'CJ_POINTS_EXHAUSTED') pointsGuard.markExhausted();
          reject(
            new CjError(message, {
              status,
              code,
              retryable:
                code === 'CJ_POINTS_EXHAUSTED'
                  ? false
                  : code === 'CJ_RATE_LIMITED' ||
                    (businessFailed ? isRetryableBusinessCode(cjCode) : RETRYABLE_STATUS.has(status)),
              body: parsed,
            })
          );
        });
      }
    );

    request.setTimeout(timeoutMs ?? DEFAULT_TIMEOUT_MS, () => {
      request.destroy();
      reject(
        new CjError('CJ request timed out', {
          code: 'CJ_TIMEOUT',
          retryable: true,
          isTimeout: true,
        })
      );
    });

    request.on('error', (err) => {
      reject(
        new CjError('Could not reach CJ', {
          code: err.code || 'NETWORK_ERROR',
          retryable: RETRYABLE_NETWORK_CODES.has(err.code),
        })
      );
    });

    if (payload) request.write(payload);
    request.end();
  });
}

// CJ's own numeric/string business codes for auth failures vary by endpoint;
// treat anything that looks like an expired/invalid token distinctly so
// cjAuthService knows to refresh rather than give up.
//
// The two quota failures are recognised by their text, because CJ sends both
// as HTTP 200 + result:false with no stable code of their own:
//   "Insufficient API points. Used today: …"  — daily points budget spent
//     (see cjPointsGuard). Not retryable: only time refills it.
//   "Too Many Requests, QPS limit is 1 time/1second" — per-second limit.
//     Retryable after a short wait.
const POINTS_EXHAUSTED = /insufficient api points/i;
const QPS_LIMITED = /too many requests|qps limit/i;

function mapErrorCode(status, cjCode, message = '') {
  if (POINTS_EXHAUSTED.test(message)) return 'CJ_POINTS_EXHAUSTED';
  if (status === 429 || QPS_LIMITED.test(message)) return 'CJ_RATE_LIMITED';
  if (status === 401 || status === 403) return 'CJ_UNAUTHORIZED';
  if (cjCode === 1600200 || cjCode === '1600200') return 'CJ_TOKEN_EXPIRED';
  return 'CJ_HTTP_ERROR';
}

// 429 and token-expiry are the only business-level codes worth retrying
// automatically; anything else (validation, not-found, insufficient stock)
// is a permanent failure that retrying will not fix.
function isRetryableBusinessCode(cjCode) {
  return cjCode === 1600200 || cjCode === '1600200';
}

function cjMessage(body, status) {
  if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
    return body.message;
  }
  return `CJ responded with HTTP ${status}`;
}

// `idempotent` is the caller's promise that repeating this request is safe.
// Defaults to true for GET, false otherwise — a POST (order creation!) is
// never retried unless the caller has explicitly reasoned about it.
async function call({
  method = 'GET',
  path,
  accessToken = null,
  body,
  query,
  timeoutMs,
  idempotent = method === 'GET',
  maxAttempts = 3,
  onLog = null,
}) {
  const attempts = idempotent ? maxAttempts : 1;
  let lastError;

  // Out of points: fail fast instead of spending the per-minute refill on
  // calls CJ is going to refuse anyway.
  if (pointsGuard.isPaused()) {
    throw new CjError('CJ API points exhausted', {
      code: 'CJ_POINTS_EXHAUSTED',
      status: 429,
      retryable: false,
    });
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await once({ method, path, accessToken, body, query, timeoutMs });
      onLog?.({ event: 'CJ_API_CALL', method, path, status: result.status, attempt });
      return result;
    } catch (err) {
      lastError = err;

      onLog?.({
        event: 'CJ_API_ERROR',
        method,
        path,
        attempt,
        status: err.status,
        code: err.code,
        message: err.message,
        body: scrub(err.body),
      });

      const canRetry = idempotent && err.retryable && attempt < attempts;
      if (!canRetry) break;

      // CJ allows one call per second; a QPS rejection waits at least that.
      const backoff = Math.max(err.code === 'CJ_RATE_LIMITED' ? 1500 : 0, Math.min(8000, 2 ** (attempt - 1) * 1000));
      await sleep(backoff + Math.floor(Math.random() * 250));
    }
  }

  throw lastError;
}

module.exports = {
  call,
  mapErrorCode,
  CjError,
  scrub,
  baseUrl,
  DEFAULT_TIMEOUT_MS,
};
