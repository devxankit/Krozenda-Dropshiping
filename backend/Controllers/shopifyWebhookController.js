const crypto = require('crypto');
const ShopifyWebhookEvent = require('../Models/ShopifyWebhookEvent');
const { getWebhookSecret } = require('../services/shopify/shopifyAuthService');

// Inbound Shopify webhooks.
//
// Shopify signs every push: base64(HMAC-SHA256(rawBody, clientSecret)) in the
// X-Shopify-Hmac-Sha256 header. The signature is over the RAW bytes, so it
// must be computed before any JSON parsing normalises them — app.js captures
// them into req.rawBody via express.json({ verify }).
//
// The order of operations below is deliberate and is the same contract the
// other webhook handlers in this folder follow:
//
//   1. Fail CLOSED with 503 when no secret is configured. An unverifiable
//      push is not a trusted push, and silently accepting one means anyone who
//      learns the URL can move stock and order status.
//   2. Verify the HMAC in constant time.
//   3. Reply 200 IMMEDIATELY, then process. Shopify's delivery timeout is
//      short; a handler that works first and replies after gets retried while
//      it is still working, which is how one event becomes four.
//   4. Dedupe on X-Shopify-Webhook-Id before doing anything.
//
// A payload is DATA, never instruction: nothing here trusts a field to say
// which shop it came from. The signature is what proves the sender.

function log(entry) {
  console.log(JSON.stringify({ scope: 'SHOPIFY_WEBHOOK', at: new Date().toISOString(), ...entry }));
}

// Caching lives in shopifyAuthService, which owns the secret and so is the
// only thing that knows when it has changed. Caching it here as well would
// mean a rotated secret kept verifying pushes until this copy expired too.
async function loadSecret({ force = false } = {}) {
  return (await getWebhookSecret({ force })) || null;
}

function verifySignature(rawBody, header, secret) {
  if (!rawBody || !header || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let given;
  try {
    given = Buffer.from(String(header), 'base64');
  } catch {
    return false;
  }
  // timingSafeEqual throws on a length mismatch, so the length is checked
  // first — and the comparison itself stays constant-time.
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const inboundOrderSync = require('../services/shopify/inboundOrderSync');
const inboundCatalogSync = require('../services/shopify/inboundCatalogSync');

/**
 * Topic -> handler.
 *
 * A topic with no handler is LOGGED as unhandled rather than silently
 * accepted, so a subscription nobody wired up is visible instead of looking
 * like it works.
 */
const HANDLERS = Object.freeze({
  'fulfillments/create': ({ payload }) => inboundOrderSync.handleFulfillment(payload),
  'fulfillments/update': ({ payload }) => inboundOrderSync.handleFulfillment(payload),
  'orders/updated': ({ payload }) => inboundOrderSync.handleOrderUpdated(payload),
  'orders/fulfilled': ({ payload }) => inboundOrderSync.handleOrderUpdated(payload),
  'orders/partially_fulfilled': ({ payload }) => inboundOrderSync.handleOrderUpdated(payload),
  'orders/cancelled': ({ payload }) => inboundOrderSync.handleOrderCancelled(payload),

  // Catalogue and stock. Without these an imported product keeps the stock
  // figure it had at import and oversells the moment the supplier runs out.
  'products/update': ({ payload }) => inboundCatalogSync.handleProductWebhook(payload),
  'products/delete': ({ payload }) => inboundCatalogSync.handleProductWebhook(payload, { deleted: true }),
  'inventory_levels/update': ({ payload }) => inboundCatalogSync.handleInventoryWebhook(payload),

  // The app was removed from the store. Mark the connection dead so the push
  // cron stops retrying into a 401 and alerting on every cycle.
  'app/uninstalled': async () => {
    const ShopifySettings = require('../Models/ShopifySettings');
    const settings = await ShopifySettings.getSettings();
    settings.status = 'DISCONNECTED';
    settings.failureReason = 'The Krozenda app was uninstalled from the Shopify store.';
    settings.webhookTopics = [];
    await settings.save();
    return { handled: true, disconnected: true };
  },
});

async function processMessage({ topic, payload, shopDomain }) {
  const handler = HANDLERS[topic];
  if (!handler) {
    log({ event: 'SHOPIFY_WEBHOOK_UNHANDLED', topic, shopDomain });
    return;
  }
  await handler({ payload, shopDomain, topic });
}

async function handleShopifyWebhook(req, res) {
  const topic = req.get('x-shopify-topic') || '';
  const shopDomain = req.get('x-shopify-shop-domain') || '';
  const webhookId = req.get('x-shopify-webhook-id') || '';
  const apiVersion = req.get('x-shopify-api-version') || '';
  const triggeredAt = req.get('x-shopify-triggered-at') || null;

  let secret = await loadSecret();
  if (!secret) {
    log({ event: 'SHOPIFY_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED', topic, shopDomain });
    return res.status(503).json({ success: false, message: 'Shopify webhooks are not configured' });
  }

  const header = req.get('x-shopify-hmac-sha256');
  let valid = verifySignature(req.rawBody, header, secret);
  if (!valid) {
    // The secret may have been rotated by another instance since this one
    // cached it. Re-read once before calling it a forgery.
    secret = await loadSecret({ force: true });
    valid = verifySignature(req.rawBody, header, secret);
  }
  if (!valid) {
    log({ event: 'SHOPIFY_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE', topic, shopDomain, webhookId });
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // Verified. Acknowledge now; the work happens after the reply.
  res.status(200).json({ success: true });

  try {
    if (webhookId) {
      try {
        await ShopifyWebhookEvent.create({
          webhookId,
          topic,
          shopDomain,
          apiVersion,
          triggeredAt: triggeredAt ? new Date(triggeredAt) : null,
        });
      } catch (err) {
        if (err.code === 11000) {
          log({ event: 'SHOPIFY_WEBHOOK_DUPLICATE', topic, webhookId });
          return;
        }
        // A dedupe failure that is NOT a duplicate (a transient write error)
        // must not drop the message — carry on and risk re-applying rather
        // than lose it. Every handler is written to be idempotent for this
        // reason.
        log({ event: 'SHOPIFY_WEBHOOK_DEDUPE_FAILED', topic, webhookId, error: err.message });
      }
    }

    let payload = null;
    try {
      payload = req.rawBody ? JSON.parse(req.rawBody.toString('utf8')) : req.body;
    } catch {
      log({ event: 'SHOPIFY_WEBHOOK_UNPARSEABLE', topic, webhookId });
      return;
    }

    await processMessage({ topic, payload, shopDomain });
  } catch (err) {
    log({ event: 'SHOPIFY_WEBHOOK_PROCESSING_FAILED', topic, webhookId, error: err.message });
    if (webhookId) {
      await ShopifyWebhookEvent.updateOne(
        { webhookId },
        { $set: { processingError: String(err.message).slice(0, 500) } }
      ).catch(() => {});
    }
  }
}

module.exports = { handleShopifyWebhook, verifySignature, HANDLERS };
