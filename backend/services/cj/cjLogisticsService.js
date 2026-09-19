const { call } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');
const CjShipment = require('../../Models/CjShipment');
const CjOrder = require('../../Models/CjOrder');

// Phase 6 — freight calculation, shipment creation follow-up, and tracking.
// Same caveat as cjOrderService: exact CJ field names should be confirmed
// against a live sandbox account; the sync/mapping architecture is what
// matters here and does not depend on getting every field right first try.

const FREIGHT_PATH = '/v1/logistic/freightCalculate';
const TRACKING_PATH = '/v1/logistic/trackInfo';

function authenticatedCall(request) {
  return cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() => call({ ...request, accessToken }))
  );
}

// Freight quote shown at checkout time (master plan §17) — separate line
// item from the product price, never silently folded into it.
async function calculateFreight({ startCountryCode, endCountryCode, zip, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items are required for a freight quote');
  }

  const { body } = await authenticatedCall({
    method: 'POST',
    path: FREIGHT_PATH,
    idempotent: true,
    body: {
      startCountryCode,
      endCountryCode,
      zip,
      products: items.map((i) => ({ vid: i.cjVariantId, quantity: i.quantity })),
    },
  });

  const options = body?.data || [];
  // Cheapest logistics option first — the admin/checkout UI picks from this
  // list, this service never silently auto-selects one.
  return [...options].sort((a, b) => (a.logisticPrice ?? 0) - (b.logisticPrice ?? 0));
}

function mapTrackingStatus(cjStatus) {
  const map = {
    IN_TRANSIT: 'IN_TRANSIT',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    DELIVERY_FAILED: 'DELIVERY_FAILED',
    RETURNED: 'RTO',
    PICKED_UP: 'SHIPPED',
  };
  return map[cjStatus] || 'PROCESSING';
}

// Pulls CJ's current tracking info for one shipment and writes it. Called by
// both the webhook path (fast) and the polling job (fallback) — identical
// idempotent write either way, since it's a straight overwrite of the
// tracking events list, not an append that could duplicate.
async function syncShipment(cjShipment) {
  const { body } = await authenticatedCall({
    method: 'GET',
    path: TRACKING_PATH,
    query: { orderId: cjShipment.cjOrderId },
    idempotent: true,
  });

  const data = body?.data;
  if (!data) return cjShipment;

  cjShipment.trackingNumber = data.trackingNumber || cjShipment.trackingNumber;
  cjShipment.carrier = data.logisticName || cjShipment.carrier;
  cjShipment.status = mapTrackingStatus(data.trackStatus);
  cjShipment.trackingEvents = (data.trackInfoList || []).map((e) => ({
    status: e.trackStatus || '',
    description: e.trackDescription || '',
    location: e.trackLocation || '',
    occurredAt: e.trackTime ? new Date(e.trackTime) : null,
  }));
  cjShipment.lastSyncedAt = new Date();
  await cjShipment.save();

  return cjShipment;
}

// Ensures a shipment row exists for a CJ order once it's confirmed (creation
// itself happens the first time tracking is checked/synced — CJ does not
// hand back a tracking number at order-creation time).
async function getOrCreateShipment(cjOrder) {
  let shipment = await CjShipment.findOne({ cjOrder: cjOrder._id });
  if (!shipment) {
    shipment = await CjShipment.create({ cjOrder: cjOrder._id, cjOrderId: cjOrder.cjOrderId });
  }
  return shipment;
}

async function syncByCjOrderId(cjOrderId) {
  const cjOrder = await CjOrder.findOne({ cjOrderId });
  if (!cjOrder) throw new Error('CJ order not found for tracking sync');

  const shipment = await getOrCreateShipment(cjOrder);
  return syncShipment(shipment);
}

module.exports = { calculateFreight, syncShipment, syncByCjOrderId, getOrCreateShipment };
