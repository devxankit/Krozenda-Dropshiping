const crypto = require('crypto');
const cjInventoryService = require('../services/cj/cjInventoryService');
const cjLogisticsService = require('../services/cj/cjLogisticsService');

// POST /webhook/cj — CJ's product/stock AND logistics/tracking notifications
// share this one endpoint (CJ does not offer separate webhook URLs per
// event category). Fast-path for both inventory sync and tracking sync;
// cjSyncJob / cjTrackingPoller's polling remain the fallback for whatever
// this endpoint misses (master plan §12).
//
// CJ signs webhook payloads with HMAC-SHA256 (unlike Shiprocket's shared
// static token) — verified the same way paymentWebhookController verifies
// Razorpay: over the RAW body, not our re-serialized parse of it.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'CJ', at: new Date().toISOString(), ...entry }));
}

function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function handleCjWebhook(req, res) {
  const secret = process.env.CJ_WEBHOOK_SECRET;

  // Fail closed: an unconfigured secret must never mean "accept everything".
  if (!secret) {
    log({ event: 'CJ_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('x-cj-signature') || req.get('cj-signature') || '';
  if (!verifySignature(req.rawBody, signature, secret)) {
    log({ event: 'CJ_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Acknowledge immediately — CJ retries on non-2xx, and we don't want a slow
  // downstream sync to look like a delivery failure and trigger a retry storm.
  res.json({ success: true });

  const type = req.body?.type || req.body?.event || 'UNKNOWN';
  const productId = req.body?.data?.pid || req.body?.data?.productId || req.body?.pid;
  const cjOrderId = req.body?.data?.orderId || req.body?.orderId;

  log({ event: 'CJ_WEBHOOK_RECEIVED', type, productId, cjOrderId });

  const isTrackingEvent = /track|logistic|shipment/i.test(type);

  try {
    if (isTrackingEvent && cjOrderId) {
      const shipment = await cjLogisticsService.syncByCjOrderId(cjOrderId);
      log({ event: 'CJ_WEBHOOK_TRACKING_SYNC_RESULT', cjOrderId, status: shipment.status });
      return;
    }

    if (productId) {
      const result = await cjInventoryService.syncOneByCjProductId(productId, { trigger: 'WEBHOOK' });
      log({ event: 'CJ_WEBHOOK_SYNC_RESULT', productId, ok: result.ok });
    }
  } catch (err) {
    // Not onboarded, or sync failed — logged via the relevant service's own
    // write; nothing more to do here since the response is already sent.
    log({ event: 'CJ_WEBHOOK_SYNC_ERROR', productId, cjOrderId, error: err.message });
  }
}

module.exports = { handleCjWebhook, verifySignature };
