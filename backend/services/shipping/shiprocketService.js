const { call, ShiprocketError } = require('./shiprocketClient');
const { withAuth } = require('./shiprocketAuthService');

// Shiprocket's API surface, one function per operation.
//
// Every function takes the INTEGRATION to act as, never raw credentials —
// which is what keeps Seller A's parcel out of Seller B's account. Controllers
// never call this directly either; they go through shipmentService, so the
// business rules live in one place (task §51).
//
// ---------------------------------------------------------------------------
// ENDPOINT VERIFICATION STATUS  (task §52)
// ---------------------------------------------------------------------------
// VERIFIED against Shiprocket's own published documentation
// (support.shiprocket.in "Shiprocket API Document Helpsheet", Sept 2026):
//
//   POST /v1/external/auth/login                    token, valid 240h
//   GET  /v1/external/courier/serviceability/       ?pickup_postcode&delivery_postcode&weight&cod
//   POST /v1/external/orders/create/adhoc
//   POST /v1/external/courier/assign/awb
//   POST /v1/external/courier/generate/pickup
//   POST /v1/external/manifests/generate
//   POST /v1/external/manifests/print
//   POST /v1/external/courier/generate/label
//   POST /v1/external/orders/print/invoice
//   GET  /v1/external/courier/track/awb/{awb}
//   POST /v1/external/orders/address/update
//
//   POST /v1/external/orders/cancel                 {ids:[orderId]}
//   POST /v1/external/orders/cancel/shipment/awbs   {awbs:[awb]}  -> 204
//   POST /v1/external/orders/create/return
//   POST /v1/external/settings/company/addpickup
//   GET  /v1/external/settings/company/pickup
//   GET  /v1/external/courier/track/shipment/{shipment_id}
//   GET  /v1/external/courier/track?order_id&channel_id
//   GET  /v1/external/ndr/all
//   GET  /v1/external/ndr/{awb}
//   POST /v1/external/ndr/{awb}/action
//
// The second group was verified later, from Shiprocket's OFFICIAL Postman
// collection (owner 8407119, published id SzYW1zB2 - the same collection that
// backs apidocs.shiprocket.in, fetched as JSON because that page is a
// JS-rendered SPA). Paths, methods, request bodies and response shapes below
// come from that collection, not from a third-party SDK (task 52).
//
// Re-verifying: the collection JSON is at
//   https://documenter.gw.postman.com/api/collections/8407119/SzYW1zB2
// All nine endpoints in the first group were re-checked against it and match.

// A capability that exists in Shiprocket but whose exact contract has not been
// confirmed. Deliberately a hard, typed failure — never a fake success and
// never a silent no-op.
function notImplemented(capability, detail) {
  const err = new ShiprocketError(
    `${capability} is not enabled: its Shiprocket API contract has not been verified yet.`,
    { code: 'SHIPROCKET_CAPABILITY_UNVERIFIED', status: 501 }
  );
  err.capability = capability;
  err.detail = detail;
  return err;
}

// --- verified operations ---------------------------------------------------

