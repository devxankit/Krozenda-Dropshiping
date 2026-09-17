const ShippingIntegration = require('../../Models/ShippingIntegration');
const { decrypt, maskEmail } = require('../../utils/secretBox');
const { call, ShiprocketError } = require('./shiprocketClient');

// Shiprocket authentication and token lifecycle.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: tokens are cached PER INTEGRATION, not
// globally. A single module-level token would mean Seller A's token being used
// for Seller B's shipment — creating Seller A's parcel in Seller B's carrier
// account. The cache is keyed by integration id, and getToken() will not run
// without one.
//
// Verified against Shiprocket's own documentation:
//   POST /v1/external/auth/login   body { email, password }
//   → { token, ... }, valid for 240 hours (10 days)

const LOGIN_PATH = '/v1/external/auth/login';

// Refresh well inside the documented 10-day life. Nine days leaves a full day
// of headroom for clock skew and for a deploy that happens to land on the
// boundary — the cost of an early re-login is one HTTP call.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

// integrationId -> { token, expiresAt }
const tokenCache = new Map();
// integrationId -> Promise<string>, so N concurrent callers trigger ONE login
// rather than N (task §5, "concurrency protection").
const inFlight = new Map();

function cacheKey(integration) {
  return String(integration._id);
}

function readCached(integration) {
  const entry = tokenCache.get(cacheKey(integration));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tokenCache.delete(cacheKey(integration));
    return null;
  }
  return entry.token;
}

// Credentials for an integration. Platform credentials come from the
// environment and are never persisted; a seller's come from their encrypted
// record. Neither is ever returned to a caller outside this module.
async function loadCredentials(integration) {
  if (integration.accountType === 'PLATFORM') {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;
    if (!email || !password) {
      throw new ShiprocketError('Platform Shiprocket credentials are not configured', {
        code: 'PLATFORM_CREDENTIALS_MISSING',
        status: 500,
      });
    }
    return { email, password };
  }

  // encryptedPassword is `select: false`, so it has to be asked for explicitly.
  // Re-read rather than trusting whatever the caller happened to load.
  const withSecret = await ShippingIntegration.findById(integration._id).select(
    '+credentials.encryptedPassword'
  );

  const email = withSecret?.credentials?.email;
  const envelope = withSecret?.credentials?.encryptedPassword;
  if (!email || !envelope) {
    throw new ShiprocketError('This seller has no stored Shiprocket credentials', {
      code: 'SELLER_CREDENTIALS_MISSING',
      status: 400,
    });
  }

  return { email, password: decrypt(envelope) };
}

// Records the outcome of an authentication attempt on the integration, so the
// seller's settings screen can show real connection health (task §11).
async function recordResult(integration, { ok, reason = '' }) {
  const now = new Date();
  const update = ok
    ? {
        $set: {
          status: 'CONNECTED',
          lastTestedAt: now,
          lastSuccessfulAt: now,
          failureReason: '',
          consecutiveFailures: 0,
        },
      }
    : {
        $set: {
          // A 401 from the LOGIN endpoint means the credentials are wrong —
          // not that a token lapsed. Recording that as TOKEN_EXPIRED told a
          // seller who simply mistyped their password that their token had
          // expired, which is both wrong and unactionable.
          //
          // TOKEN_EXPIRED is reserved for a 401 met on a BUSINESS call after a
          // successful login. withAuth handles that transparently by
          // re-authenticating, so it only reaches here if the re-auth also
          // failed — which is, again, a credentials problem.
          status: 'FAILED',
          lastTestedAt: now,
          lastFailureAt: now,
          failureReason: safeFailureMessage(reason),
        },
        $inc: { consecutiveFailures: 1 },
      };

  await ShippingIntegration.updateOne({ _id: integration._id }, update);
}

