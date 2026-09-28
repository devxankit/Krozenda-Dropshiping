const CjSettings = require('../../Models/CjSettings');
const { call, CjError } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');

// Registers this server's /webhook/cj endpoint with CJ. CJ has no dashboard
// screen for webhooks — POST /v1/webhook/set is the only way to set them,
// one callback URL per topic.

const SET_PATH = '/v1/webhook/set';
const TOPICS = ['product', 'stock', 'order', 'logistics'];

function validateCallbackUrl(callbackUrl) {
  let url;
  try {
    url = new URL(callbackUrl);
  } catch {
    return 'callbackUrl is not a valid URL';
  }
  if (url.protocol !== 'https:') return 'CJ only accepts a public HTTPS callback URL';
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname)) {
    return 'CJ does not accept localhost callback URLs';
  }
  return null;
}

async function setTopics(type, callbackUrl) {
  const body = {};
  for (const topic of TOPICS) {
    body[topic] = { type, callbackUrls: type === 'ENABLE' ? [callbackUrl] : [] };
  }

  const { body: res } = await cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() =>
      call({ method: 'POST', path: SET_PATH, accessToken, body, idempotent: false })
    )
  );
  if (res && res.result === false) {
    throw new CjError(res.message || 'CJ rejected the webhook settings', { code: 'CJ_WEBHOOK_REJECTED', body: res });
  }
  return res;
}

async function register({ callbackUrl }) {
  const invalid = validateCallbackUrl(callbackUrl);
  if (invalid) throw new CjError(invalid, { code: 'CJ_WEBHOOK_BAD_URL', status: 400 });

  // Without the openId we could not verify a single push, and CJ switches a
  // webhook off once under 80% of deliveries succeed for two hours.
  const secret = await cjAuthService.getWebhookSecret({ ensure: true });
  if (!secret) {
    throw new CjError('CJ login returned no openId to verify webhooks with', { code: 'CJ_WEBHOOK_NO_SECRET' });
  }

  await setTopics('ENABLE', callbackUrl);

  const settings = await CjSettings.getSettings();
  settings.webhookCallbackUrl = callbackUrl;
  settings.webhookRegisteredAt = new Date();
  await settings.save();
  return settings;
}

async function unregister() {
  await setTopics('CANCEL');
  const settings = await CjSettings.getSettings();
  settings.webhookCallbackUrl = '';
  settings.webhookRegisteredAt = null;
  await settings.save();
  return settings;
}

module.exports = { register, unregister, validateCallbackUrl, SET_PATH, TOPICS };
