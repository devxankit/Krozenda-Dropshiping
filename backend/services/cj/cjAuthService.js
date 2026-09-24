const CjSettings = require('../../Models/CjSettings');
const { encrypt, decrypt } = require('../../utils/secretBox');
const { call, CjError } = require('./cjClient');
const requestManager = require('./cjRequestManager');

// CJ authentication and token lifecycle — the single-flight lock hardening
// requirement from the master plan.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: at most one token refresh operation
// runs at a time for the whole process. Without this, N concurrent CJ calls
// hitting an expired token each fire their own refresh request, and CJ has
// been observed invalidating a refresh token once it's been used — so the
// losers of that race would end up with a dead token instead of a fresh one.
//
// CJ is a single admin-owned platform account (no per-seller credentials),
// so unlike Shiprocket's per-integration cache this is process-wide, backed
// by CjSettings so a restart doesn't force an unnecessary re-login.

const LOGIN_PATH = '/v1/authentication/getAccessToken';
const REFRESH_PATH = '/v1/authentication/refreshAccessToken';

// Refresh a bit before actual expiry to leave headroom for clock skew and
// in-flight requests that started just before the boundary.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

// In-memory cache mirrors CjSettings so we don't hit Mongo on every call.
// { accessToken, expiresAt } | null
let cached = null;
// Single in-flight refresh/login promise — this IS the single-flight lock.
let inFlight = null;

function isFresh(entry) {
  return !!entry && entry.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now();
}

async function loadCachedFromDb() {
  const settings = await CjSettings.getSettingsWithSecrets();
  if (!settings?.encryptedAccessToken || !settings.accessTokenExpiresAt) return null;

  try {
    return {
      accessToken: decrypt(settings.encryptedAccessToken),
      expiresAt: new Date(settings.accessTokenExpiresAt).getTime(),
      refreshToken: settings.encryptedRefreshToken ? decrypt(settings.encryptedRefreshToken) : null,
      refreshExpiresAt: settings.refreshTokenExpiresAt ? new Date(settings.refreshTokenExpiresAt).getTime() : null,
    };
  } catch {
    // Corrupted/undecryptable record — treat as no cached token.
    return null;
  }
}

async function persistTokens({ accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate }) {
  const settings = await CjSettings.getSettings();
  settings.encryptedAccessToken = encrypt(accessToken);
  settings.accessTokenExpiresAt = new Date(accessTokenExpiryDate);
  if (refreshToken) {
    settings.encryptedRefreshToken = encrypt(refreshToken);
    settings.refreshTokenExpiresAt = refreshTokenExpiryDate ? new Date(refreshTokenExpiryDate) : null;
  }
  settings.status = 'CONNECTED';
  settings.lastConnectionCheckAt = new Date();
  settings.lastSuccessAt = new Date();
  settings.failureReason = '';
  await settings.save();
}

// Quota refusals say nothing about the account's connection, so they must
// not flip it to FAILED — that is what sent admins off to "reconnect".
const QUOTA_CODES = new Set(['CJ_POINTS_EXHAUSTED', 'CJ_RATE_LIMITED']);

async function recordFailure(reason) {
  if (QUOTA_CODES.has(reason)) return;
  const settings = await CjSettings.getSettings();
  settings.status = 'FAILED';
  settings.lastConnectionCheckAt = new Date();
  settings.lastFailureAt = new Date();
  settings.failureReason = safeFailureMessage(reason);
  await settings.save();
}

function safeFailureMessage(code) {
  switch (code) {
    case 'CJ_CREDENTIALS_MISSING':
      return 'CJ API key / email are not configured on the server.';
    case 'CJ_UNAUTHORIZED':
      return 'CJ rejected these credentials. Check the account email and API key.';
    case 'CJ_POINTS_EXHAUSTED':
      return "CJ's daily API limit for this account is used up. It refills every few minutes and resets fully at 5:30 AM IST — please try again shortly. No need to reconnect.";
    case 'CJ_RATE_LIMITED':
      return 'CJ is receiving too many requests right now. Please try again in a few seconds.';
    case 'CJ_TIMEOUT':
      return 'CJ did not respond in time. Please try again.';
    case 'CJ_REFRESH_TOKEN_MISSING':
      return 'No refresh token on file — reconnect the CJ account.';
    case 'ENCRYPTION_KEY_MISSING':
    case 'ENCRYPTION_KEY_INVALID':
      return 'Server is not configured to store CJ credentials securely.';
    case 'ENCRYPTION_AUTH_FAILED':
      return 'Saved CJ credentials could not be read. Please reconnect the account.';
    default:
      return 'Could not connect to CJ. Please try again, or reconnect the account.';
  }
}

async function loadCredentials() {
  const settings = await CjSettings.getSettingsWithSecrets();
  const email = settings?.encryptedEmail ? decrypt(settings.encryptedEmail) : null;
  const apiKey = settings?.encryptedApiKey ? decrypt(settings.encryptedApiKey) : null;

  if (!email || !apiKey) {
    throw new CjError('CJ credentials are not configured', { code: 'CJ_CREDENTIALS_MISSING', status: 400 });
  }
  return { email, apiKey };
}

