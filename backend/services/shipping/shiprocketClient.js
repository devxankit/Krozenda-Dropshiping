const https = require('https');
const { URL } = require('url');

// The ONLY place an HTTP request reaches Shiprocket.
//
// Deliberately built on node's own https rather than adding an HTTP library:
// this codebase has no server-side HTTP client dependency today, and one
// carrier integration is not a reason to add one. Everything below is the
// small amount of machinery that a third-party call needs and that `fetch`
// alone does not give you — timeouts that actually abort, retry that
// distinguishes safe from unsafe, and errors that never carry a credential.
//
// This module knows nothing about orders, sellers or shipments. It takes a
// token and a path and returns a parsed response. Business meaning is the
// service layer's job (task §51).

const DEFAULT_BASE_URL = 'https://apiv2.shiprocket.in';
const DEFAULT_TIMEOUT_MS = 20000;

// Retry only what is genuinely transient (task §26). 429 is included because
// Shiprocket rate-limits, and backing off is the correct response to it.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ENOTFOUND',
]);

// A failure that carries enough structure for callers to branch on, and
// nothing that could leak a credential.
class ShiprocketError extends Error {
  constructor(message, { status = 0, code = 'SHIPROCKET_ERROR', retryable = false, body = null, isTimeout = false } = {}) {
    super(message);
    this.name = 'ShiprocketError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.isTimeout = isTimeout;
    // The carrier's parsed body, for logging. Never rendered to a buyer.
    this.body = body;
  }
}

function baseUrl() {
  return (process.env.SHIPROCKET_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

// Anything that looks like a secret is replaced before an object can reach a
// log line. Applied to request bodies on the way out and carrier bodies on the
// way back (task §34: never log password/token).
const SENSITIVE_KEYS = /^(password|token|access_token|authorization|api_key|apikey|secret|x-api-key)$/i;

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

// One HTTP round trip. No retry here — retry is layered on top so that the
// decision of WHETHER to retry stays in one readable place.
function once({ method, path, token, body, query, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(`${baseUrl()}${path}`);
    } catch {
      reject(new ShiprocketError('Invalid Shiprocket URL', { code: 'BAD_URL' }));
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        // A carrier that starts streaming something enormous must not be able
        // to exhaust this process's memory.
        const MAX_BYTES = 5 * 1024 * 1024;

        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new ShiprocketError('Shiprocket response too large', { code: 'RESPONSE_TOO_LARGE' }));
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
            // Shiprocket occasionally answers with an HTML error page. Treat
            // it as an unparseable response rather than crashing on JSON.parse.
            parsed = null;
          }

          const status = response.statusCode || 0;
          if (status >= 200 && status < 300) {
            resolve({ status, body: parsed });
            return;
          }

          reject(
            new ShiprocketError(carrierMessage(parsed, status), {
              status,
              code: status === 401 || status === 403 ? 'SHIPROCKET_UNAUTHORIZED' : 'SHIPROCKET_HTTP_ERROR',
              retryable: RETRYABLE_STATUS.has(status),
              body: parsed,
            })
          );
        });
      }
    );

    request.setTimeout(timeoutMs ?? DEFAULT_TIMEOUT_MS, () => {
      request.destroy();
      // isTimeout is load-bearing: a timed-out CREATE must never be retried
      // blindly, because the carrier may have acted (task §38).
      reject(
        new ShiprocketError('Shiprocket request timed out', {
          code: 'SHIPROCKET_TIMEOUT',
          retryable: true,
          isTimeout: true,
        })
      );
    });

    request.on('error', (err) => {
      reject(
        new ShiprocketError('Could not reach Shiprocket', {
          code: err.code || 'NETWORK_ERROR',
          retryable: RETRYABLE_NETWORK_CODES.has(err.code),
        })
      );
    });

    if (payload) request.write(payload);
    request.end();
  });
}

// Best-effort extraction of the carrier's own message, for server-side logs.
function carrierMessage(body, status) {
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message) return body.message;
    if (body.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
  }
  return `Shiprocket responded with HTTP ${status}`;
}

// The public entry point.
//
// `idempotent` is the caller's promise that repeating this request is safe.
// It defaults to true for GET and FALSE for everything else, so a POST is
// never retried unless the caller has thought about it. That default is the
// reason a timed-out shipment creation ends up in RECONCILIATION_REQUIRED
// rather than silently creating a second shipment.
async function call({
  method = 'GET',
  path,
  token = null,
  body,
  query,
  timeoutMs,
  idempotent = method === 'GET',
  maxAttempts = 3,
  onLog = null,
}) {
  const attempts = idempotent ? maxAttempts : 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await once({ method, path, token, body, query, timeoutMs });
      onLog?.({
        event: 'SHIPROCKET_API_CALL',
        method,
        path,
        status: result.status,
        attempt,
      });
      return result;
    } catch (err) {
      lastError = err;

      onLog?.({
        event: 'SHIPROCKET_API_ERROR',
        method,
        path,
        attempt,
        status: err.status,
        code: err.code,
        // Scrubbed, and only the carrier's own message — never our payload.
        message: err.message,
        body: scrub(err.body),
      });

      const canRetry = idempotent && err.retryable && attempt < attempts;
      if (!canRetry) break;

      // Exponential backoff with jitter, so a rate-limited burst does not
      // resynchronise and hammer the carrier again in lockstep.
      const backoff = Math.min(8000, 2 ** (attempt - 1) * 1000);
      await sleep(backoff + Math.floor(Math.random() * 250));
    }
  }

  throw lastError;
}

module.exports = {
  call,
  ShiprocketError,
  scrub,
  baseUrl,
  DEFAULT_TIMEOUT_MS,
};
