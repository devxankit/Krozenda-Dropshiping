const https = require('https');
const ShopifySettings = require('../../Models/ShopifySettings');
const secretBox = require('../../utils/secretBox');
const { ShopifyError, log } = require('./shopifyClient');

// Shopify access tokens, via the client credentials grant.
//
// WHY THIS FILE EXISTS AT ALL. Shopify stopped issuing long-lived `shpat_`
// tokens to newly created in-admin custom apps on 2026-01-01. An app created
// in the Dev Dashboard never shows a token: it has a client id and secret,
// which are exchanged for an access token that EXPIRES AFTER 24 HOURS. So
// unlike a Shiprocket-style integration where the credential is the token,
// here the credential buys a token and the token has to be kept fresh.
//
// The grant is only valid for stores inside your own organisation, which is
// exactly the single-store case this integration is for. A store outside the
// org answers `shop_not_permitted` and would need a full OAuth install
// instead.
//
// THE REFRESH LOCK. A background sync, a webhook and an admin click can all
// discover an expired token in the same millisecond. Without a lock each one
// fetches its own token, and because Shopify invalidates the previous token on
// some grant paths, the slowest writer can persist a token the others have
// already had revoked — leaving every caller holding a dead token until the
// next expiry. One in-process promise serialises the refresh instead.

const TOKEN_PATH = '/admin/oauth/access_token';

// Refresh this long before the real expiry, so a call that starts just under
// the wire does not finish just over it.
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

let refreshInFlight = null;

function postForm(shopDomain, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const request = https.request(
      {
        method: 'POST',
        hostname: shopDomain,
        port: 443,
        path: TOKEN_PATH,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
      },
      (response) => {
        const chunks = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: response.statusCode, body: parsed, raw: text });
        });
      }
    );
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new ShopifyError('Shopify token request timed out', { code: 'TIMEOUT', isTimeout: true }));
    });
    request.on('error', (err) => reject(new ShopifyError(err.message, { code: err.code || 'NETWORK_ERROR' })));
    request.end(body);
  });
}

function decryptOrEmpty(envelope) {
  if (!envelope) return '';
  try {
    return secretBox.decrypt(envelope);
  } catch {
    return '';
  }
}

/**
 * The credentials, decrypted. Falls back to env vars so a fresh environment
 * can connect before an admin has ever opened the settings screen; the stored
 * values win once they exist.
 */
async function readCredentials() {
  const settings = await ShopifySettings.getSettingsWithSecrets();
  const clientId = decryptOrEmpty(settings.encryptedClientId) || process.env.SHOPIFY_CLIENT_ID || '';
  const clientSecret = decryptOrEmpty(settings.encryptedClientSecret) || process.env.SHOPIFY_CLIENT_SECRET || '';
  const shopDomain = settings.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN || '';
  return { settings, clientId, clientSecret, shopDomain };
}