// Performs a fresh login via email + API key. Never retried automatically —
// wrong credentials retried is just repeated failed login attempts.
async function login({ onLog = null } = {}) {
  const { email, apiKey } = await loadCredentials();

  try {
    const { body } = await requestManager.enqueue(() =>
      call({
        method: 'POST',
        path: LOGIN_PATH,
        body: { email, password: apiKey },
        idempotent: false,
        onLog,
      })
    );

    const data = body?.data;
    if (!data?.accessToken) {
      throw new CjError('CJ login returned no access token', { code: 'CJ_NO_TOKEN', body });
    }

    await persistTokens(data);
    onLog?.({ event: 'CJ_AUTH_SUCCESS' });
    return data;
  } catch (err) {
    onLog?.({ event: 'CJ_AUTH_FAILED', code: err.code });
    await recordFailure(err.code);
    throw err;
  }
}

// Refreshes using the stored refresh token. Falls back to full login if no
// refresh token is on file or CJ rejects it.
async function refresh({ onLog = null } = {}) {
  const stored = await loadCachedFromDb();
  if (!stored?.refreshToken) {
    return login({ onLog });
  }

  try {
    const { body } = await requestManager.enqueue(() =>
      call({
        method: 'POST',
        path: REFRESH_PATH,
        body: { refreshToken: stored.refreshToken },
        idempotent: false,
        onLog,
      })
    );

    const data = body?.data;
    if (!data?.accessToken) {
      throw new CjError('CJ refresh returned no access token', { code: 'CJ_NO_TOKEN', body });
    }

    await persistTokens(data);
    onLog?.({ event: 'CJ_REFRESH_SUCCESS' });
    return data;
  } catch (err) {
    onLog?.({ event: 'CJ_REFRESH_FAILED', code: err.code });
    // A rejected refresh token is a credentials-adjacent problem, not
    // transient — fall back to a full login once before giving up.
    if (err.code === 'CJ_UNAUTHORIZED') {
      return login({ onLog });
    }
    await recordFailure(err.code);
    throw err;
  }
}

// A valid access token, from cache when possible.
//
// Concurrency: this IS the single-flight lock — the first caller to see a
// stale/missing token stores its refresh promise in `inFlight`; every other
// concurrent caller awaits that same promise instead of starting its own.
async function getAccessToken({ forceRefresh = false, onLog = null } = {}) {
  // Both checks below are synchronous (no `await` before them), which is
  // what actually makes the lock single-flight: if N callers fire in the
  // same synchronous burst (e.g. `Array.from({length:5}, () =>
  // getAccessToken())`), each one runs to completion up to its first
  // `await` before the next one starts. `inFlight` gets assigned — as a
  // PENDING promise, synchronously, before this function's first internal
  // `await` — by the very first caller, so every caller after it sees a
  // non-null `inFlight` and short-circuits here. An earlier version of this
  // function put an `await loadCachedFromDb()` BEFORE checking/setting
  // `inFlight`, which reopened exactly the race this lock exists to close:
  // every concurrent caller reached the check while `inFlight` was still
  // null and each kicked off its own login/refresh.
  if (!forceRefresh && isFresh(cached)) return cached.accessToken;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (!forceRefresh) {
      const fromDb = await loadCachedFromDb();
      if (isFresh(fromDb)) {
        cached = fromDb;
        return cached.accessToken;
      }
    }

    const hasAnyToken = cached || (await loadCachedFromDb());
    const op = hasAnyToken ? refresh : login;
    const data = await op({ onLog });

    cached = {
      accessToken: data.accessToken,
      expiresAt: new Date(data.accessTokenExpiryDate).getTime(),
    };
    return cached.accessToken;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

// Runs an authenticated call, re-authenticating ONCE on a token-expiry
// signal. Bounded by a flag, not a loop: a token rejected twice is a
// credentials problem, and retrying further is a slow brute force.
async function withAuth(makeRequest, { onLog = null } = {}) {
  const token = await getAccessToken({ onLog });

  try {
    return await makeRequest(token);
  } catch (err) {
    if (err.code !== 'CJ_UNAUTHORIZED' && err.code !== 'CJ_TOKEN_EXPIRED') throw err;

    const fresh = await getAccessToken({ forceRefresh: true, onLog });
    return makeRequest(fresh);
  }
}

async function testConnection({ onLog = null } = {}) {
  try {
    await getAccessToken({ forceRefresh: true, onLog });
    return { connected: true, testedAt: new Date() };
  } catch (err) {
    return { connected: false, testedAt: new Date(), reason: safeFailureMessage(err.code) };
  }
}

async function connect({ email, apiKey, environment, updatedBy }) {
  const settings = await CjSettings.getSettings();
  settings.encryptedEmail = encrypt(email);
  settings.encryptedApiKey = encrypt(apiKey);
  if (environment) settings.environment = environment;
  settings.updatedBy = updatedBy || null;
  // Drop any stale tokens tied to the previous credentials before logging in.
  settings.encryptedAccessToken = '';
  settings.encryptedRefreshToken = '';
  settings.accessTokenExpiresAt = null;
  settings.refreshTokenExpiresAt = null;
  await settings.save();

  invalidate();
  await login({});
  return CjSettings.getSettings();
}

async function disconnect({ updatedBy }) {
  const settings = await CjSettings.getSettings();
  settings.encryptedEmail = '';
  settings.encryptedApiKey = '';
  settings.encryptedAccessToken = '';
  settings.encryptedRefreshToken = '';
  settings.accessTokenExpiresAt = null;
  settings.refreshTokenExpiresAt = null;
  settings.status = 'DISCONNECTED';
  settings.failureReason = '';
  settings.updatedBy = updatedBy || null;
  await settings.save();
  invalidate();
}

function invalidate() {
  cached = null;
  inFlight = null;
}

module.exports = {
  getAccessToken,
  withAuth,
  testConnection,
  connect,
  disconnect,
  invalidate,
  safeFailureMessage,
  LOGIN_PATH,
  REFRESH_PATH,
};
