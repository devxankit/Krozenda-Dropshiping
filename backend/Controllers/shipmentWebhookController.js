const Shipment = require('../Models/Shipment');
const { safeEqual } = require('../utils/secretBox');
const trackingService = require('../services/shipping/trackingService');
const { mapShiprocketStatus } = require('../Config/shipping');

// POST /webhook — the only endpoint in this application reachable by an
// unauthenticated caller from the public internet. Behind the production
// proxy that is https://<host>/api/webhook.
//
// The path deliberately does not name the carrier: Shiprocket's own webhook
// setup screen rejects URLs containing "shiprocket", "kartrocket", "sr" or
// "kr". The sender is identified by the secret it presents, not by the path.
//
// WHAT AUTHENTICATION ACTUALLY IS HERE, stated plainly: Shiprocket does not
// sign its webhooks. It sends whatever custom headers you configure in
// Settings > API > Webhook. So the "signature" is a shared secret you invent
// (`x-api-key`), compared in constant time. That is genuinely weaker than an
// HMAC over the body: anyone holding the secret can post ANY payload, and the
// payload itself proves nothing about who sent it.
//
// Everything below follows from that:
//
//   * the secret is required — with none configured the endpoint refuses every
//     request rather than running open
//   * the payload is treated as a HINT, never as truth. It identifies a
//     shipment; it never supplies a price, an amount, an address or an order
//     id that we then act on
//   * status changes go through the same guarded path as the poller, so a
//     forged or replayed event cannot drive a shipment backwards or mark
//     something delivered out of order

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// Shiprocket's webhook body is documented loosely; the fields that matter are
// `awb` and `current_status`. Everything is read tolerantly, and anything we
// cannot read simply means "no update".
function readIdentifiers(body) {
  const pick = (...keys) => {
    for (const key of keys) {
      const value = body?.[key];
      if (value !== undefined && value !== null && value !== '') return String(value).trim();
    }
    return null;
  };

  return {
    awb: pick('awb', 'awb_code', 'awbCode'),
    carrierShipmentId: pick('shipment_id', 'shipmentId'),
    // NOT used to find the shipment: this is OUR reference echoed back, and
    // trusting a caller-supplied order id to select a record is how a webhook
    // endpoint becomes an IDOR.
    orderReference: pick('order_id', 'channel_order_id'),
    currentStatus: pick('current_status', 'status', 'shipment_status'),
    statusCode: body?.current_status_id ?? body?.status_code ?? null,
    scans: Array.isArray(body?.scans) ? body.scans : [],
  };
}

async function handleShiprocketWebhook(req, res) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;

  // Fail closed. An unconfigured secret must never mean "accept everything".
  if (!expected) {
    log({ event: 'SHIPROCKET_WEBHOOK_REJECTED', reason: 'NO_TOKEN_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const presented = req.get('x-api-key') || req.get('X-Api-Key') || '';
  if (!safeEqual(presented, expected)) {
    // Deliberately terse and slow to learn from: no hint about length, no echo
    // of what was sent.
    log({ event: 'SHIPROCKET_WEBHOOK_REJECTED', reason: 'BAD_TOKEN' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const ids = readIdentifiers(req.body);

  log({
    event: 'SHIPROCKET_WEBHOOK_RECEIVED',
    awb: ids.awb || null,
    carrierShipmentId: ids.carrierShipmentId || null,
    status: ids.currentStatus || null,
  });

  if (!ids.awb && !ids.carrierShipmentId) {
    // 200, not 400: the carrier will retry a non-2xx forever, and a payload we
    // cannot route is not going to become routable on the third attempt.
    return res.status(200).json({ success: true, message: 'Ignored: no shipment identifier' });
  }

  // Resolution is by CARRIER-ISSUED identifiers only — an AWB or Shiprocket's
  // own shipment id, both of which we stored when we created the parcel.
  const shipment = await Shipment.findOne(
    ids.awb ? { awbCode: ids.awb } : { shiprocketShipmentId: ids.carrierShipmentId }
  );

  if (!shipment) {
    // Also 200. A webhook for a parcel we do not have (a shipment created
    // directly in the Shiprocket panel, or one belonging to another system
    // sharing the account) is not an error on our side.
    log({ event: 'SHIPROCKET_WEBHOOK_UNKNOWN_SHIPMENT', awb: ids.awb || null });
    return res.status(200).json({ success: true, message: 'Ignored: unknown shipment' });
  }

  // The account check that makes multi-account webhooks safe (task §13): the
  // shipment carries an immutable snapshot of the account that created it, so
  // we already know whose parcel this is. The webhook does not get to say.
  try {
    const scans = ids.scans.map(trackingService.normaliseScan);

    // A webhook that carries no scan array still carries a headline status.
    // Turning that into a synthetic scan keeps ONE code path for dedupe and
    // for the no-downgrade rule.
    if (scans.length === 0 && ids.currentStatus) {
      scans.push(
        trackingService.normaliseScan({
          status: ids.currentStatus,
          date: req.body?.current_timestamp || req.body?.timestamp || new Date().toISOString(),
          location: req.body?.location || '',
          activity: req.body?.activity || ids.currentStatus,
        })
      );
    }

    const result = await trackingService.applyScans(shipment, scans, {
      source: 'WEBHOOK',
      summary: ids.currentStatus ? { currentStatus: ids.currentStatus } : null,
    });

    if (ids.statusCode !== null && ids.statusCode !== undefined) {
      const code = Number(ids.statusCode);
      if (Number.isFinite(code)) {
        shipment.shiprocketStatusCode = code;
        await shipment.save();
      }
    }

    log({
      event: 'SHIPROCKET_WEBHOOK_PROCESSED',
      shipmentId: String(shipment._id),
      newEvents: result.newEvents,
      statusChanged: result.statusChanged,
      // A duplicate delivery shows up here as 0 new events and no change —
      // which is exactly what idempotent means.
      duplicate: result.newEvents === 0 && !result.statusChanged,
      internalStatus: shipment.internalStatus,
      mapped: Boolean(mapShiprocketStatus(ids.currentStatus)),
    });

    return res.status(200).json({ success: true, message: 'Processed' });
  } catch (err) {
    // A 500 makes Shiprocket retry, which is what we want for a transient
    // failure on our side — unlike the "ignored" cases above, this one may
    // succeed on a second attempt.
    log({ event: 'SHIPROCKET_WEBHOOK_ERROR', shipmentId: String(shipment._id), message: err.message });
    return res.status(500).json({ success: false, message: 'Processing failed' });
  }
}

module.exports = { handleShiprocketWebhook, readIdentifiers };