function isFresh(settings) {
  if (!settings.encryptedAccessToken || !settings.accessTokenExpiresAt) return false;
  return settings.accessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
}

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ENOTFOUND',
  'ESOCKETTIMEDOUT',
  'TIMEOUT',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchToken({ shopDomain, clientId, clientSecret }) {
  if (!shopDomain || !clientId || !clientSecret) {
    throw new ShopifyError('Shopify is not configured — add the shop domain, client id and secret.', {
      code: 'NOT_CONFIGURED',
    });
  }

  // Retried on a network error, unlike the order mutations. Minting a token is
  // idempotent — a second request simply issues another one — so repeating it
  // cannot duplicate anything. Without this a single dropped connection failed
  // every push and every status poll behind it for that whole cycle.
  let response = null;
  let lastNetworkError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await postForm(shopDomain, {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });
      break;
    } catch (err) {
      lastNetworkError = err;
      if (!RETRYABLE_NETWORK_CODES.has(err.code) || attempt === 3) throw err;
      log({ event: 'SHOPIFY_TOKEN_RETRY', attempt, code: err.code });
      await sleep(300 * 2 ** (attempt - 1));
    }
  }
  if (!response) throw lastNetworkError;

  const { status, body, raw } = response;

  if (status < 200 || status >= 300 || !body?.access_token) {
    // These are the three failures worth naming, because each has a different
    // fix and the raw message does not say so.
    const error = String(body?.error || body?.error_description || raw || '').slice(0, 300);
    let hint = '';
    if (/app_not_installed/i.test(error)) {
      hint =
        ' The app exists but has not been installed on this store — releasing a version in the Dev Dashboard does not install it. Install it on the store, then connect again.';
    } else if (/shop_not_permitted/i.test(error)) {
      hint =
        ' The store is not in the same organisation as this app, so the client credentials grant will not work for it — the app has to be installed through OAuth instead.';
    } else if (/application_cannot_be_found/i.test(error)) {
      hint = ' The client id does not match any app on this store — copy it again from the Dev Dashboard.';
    } else if (status === 401) {
      hint = ' The client secret is wrong, or it was rotated after this value was saved.';
    }

    throw new ShopifyError(`Shopify refused the token request (${status}): ${error || 'no detail given'}.${hint}`, {
      status,
      code: 'TOKEN_REQUEST_FAILED',
      body: error,
    });
  }

  // expires_in is seconds; Shopify's client-credentials tokens are 24h.
  const expiresInSec = Number(body.expires_in) || 24 * 60 * 60;
  return {
    accessToken: body.access_token,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
    scopes: String(body.scope || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function refresh() {
  const { settings, clientId, clientSecret, shopDomain } = await readCredentials();
  try {
    const { accessToken, expiresAt, scopes } = await fetchToken({ shopDomain, clientId, clientSecret });

    settings.encryptedAccessToken = secretBox.encrypt(accessToken);
    settings.accessTokenExpiresAt = expiresAt;
    if (scopes.length) settings.grantedScopes = scopes;
    settings.status = 'CONNECTED';
    settings.lastSuccessAt = new Date();
    settings.failureReason = '';
    await settings.save();

    log({ event: 'SHOPIFY_TOKEN_REFRESHED', expiresAt: expiresAt.toISOString(), scopeCount: scopes.length });
    return { accessToken, shopDomain, apiVersion: settings.apiVersion };
  } catch (err) {
    settings.status = 'FAILED';
    settings.lastFailureAt = new Date();
    settings.failureReason = err.message.slice(0, 500);
    await settings.save();
    log({ event: 'SHOPIFY_TOKEN_REFRESH_FAILED', code: err.code, error: err.message });
    throw err;
  }
}

/**
 * A valid access token, refreshing it if needed.
 *
 * Concurrent callers share one refresh: the first starts it, the rest await
 * the same promise.
 */
async function getAccessToken({ force = false } = {}) {
  if (!force) {
    const settings = await ShopifySettings.getSettingsWithSecrets();
    if (isFresh(settings)) {
      const token = decryptOrEmpty(settings.encryptedAccessToken);
      if (token) {
        return {
          accessToken: token,
          shopDomain: settings.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN || '',
          apiVersion: settings.apiVersion,
        };
      }
    }
  }

  if (!refreshInFlight) {
    refreshInFlight = refresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Run a GraphQL operation with a valid token, retrying ONCE on a 401.
 *
 * The retry matters because a token can be revoked before it expires — an app
 * reinstall or a secret rotation does it — and the only way to find out is to
 * be refused. One forced refresh turns that into a self-healing blip instead
 * of an outage lasting until the cached token's expiry.
 */
async function withAuth(run) {
  const { accessToken, shopDomain, apiVersion } = await getAccessToken();
  try {
    return await run({ accessToken, shopDomain, apiVersion });
  } catch (err) {
    if (err?.code !== 'UNAUTHORIZED') throw err;
    log({ event: 'SHOPIFY_TOKEN_REJECTED_REFRESHING' });
    const fresh = await getAccessToken({ force: true });
    return run(fresh);
  }
}

/** Save credentials from the admin connect screen. */
async function saveCredentials({ shopDomain, clientId, clientSecret, apiVersion, adminId = null }) {
  const settings = await ShopifySettings.getSettingsWithSecrets();
  settings.shopDomain = String(shopDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  settings.encryptedClientId = secretBox.encrypt(String(clientId).trim());
  settings.encryptedClientSecret = secretBox.encrypt(String(clientSecret).trim());
  if (apiVersion) settings.apiVersion = String(apiVersion).trim();

  // A new credential invalidates whatever token the old one bought.
  settings.encryptedAccessToken = '';
  settings.accessTokenExpiresAt = null;
  settings.grantedScopes = [];
  settings.status = 'DISCONNECTED';
  settings.updatedBy = adminId;
  await settings.save();
  invalidateWebhookSecretCache();
  return settings;
}

async function disconnect({ adminId = null } = {}) {
  const settings = await ShopifySettings.getSettingsWithSecrets();
  settings.encryptedClientId = '';
  settings.encryptedClientSecret = '';
  settings.encryptedAccessToken = '';
  settings.accessTokenExpiresAt = null;
  settings.grantedScopes = [];
  settings.status = 'DISCONNECTED';
  settings.failureReason = '';
  settings.updatedBy = adminId;
  await settings.save();
  invalidateWebhookSecretCache();
  log({ event: 'SHOPIFY_DISCONNECTED' });
  return settings;
}

// The webhook secret, cached.
//
// The cache exists because Shopify's delivery timeout leaves no room for a
// Mongo read plus a decrypt on every push. It is invalidated explicitly
// whenever the credential changes — without that, a rotated or disconnected
// secret would keep verifying pushes until the TTL lapsed, which is a window
// where a credential you believe you revoked still works.
//
// Other instances still hold their own copy for up to the TTL; that is what
// the controller's re-read-once-on-mismatch is for.
const WEBHOOK_SECRET_TTL_MS = 60 * 1000;
let webhookSecretCache = { value: null, at: 0 };

function invalidateWebhookSecretCache() {
  webhookSecretCache = { value: null, at: 0 };
}

/** The client secret, for verifying inbound webhook HMACs. */
async function getWebhookSecret({ force = false } = {}) {
  if (!force && webhookSecretCache.value !== null && Date.now() - webhookSecretCache.at < WEBHOOK_SECRET_TTL_MS) {
    return webhookSecretCache.value;
  }
  const settings = await ShopifySettings.getSettingsWithSecrets();
  const secret = decryptOrEmpty(settings.encryptedClientSecret) || process.env.SHOPIFY_CLIENT_SECRET || '';
  webhookSecretCache = { value: secret, at: Date.now() };
  return secret;
}

module.exports = {
  getAccessToken,
  invalidateWebhookSecretCache,
  withAuth,
  saveCredentials,
  disconnect,
  getWebhookSecret,
  readCredentials,
  EXPIRY_SKEW_MS,
};
