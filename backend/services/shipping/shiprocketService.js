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
// NOT VERIFIED — paths appear in third-party SDKs but I could not confirm them
// against official documentation (apidocs.shiprocket.in is a JS-rendered SPA).
// Per task §52 these are NOT implemented. Each throws a typed, actionable error
// instead of guessing at a path and silently doing the wrong thing:
//
//   pickup location add/list · order cancel · return order create
//   tracking by shipment-id / order-id · NDR actions · shipments list
//
// To enable them: confirm each against the official Shiprocket Postman
// collection, then replace the corresponding notImplemented() body.

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

// --- unverified capabilities ------------------------------------------------
// Each throws rather than guessing. The signatures are settled so callers can
// be written against them now and the bodies filled in once verified.

async function addPickupLocation() {
  throw notImplemented(
    'Pickup location registration',
    'Shiprocket requires pickup locations to be registered against the account before create/adhoc will accept them. Until the endpoint is verified, register the location manually in the Shiprocket panel and record its exact nickname on the PickupLocation.'
  );
}

async function listPickupLocations() {
  throw notImplemented('Pickup location listing');
}

async function cancelShipment() {
  throw notImplemented('Shipment cancellation');
}

async function createReturn() {
  throw notImplemented('Return shipment creation');
}

async function trackByShipmentId() {
  throw notImplemented('Tracking by shipment id', 'Use trackByAwb, whose path is verified.');
}

async function trackByOrderId() {
  throw notImplemented('Tracking by order id', 'Use trackByAwb, whose path is verified.');
}

async function getNdrShipments() {
  throw notImplemented('NDR listing');
}

async function actOnNdr() {
  throw notImplemented('NDR action');
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

  addPickupLocation: false,
  listPickupLocations: false,
  cancelShipment: false,
  createReturn: false,
  trackByShipmentId: false,
  trackByOrderId: false,
  ndr: false,
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
  notImplemented,
};