// Serviceable couriers and their rates for a lane. Read-only and idempotent,
// so it is safe to retry.
async function checkServiceability(integration, { pickupPincode, deliveryPincode, weightKg, cod, declaredValue }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: '/v1/external/courier/serviceability/',
        token,
        query: {
          pickup_postcode: pickupPincode,
          delivery_postcode: deliveryPincode,
          weight: weightKg,
          // Shiprocket expects 1 / 0, not true / false.
          cod: cod ? 1 : 0,
          ...(declaredValue ? { declared_value: declaredValue } : {}),
        },
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Creates the order in Shiprocket.
//
// idempotent: false is deliberate and load-bearing. A timed-out create may
// still have succeeded at the carrier, so retrying would risk a duplicate
// parcel and duplicate billing. The caller marks the shipment
// RECONCILIATION_REQUIRED instead (task §38).
async function createOrder(integration, payload, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/create/adhoc',
        token,
        body: payload,
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Assigns a courier + AWB to a created shipment. Also not retried: a second
// call can assign a second AWB.
async function assignAWB(integration, { shipmentId, courierId }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/courier/assign/awb',
        token,
        body: {
          shipment_id: shipmentId,
          ...(courierId ? { courier_id: courierId } : {}),
        },
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function schedulePickup(integration, { shipmentIds }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/courier/generate/pickup',
        token,
        body: { shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds] },
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function generateLabel(integration, { shipmentIds }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/courier/generate/label',
        token,
        body: { shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds] },
        // Regenerating a label is harmless — it returns a URL to the same document.
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function generateManifest(integration, { shipmentIds }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/manifests/generate',
        token,
        body: { shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds] },
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function printInvoice(integration, { orderIds }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/print/invoice',
        token,
        body: { ids: Array.isArray(orderIds) ? orderIds : [orderIds] },
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Tracking by AWB — the one tracking variant with a confirmed path.
async function trackByAwb(integration, awbCode, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: `/v1/external/courier/track/awb/${encodeURIComponent(awbCode)}`,
        token,
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function updateDeliveryAddress(integration, payload, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/address/update',
        token,
        body: payload,
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// --- operations verified from the official Postman collection ---------------

// Cancel whole ORDERS, by Shiprocket order id.
//
// Distinct from cancelShipment below, and the distinction matters: before an
// AWB exists there is no shipment to cancel, only the order. Calling the wrong
// one leaves a live parcel the seller believes is cancelled.
async function cancelOrder(integration, { orderIds }, opts = {}) {
  const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).filter(Boolean);
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/cancel',
        token,
        body: { ids },
        // Never auto-retried: like every POST here, the caller decides.
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Cancel SHIPMENTS by AWB, once one has been assigned.
//
// The collection documents this as answering 204 WITH a body ("Bulk Shipment
// cancellation is in progress"), i.e. the cancellation is ASYNCHRONOUS. A 2xx
// here means "accepted", not "cancelled at the carrier" - the real outcome
// arrives by webhook, which is why shipmentService moves the shipment to
// CANCEL_REQUESTED rather than straight to CANCELLED.
async function cancelShipment(integration, { awbs }, opts = {}) {
  const list = (Array.isArray(awbs) ? awbs : [awbs]).filter(Boolean);
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/cancel/shipment/awbs',
        token,
        body: { awbs: list },
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Create a RETURN order: the buyer's address becomes the pickup, the seller's
// becomes the delivery. Shiprocket answers with its own order_id/shipment_id,
// which we store on a separate RETURN shipment document rather than
// overwriting the forward one (task 22).
async function createReturn(integration, payload, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/orders/create/return',
        token,
        body: payload,
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Register a pickup address with the carrier. `pickup_location` is the
// nickname every later create/adhoc call refers to, and Shiprocket requires it
// to be unique within the account - which is why PickupLocation stores the
// carrier-side name separately from our own.
async function addPickupLocation(integration, payload, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: '/v1/external/settings/company/addpickup',
        token,
        body: payload,
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function listPickupLocations(integration, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: '/v1/external/settings/company/pickup',
        token,
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

async function trackByShipmentId(integration, shipmentId, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: `/v1/external/courier/track/shipment/${encodeURIComponent(shipmentId)}`,
        token,
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Tracking by OUR order reference. Answers an ARRAY, unlike the by-AWB and
// by-shipment variants which answer an object - trackingService.extractScans
// already handles both shapes.
async function trackByOrderId(integration, { orderId, channelId }, opts = {}) {
  const query = new URLSearchParams({ order_id: String(orderId) });
  if (channelId) query.set('channel_id', String(channelId));

  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: `/v1/external/courier/track?${query.toString()}`,
        token,
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

// --- NDR: parcels a courier could not deliver -------------------------------

async function getNdrShipments(integration, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({ method: 'GET', path: '/v1/external/ndr/all', token, idempotent: true, onLog: opts.onLog }),
    opts
  );
}

async function getNdrByAwb(integration, awbCode, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'GET',
        path: `/v1/external/ndr/${encodeURIComponent(awbCode)}`,
        token,
        idempotent: true,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Tell the courier what to do with an undelivered parcel. `action` is
// Shiprocket's own vocabulary; it is passed through rather than mapped,
// because guessing at a carrier's action names is how a parcel gets returned
// when the seller asked for a re-attempt.
async function actOnNdr(integration, { awbCode, action, comments = '' }, opts = {}) {
  return withAuth(
    integration,
    (token) =>
      call({
        method: 'POST',
        path: `/v1/external/ndr/${encodeURIComponent(awbCode)}/action`,
        token,
        body: { action, comments },
        idempotent: false,
        onLog: opts.onLog,
      }),
    opts
  );
}

// Which capabilities are live. Read by the admin settings screen so the UI can
// disable what is not available instead of offering a button that 501s.
const CAPABILITIES = Object.freeze({
  serviceability: true,
  createOrder: true,
  assignAWB: true,
  schedulePickup: true,
  generateLabel: true,
  generateManifest: true,
  printInvoice: true,
  trackByAwb: true,
  updateDeliveryAddress: true,

  addPickupLocation: true,
  listPickupLocations: true,
  cancelOrder: true,
  cancelShipment: true,
  createReturn: true,
  trackByShipmentId: true,
  trackByOrderId: true,
  ndr: true,
});

module.exports = {
  checkServiceability,
  createOrder,
  assignAWB,
  schedulePickup,
  generateLabel,
  generateManifest,
  printInvoice,
  trackByAwb,
  updateDeliveryAddress,

  addPickupLocation,
  listPickupLocations,
  cancelShipment,
  createReturn,
  trackByShipmentId,
  trackByOrderId,
  getNdrShipments,
  actOnNdr,

  CAPABILITIES,
  cancelOrder,
  getNdrByAwb,
  notImplemented,
};
