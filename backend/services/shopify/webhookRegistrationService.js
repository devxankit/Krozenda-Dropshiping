const { graphql, userErrorsOf, ShopifyError, log } = require('./shopifyClient');
const { withAuth } = require('./shopifyAuthService');
const ShopifySettings = require('../../Models/ShopifySettings');

// Subscribing to Shopify's webhooks.
//
// Without this the integration is ONE WAY: orders are pushed to Shopify and
// nothing ever comes back — no fulfilment, no tracking number, no stock
// change, no cancellation. The endpoint existing is not the same as anything
// being sent to it, and the difference is invisible until a buyer asks where
// their parcel is.
//
// Registration is idempotent: existing subscriptions for a topic are updated
// rather than duplicated, because Shopify will happily hold several
// subscriptions for the same topic and then deliver the same event to all of
// them.

const TOPICS = Object.freeze([
  // Fulfilment and tracking — the whole reason this exists.
  'FULFILLMENTS_CREATE',
  'FULFILLMENTS_UPDATE',
  'ORDERS_FULFILLED',
  'ORDERS_PARTIALLY_FULFILLED',
  'ORDERS_UPDATED',
  'ORDERS_CANCELLED',

  // Catalogue and stock, so the local mirror does not drift.
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'INVENTORY_LEVELS_UPDATE',

  // Without this the push cron would keep retrying into a 401 forever after
  // someone uninstalls the app, and burn an admin alert every cycle.
  'APP_UNINSTALLED',
]);

const LIST = `
  query WebhookSubscriptions {
    webhookSubscriptions(first: 100) {
      nodes {
        id
        topic
        endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
      }
    }
  }
`;

const CREATE = `
  mutation WebhookCreate($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  mutation WebhookUpdate($id: ID!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionUpdate(id: $id, webhookSubscription: $sub) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

const DELETE = `
  mutation WebhookDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors { field message }
    }
  }
`;

const run = (query, variables, isMutation = false) =>
  withAuth(({ accessToken, shopDomain, apiVersion }) =>
    graphql({ query, variables, accessToken, shopDomain, apiVersion, isMutation, estimatedCost: 20 })
  );

/**
 * The URL Shopify will POST to.
 *
 * Must be public HTTPS — Shopify cannot reach localhost, and a webhook that
 * cannot be delivered is silently dropped after Shopify gives up retrying.
 */
function callbackUrl(baseUrl) {
  const base = String(baseUrl || process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!base) throw new ShopifyError('No backend URL configured for webhooks.', { code: 'NO_BACKEND_URL' });
  if (!/^https:\/\//i.test(base)) {
    throw new ShopifyError(
      `Webhooks need a public HTTPS address; "${base}" is not one. In development, expose the server with a tunnel and pass that URL.`,
      { code: 'INSECURE_CALLBACK' }
    );
  }
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(base)) {
    throw new ShopifyError(`Shopify cannot reach "${base}". Use a publicly reachable address.`, {
      code: 'UNREACHABLE_CALLBACK',
    });
  }
  return `${base}/webhook/shopify`;
}

async function list() {
  const data = await run(LIST, {});
  return (data?.webhookSubscriptions?.nodes || []).map((n) => ({
    id: n.id,
    topic: n.topic,
    callbackUrl: n.endpoint?.callbackUrl || null,
  }));
}

/**
 * Subscribe to every topic the integration needs, pointing at `baseUrl`.
 *
 * One failed topic does not stop the rest: a store missing one capability
 * should still get the other nine, and the result says exactly which failed.
 */
async function register({ baseUrl = null, adminId = null } = {}) {
  const url = callbackUrl(baseUrl);
  const existing = await list();
  const byTopic = new Map(existing.map((s) => [s.topic, s]));

  const results = [];
  for (const topic of TOPICS) {
    const current = byTopic.get(topic);
    try {
      if (current && current.callbackUrl === url) {
        results.push({ topic, ok: true, action: 'unchanged' });
        continue;
      }
      if (current) {
        // Update rather than add: two subscriptions for one topic means every
        // event is delivered twice.
        const data = await run(UPDATE, { id: current.id, sub: { callbackUrl: url, format: 'JSON' } }, true);
        const err = userErrorsOf(data?.webhookSubscriptionUpdate);
        if (err) throw new ShopifyError(err, { code: 'WEBHOOK_UPDATE_REJECTED' });
        results.push({ topic, ok: true, action: 're-pointed' });
        continue;
      }
      const data = await run(CREATE, { topic, sub: { callbackUrl: url, format: 'JSON' } }, true);
      const err = userErrorsOf(data?.webhookSubscriptionCreate);
      if (err) throw new ShopifyError(err, { code: 'WEBHOOK_CREATE_REJECTED' });
      results.push({ topic, ok: true, action: 'created' });
    } catch (err) {
      results.push({ topic, ok: false, error: err.message });
    }
  }

  const registered = results.filter((r) => r.ok).map((r) => r.topic);
  const settings = await ShopifySettings.getSettings();
  settings.webhookCallbackUrl = url;
  settings.webhookRegisteredAt = new Date();
  settings.webhookTopics = registered;
  if (adminId) settings.updatedBy = adminId;
  await settings.save();

  log({ event: 'SHOPIFY_WEBHOOKS_REGISTERED', url, ok: registered.length, failed: results.length - registered.length });

  return { url, results, registered: registered.length, failed: results.length - registered.length };
}

/** Remove every subscription pointing at this server. */
async function unregister({ adminId = null } = {}) {
  const settings = await ShopifySettings.getSettings();
  const ours = settings.webhookCallbackUrl;
  const existing = await list();

  let removed = 0;
  for (const sub of existing) {
    // Only ours: another app's subscriptions on the same store are not this
    // integration's to delete.
    if (ours && sub.callbackUrl !== ours) continue;
    const data = await run(DELETE, { id: sub.id }, true);
    const err = userErrorsOf(data?.webhookSubscriptionDelete);
    if (!err) removed += 1;
  }

  settings.webhookTopics = [];
  settings.webhookRegisteredAt = null;
  if (adminId) settings.updatedBy = adminId;
  await settings.save();

  log({ event: 'SHOPIFY_WEBHOOKS_UNREGISTERED', removed });
  return { removed };
}

/** What is subscribed, and what is missing. */
async function health() {
  const settings = await ShopifySettings.getSettings();
  const subs = await list();
  const have = new Set(subs.filter((s) => !settings.webhookCallbackUrl || s.callbackUrl === settings.webhookCallbackUrl).map((s) => s.topic));
  return {
    callbackUrl: settings.webhookCallbackUrl || null,
    registeredAt: settings.webhookRegisteredAt,
    subscriptions: subs,
    missing: TOPICS.filter((t) => !have.has(t)),
    healthy: TOPICS.every((t) => have.has(t)),
  };
}

module.exports = { register, unregister, list, health, callbackUrl, TOPICS };