// Carrier errors are never shown verbatim to a seller (task §25). This maps
// them to wording that says what to DO without echoing anything sensitive.
function safeFailureMessage(code) {
  switch (code) {
    case 'SHIPROCKET_UNAUTHORIZED':
      return 'Shiprocket rejected these credentials. Check the email and password, and that the account is an API user.';
    case 'SHIPROCKET_TIMEOUT':
      return 'Shiprocket did not respond in time. Please try again.';
    case 'PLATFORM_CREDENTIALS_MISSING':
      return 'Platform Shiprocket credentials are not configured on the server.';
    case 'SELLER_CREDENTIALS_MISSING':
      return 'No Shiprocket credentials are saved for this account.';
    case 'ENCRYPTION_KEY_MISSING':
    case 'ENCRYPTION_KEY_INVALID':
      return 'Server is not configured to store carrier credentials securely.';
    case 'ENCRYPTION_AUTH_FAILED':
      return 'Saved credentials could not be read. Please reconnect the account.';
    default:
      return 'Could not connect to Shiprocket. Please try again, or reconnect the account.';
  }
}

// Performs the login. Never retried automatically: a wrong password retried
// three times is three failed login attempts against the carrier, and the
// client's `idempotent: false` default already enforces that for POSTs.
async function login(integration, { onLog = null } = {}) {
  const { email, password } = await loadCredentials(integration);

  try {
    const { body } = await call({
      method: 'POST',
      path: LOGIN_PATH,
      body: { email, password },
      idempotent: false,
      onLog,
    });

    const token = body?.token;
    if (!token || typeof token !== 'string') {
      throw new ShiprocketError('Shiprocket login returned no token', {
        code: 'SHIPROCKET_NO_TOKEN',
        body,
      });
    }

    onLog?.({
      event: 'SHIPROCKET_AUTH_SUCCESS',
      integrationId: String(integration._id),
      accountType: integration.accountType,
      // Masked: enough to tell accounts apart in a log, not enough to be PII.
      account: maskEmail(email),
    });

    await recordResult(integration, { ok: true });
    return token;
  } catch (err) {
    onLog?.({
      event: 'SHIPROCKET_AUTH_FAILED',
      integrationId: String(integration._id),
      accountType: integration.accountType,
      account: maskEmail(email),
      code: err.code,
    });
    await recordResult(integration, { ok: false, reason: err.code });
    throw err;
  }
}

// A valid bearer token for this integration, from cache when possible.
//
// Concurrency: the first caller stores its promise in `inFlight`; everyone
// else awaits the same promise. So ten shipments created at once produce one
// login, not ten.
async function getToken(integration, { forceRefresh = false, onLog = null } = {}) {
  if (!integration?._id) {
    throw new ShiprocketError('getToken requires a shipping integration', {
      code: 'INTEGRATION_REQUIRED',
      status: 500,
    });
  }

  const key = cacheKey(integration);

  if (!forceRefresh) {
    const cached = readCached(integration);
    if (cached) return cached;
  } else {
    tokenCache.delete(key);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = login(integration, { onLog })
    .then((token) => {
      tokenCache.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
      return token;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

// Runs an authenticated call, re-authenticating ONCE on a 401.
//
// The retry is bounded by a flag rather than a loop: a token that is rejected
// twice is a credentials problem, not an expiry problem, and retrying further
// would just be a slow brute force.
async function withAuth(integration, makeRequest, { onLog = null } = {}) {
  const token = await getToken(integration, { onLog });

  try {
    return await makeRequest(token);
  } catch (err) {
    if (err.code !== 'SHIPROCKET_UNAUTHORIZED') throw err;

    const fresh = await getToken(integration, { forceRefresh: true, onLog });
    return makeRequest(fresh);
  }
}

// Verifies credentials without keeping the result. Used by the seller's
// "Test Connection" button (task §3) and by the admin health check.
async function testConnection(integration, { onLog = null } = {}) {
  try {
    await getToken(integration, { forceRefresh: true, onLog });
    return { connected: true, testedAt: new Date() };
  } catch (err) {
    return {
      connected: false,
      testedAt: new Date(),
      // Safe wording only — the raw carrier error stays in the logs.
      reason: safeFailureMessage(err.code),
    };
  }
}

// Drops a cached token. Called on disconnect, so a disconnected account cannot
// keep shipping from this process's memory until the TTL lapses.
function invalidate(integrationId) {
  const key = String(integrationId);
  tokenCache.delete(key);
  inFlight.delete(key);
}

function invalidateAll() {
  tokenCache.clear();
  inFlight.clear();
}

module.exports = {
  getToken,
  withAuth,
  testConnection,
  invalidate,
  invalidateAll,
  safeFailureMessage,
  TOKEN_TTL_MS,
  LOGIN_PATH,
};
