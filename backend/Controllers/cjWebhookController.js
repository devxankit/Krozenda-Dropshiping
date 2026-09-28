const crypto = require('crypto');
const CjWebhookEvent = require('../Models/CjWebhookEvent');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const cjAuthService = require('../services/cj/cjAuthService');
const cjInventoryService = require('../services/cj/cjInventoryService');
const cjLogisticsService = require('../services/cj/cjLogisticsService');
const cjOrderService = require('../services/cj/cjOrderService');

// POST /webhook/cj — every CJ topic (product, stock, order, logistics) is
// registered to this one URL by cjWebhookService.register. Fast-path for
// inventory and tracking sync; cjSyncJob / cjTrackingPoller's polling
// remain the fallback for whatever this endpoint misses (master plan §12).
//
// Per CJ's webhook docs (developers.cjdropshipping.com/en/api/start/webhook):
//   header  sign = Base64(HmacSHA256(key = openId, message = raw body))
//   body    { messageId, type, messageType, params }, where params is
//             PRODUCT   { pid, … }
//             VARIANT   { vid, … }
//             STOCK     { "<vid>": [{ vid, areaId, storageNum }], … } — keyed by variant
//             ORDER     { cjOrderId, orderNumber, orderStatus, trackNumber, … }
//             LOGISTIC  { orderId, trackingNumber, … }
//   reply   200 within 3 seconds; CJ retries up to 3 times, and switches the
//           webhook off if under 80% succeed for two consecutive hours.

// A product synced this recently is not re-fetched — one sync is 30 CJ API
// points, and CJ can push several stock/variant messages for one product in
// a burst.
const MIN_RESYNC_MS = Number(process.env.CJ_WEBHOOK_MIN_RESYNC_MINUTES || 5) * 60 * 1000;

const PRODUCT_TYPES = new Set(['PRODUCT', 'VARIANT', 'STOCK']);
const TRACKING_TYPES = new Set(['LOGISTIC', 'LOGISTICS']);

// The openId never changes for an account, so it is read from Mongo once per
// process — the 3-second reply budget has no room for a lookup per push.
let cachedSecret = null;

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'CJ', at: new Date().toISOString(), ...entry }));
}

function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function loadSecret({ reload = false } = {}) {
  if (!cachedSecret || reload) {
    cachedSecret = await cjAuthService.getWebhookSecret();
  }
  return cachedSecret;
}

// Variant ids a message is about: VARIANT carries one as params.vid, STOCK
// keys its params object by vid.
function variantIds(params) {
  if (params.vid) return [String(params.vid)];
  return Object.keys(params).filter((key) => Array.isArray(params[key]));
}

async function syncMapping(mapping) {
  if (mapping.syncStatus === 'SYNCING') return 'ALREADY_SYNCING';
  if (mapping.lastSyncedAt && Date.now() - mapping.lastSyncedAt.getTime() < MIN_RESYNC_MS) {
    return 'RECENTLY_SYNCED';
  }
  const result = await cjInventoryService.syncMapping(mapping, { trigger: 'WEBHOOK' });
  return result?.ok ? 'SYNCED' : 'SYNC_FAILED';
}

async function syncProduct(params) {
  let mappings;
  if (params.pid) {
    mappings = await ProductFulfillmentMapping.find({ provider: 'CJ', cjProductId: params.pid });
  } else {
    const vids = variantIds(params);
    mappings = vids.length
      ? await ProductFulfillmentMapping.find({ provider: 'CJ', 'variants.cjVariantId': { $in: vids } })
      : [];
  }
  // Most pushes are for CJ products we never onboarded — nothing to do.
  if (!mappings.length) return { skipped: 'NOT_ONBOARDED' };

  // One at a time: each sync spends CJ API points through the shared queue.
  const results = {};
  for (const mapping of mappings) {
    results[mapping.cjProductId] = await syncMapping(mapping);
  }
  return { results };
}

async function processMessage(body) {
  const type = String(body.type || '').toUpperCase();
  const params = body.params || {};

  if (PRODUCT_TYPES.has(type)) return syncProduct(params);

  if (type === 'ORDER') {
    const cjOrderId = params.cjOrderId || params.orderNumber;
    if (!cjOrderId) return { skipped: 'NO_ORDER_ID' };
    try {
      const cjOrder = await cjOrderService.refreshOrderStatus(String(cjOrderId));
      return { status: cjOrder.status };
    } catch (err) {
      // An order placed on CJ outside Krozenda has no CjOrder row.
      if (err.status === 404) return { skipped: 'UNKNOWN_ORDER' };
      throw err;
    }
  }

  if (TRACKING_TYPES.has(type) && params.orderId) {
    try {
      const shipment = await cjLogisticsService.syncByCjOrderId(params.orderId);
      return { status: shipment.status };
    } catch (err) {
      // An order placed on CJ outside Krozenda has no CjOrder row.
      if (/not found/i.test(err.message)) return { skipped: 'UNKNOWN_ORDER' };
      throw err;
    }
  }

  return { skipped: 'UNHANDLED_TYPE' };
}

async function handleCjWebhook(req, res) {
  let secret = await loadSecret();

  // Fail closed: no openId on file must never mean "accept everything".
  if (!secret) {
    log({ event: 'CJ_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('sign') || '';
  let valid = verifySignature(req.rawBody, signature, secret);
  if (!valid) {
    // The account may have been reconnected by another server instance
    // sharing this database — re-read once before rejecting.
    secret = await loadSecret({ reload: true });
    valid = verifySignature(req.rawBody, signature, secret);
  }
  if (!valid) {
    log({ event: 'CJ_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Acknowledge immediately — a sync can take longer than CJ's 3-second
  // window, and a timeout counts against the delivery rate.
  res.json({ success: true });

  const body = req.body || {};
  const { messageId, type, messageType } = body;
  const params = body.params || {};
  log({ event: 'CJ_WEBHOOK_RECEIVED', messageId, type, messageType, pid: params.pid, vids: variantIds(params), orderId: params.orderId || params.cjOrderId });

  if (messageId) {
    try {
      await CjWebhookEvent.create({ messageId: String(messageId), type, messageType });
    } catch (err) {
      if (err.code === 11000) {
        log({ event: 'CJ_WEBHOOK_DUPLICATE', messageId });
        return;
      }
      // The reply is already sent; carry on without dedupe rather than drop it.
      log({ event: 'CJ_WEBHOOK_DEDUPE_ERROR', messageId, error: err.message });
    }
  }

  try {
    const result = await processMessage(body);
    log({ event: 'CJ_WEBHOOK_PROCESSED', messageId, type, ...result });
  } catch (err) {
    // The polling jobs pick up whatever this missed.
    log({ event: 'CJ_WEBHOOK_SYNC_ERROR', messageId, type, error: err.message });
  }
}

function resetSecretCache() {
  cachedSecret = null;
}

module.exports = { handleCjWebhook, verifySignature, resetSecretCache };
