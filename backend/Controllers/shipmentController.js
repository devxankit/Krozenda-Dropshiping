const mongoose = require('mongoose');
const Shipment = require('../Models/Shipment');
const shipmentService = require('../services/shipping/shipmentService');
const { readPagination, buildPagination } = require('../utils/pagination');
const { SHIPMENT_GROUPS } = require('../Config/shipping');
const trackingService = require('../services/shipping/trackingService');

// Shipment endpoints for the seller and admin panels.
//
// Ownership rule, applied identically everywhere: a VENDOR caller is scoped to
// `req.vendor._id`, an ADMIN caller is not scoped at all. That distinction is
// expressed once, in `scopeFor()`, so no handler can forget it.

function scopeFor(req) {
  // protectVendor sets req.vendor; protectAdmin sets req.admin. A vendor id is
  // never read from the request body or query (task §17, §28).
  return req.vendor ? req.vendor._id : null;
}

// Maps a service-layer failure onto an HTTP status. Everything not listed is a
// 400, because it is the caller's request that was wrong.
const STATUS_FOR = {
  INVALID_ORDER_ID: 400,
  INVALID_SHIPMENT_ID: 400,
  INVALID_PACKAGE: 400,
  INVALID_DELIVERY_ADDRESS: 400,
  ORDER_NOT_FOUND: 404,
  SHIPMENT_NOT_FOUND: 404,
  NO_ITEMS_FOR_VENDOR: 403,
  ORDER_NOT_PAID: 409,
  ORDER_NOT_SHIPPABLE: 409,
  SHIPMENT_ALREADY_EXISTS: 409,
  PICKUP_NOT_REGISTERED: 409,
  NOT_CREATED_AT_CARRIER: 409,
  NO_AWB: 409,
  NOT_SERVICEABLE: 409,
  COURIER_SELECTION_REQUIRED: 409,
  // 409 rather than 500: the shipment is in a known state that a human has to
  // resolve, and it is emphatically not a retry-able error.
  RECONCILIATION_REQUIRED: 409,
  AWB_NOT_RETURNED: 502,
  CARRIER_NO_IDENTIFIERS: 502,
  CARRIER_ERROR: 502,
  CARRIER_TIMEOUT: 504,
  SHIPPING_DISABLED: 503,
  PLATFORM_ACCOUNT_NOT_CONFIGURED: 503,
  SELLER_ACCOUNT_NOT_CONNECTED: 409,
  SELLER_ACCOUNT_UNHEALTHY: 409,
  FALLBACK_DISABLED: 409,
  NO_PICKUP_LOCATION: 409,
  // The parcel is already with the courier: cancelling is no longer the right
  // instrument, an RTO is.
  NOT_CANCELLABLE: 409,
  NOT_DELIVERED: 409,
  NOT_A_FORWARD_SHIPMENT: 400,
  NO_RETURNABLE_ITEMS: 400,
  INVALID_DOCUMENT_TYPE: 400,
  INVALID_NDR_ACTION: 400,
  NOT_NDR_ACTIONABLE: 409,
  // Not an error in the parcel's state — the carrier simply has not rendered
  // the PDF yet. Retrying in a moment is the right response.
  DOCUMENT_NOT_READY: 409,
};

// The buyer/seller-facing shape of a shipment. Deliberately omits `account`
// (an internal integration reference), `idempotencyKey` and `metadata` — none
// of which a client has any use for, and the first of which names a carrier
// account. Admin gets a little more, via `includeInternal`.
function serializeShipment(shipment, { includeInternal = false } = {}) {
  return {
    id: shipment._id.toString(),
    orderId: shipment.order.toString(),
    vendorId: shipment.vendor ? shipment.vendor.toString() : null,
    shipmentType: shipment.shipmentType,
    parentShipmentId: shipment.parentShipment ? shipment.parentShipment.toString() : null,

    items: shipment.items.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    itemCount: shipment.items.length,

    status: shipment.internalStatus,
    // The carrier's own wording, for support. Never drives UI logic.
    carrierStatus: shipment.shiprocketStatus || '',

    courierName: shipment.courierName || '',
    awbCode: shipment.awbCode || null,
    trackingUrl: shipment.trackingUrl || null,

    // Which carrier documents have already been rendered. Present so the UI can
    // offer "Print label" as a direct link once one exists, instead of asking
    // the carrier again on every press — see generateDocument's caching note.
    // A null simply means "not generated yet", not "unavailable".
    documents: {
      label: shipment.labelUrl || null,
      manifest: shipment.manifestUrl || null,
      invoice: shipment.invoiceUrl || null,
    },

    pickupLocation: shipment.pickupLocationName || '',
    pickupPincode: shipment.pickupAddress?.pincode || '',
    deliveryCity: shipment.deliveryAddress?.city || '',
    deliveryPincode: shipment.deliveryAddress?.pincode || '',

    package: shipment.package || null,
    paymentMethod: shipment.paymentMethod,
    collectableAmount: shipment.collectableAmount,
    declaredValue: shipment.declaredValue,

    pickupScheduledAt: shipment.pickupScheduledAt,
    pickedUpAt: shipment.pickedUpAt,
    deliveredAt: shipment.deliveredAt,
    estimatedDeliveryAt: shipment.estimatedDeliveryAt,
    createdAt: shipment.createdAt,

    // A shipment needing a human is surfaced to whoever can act on it.
    reconciliationRequired: shipment.reconciliationRequired,
    reconciliationNote: shipment.reconciliationRequired ? shipment.reconciliationNote : '',
    errorMessage: shipment.errorMessage || '',

    ...(includeInternal
      ? {
          // Which account shipped it — the name only, never a credential
          // (task §18: show "Seller Own Account", not the email).
          shippingAccountType: shipment.account?.accountType || null,
          shippingAccountOwnerId: shipment.account?.accountOwner
            ? shipment.account.accountOwner.toString()
            : null,
          carrierOrderId: shipment.shiprocketOrderId,
          carrierShipmentId: shipment.shiprocketShipmentId,
          carrierShippingCost: shipment.carrierShippingCost,
          // Higher than package.chargeableWeightKg means the courier measured
          // the parcel bigger than it was declared, and will bill for it.
          carrierAppliedWeightKg: shipment.carrierAppliedWeightKg,
          customerShippingCharge: shipment.customerShippingCharge,
          platformShippingMargin: shipment.platformShippingMargin,
          retryCount: shipment.retryCount,
          statusHistory: (shipment.statusHistory || []).map((h) => ({
            status: h.status,
            at: h.at,
            source: h.source,
            note: h.note || '',
          })),
        }
      : {}),
  };
}

function respondToFailure(res, result) {
  return res.status(STATUS_FOR[result.code] || 400).json({
    success: false,
    code: result.code,
    message: result.message,
    ...(result.errors ? { data: { errors: result.errors } } : {}),
    // A duplicate points at the shipment that already exists, so the UI can
    // navigate there instead of leaving the seller stuck.
    ...(result.shipmentId ? { data: { shipmentId: result.shipmentId } } : {}),
  });
}

// POST /vendor/shipments   |   POST /admin/shipments
async function createShipment(req, res) {
  const { orderId, pickupLocationId, package: confirmedPackage, vendorId: bodyVendorId } = req.body;

  let vendorId = req.vendor ? req.vendor._id : (bodyVendorId || null);

  // If Admin caller and vendorId wasn't passed, check if the order has items belonging to a single vendor
  if (!vendorId && req.admin && orderId && mongoose.isValidObjectId(orderId)) {
    const order = await mongoose.model('Order').findById(orderId).select('items').lean();
    if (order && Array.isArray(order.items)) {
      const vendorIds = [...new Set(order.items.map((i) => i.vendor ? i.vendor.toString() : null).filter(Boolean))];
      if (vendorIds.length === 1) {
        vendorId = vendorIds[0];
      }
    }
  }

  const result = await shipmentService.createShipment({
    orderId,
    vendorId,
    pickupLocationId,
    confirmedPackage,
    // Accepted from the standard header or the body, so a WebView client that
    // cannot easily set headers still gets duplicate protection (task §31).
    idempotencyKey: normaliseIdempotencyKey(req.get('Idempotency-Key') || req.body.idempotencyKey),
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.status(result.alreadyExisted ? 200 : 201).json({
    success: true,
    message: result.alreadyExisted ? 'Shipment already created' : 'Shipment created',
    data: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
  });
}

// POST /vendor/shipments/:id/awb
async function assignAwb(req, res) {
  const result = await shipmentService.assignAwb({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    // A courier the caller explicitly chose. Validated by the carrier, not
    // trusted blindly here.
    courierId: req.body?.courierId ? Number(req.body.courierId) : null,
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: result.alreadyExisted ? 'AWB already assigned' : 'AWB assigned',
    data: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
  });
}

// POST /vendor/shipments/:id/pickup
async function schedulePickup(req, res) {
  const result = await shipmentService.schedulePickup({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: result.alreadyExisted ? 'Pickup already scheduled' : 'Pickup scheduled',
    data: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
  });
}

// GET /vendor/shipments  |  GET /admin/shipments
async function listShipments(req, res) {
  const { status, group, awb, orderId, vendorId: filterVendorId } = req.query;
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const filter = {};
  const scope = scopeFor(req);
  if (scope) {
    // A seller sees only their own, whatever they put in the query string.
    filter.vendor = scope;
  } else if (filterVendorId && mongoose.isValidObjectId(filterVendorId)) {
    // Admin may filter BY vendor.
    filter.vendor = filterVendorId;
  }

  // `group` is the tab a list screen shows (TO_SHIP, ATTENTION, ...); `status`
  // is one exact internal state. Both are allowlisted against the vocabulary,
  // so an unknown value narrows nothing rather than throwing a cast error.
  if (group && SHIPMENT_GROUPS[group]) {
    filter.internalStatus = { $in: SHIPMENT_GROUPS[group] };
  } else if (status && Shipment.SHIPMENT_STATUSES.includes(status)) {
    filter.internalStatus = status;
  }
  if (awb) filter.awbCode = String(awb).trim();
  if (orderId && mongoose.isValidObjectId(orderId)) filter.order = orderId;

  // The tab counts are computed over the SAME scope minus the status filter,
  // so switching tabs never changes the numbers on the other tabs.
  const countScope = { ...filter };
  delete countScope.internalStatus;

  const [shipments, total, statusCounts] = await Promise.all([
    Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Shipment.countDocuments(filter),
    Shipment.aggregate([{ $match: countScope }, { $group: { _id: '$internalStatus', count: { $sum: 1 } } }]),
  ]);

  const perStatus = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
  const groupCounts = Object.fromEntries(
    Object.entries(SHIPMENT_GROUPS).map(([name, statuses]) => [
      name,
      statuses.reduce((sum, s) => sum + (perStatus[s] || 0), 0),
    ])
  );
  groupCounts.ALL = Object.values(perStatus).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    message: 'Shipments fetched successfully',
    data: {
      items: shipments.map((s) => serializeShipment(s, { includeInternal: Boolean(req.admin) })),
      total,
      groupCounts,
    },
    pagination: buildPagination({ page, limit, total }),
  });
}

// GET /vendor/shipments/:id
async function getShipment(req, res) {
  const loaded = await shipmentService.loadOwnedShipment(req.params.id, scopeFor(req));
  if (!loaded.ok) return respondToFailure(res, loaded);

  res.json({
    success: true,
    message: 'Shipment fetched successfully',
    // Sellers get the status history too — they need the timeline for support.
    data: serializeShipment(loaded.shipment, { includeInternal: true }),
  });
}

// GET /vendor/shipments/:id/tracking  |  /admin/...  |  /user/orders/:id/shipments
//
// Reads the stored timeline. Does NOT call the carrier — that is what the
// webhook and the poller are for, and letting a page refresh trigger a carrier
// call would spend the account's rate limit on nothing.
async function getTracking(req, res) {
  const loaded = await shipmentService.loadOwnedShipment(req.params.id, scopeFor(req));
  if (!loaded.ok) return respondToFailure(res, loaded);

  const shipment = loaded.shipment;
  const events = await trackingService.getTimeline(shipment);

  res.json({
    success: true,
    message: 'Tracking fetched successfully',
    data: {
      shipmentId: shipment._id.toString(),
      awbCode: shipment.awbCode,
      courierName: shipment.courierName || '',
      currentStatus: shipment.internalStatus,
      carrierStatus: shipment.shiprocketStatus || '',
      trackingUrl: shipment.trackingUrl,
      estimatedDelivery: shipment.estimatedDeliveryAt,
      lastSyncedAt: shipment.lastTrackingSyncAt,
      events,
    },
  });
}

// POST /vendor/shipments/:id/tracking/refresh
//
// The explicit "fetch from the carrier now" action, separate from the read
// above so an ordinary page load can never trigger it.
async function refreshTracking(req, res) {
  const loaded = await shipmentService.loadOwnedShipment(req.params.id, scopeFor(req));
  if (!loaded.ok) return respondToFailure(res, loaded);

  const result = await trackingService.syncShipment(loaded.shipment, { source: 'MANUAL' });
  if (!result.ok) return respondToFailure(res, result);

  const events = await trackingService.getTimeline(loaded.shipment);
  res.json({
    success: true,
    message: result.newEvents > 0 ? `${result.newEvents} new tracking update(s)` : 'Tracking is up to date',
    data: {
      shipmentId: loaded.shipment._id.toString(),
      currentStatus: loaded.shipment.internalStatus,
      newEvents: result.newEvents,
      events,
    },
  });
}

// POST /vendor/shipments/:id/cancel  |  /admin/...
//
// The carrier's shipment cancel is asynchronous, so a 200 here means the
// courier ACCEPTED the request — the shipment sits at CANCEL_REQUESTED until a
// webhook confirms it. The message says so rather than claiming it is done.
async function cancelShipment(req, res) {
  const result = await shipmentService.cancelShipment({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '',
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: result.alreadyExisted
      ? 'This shipment is already cancelled'
      : result.pending
        ? 'Cancellation requested. The courier will confirm shortly.'
        : 'Shipment cancelled',
    data: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
  });
}

// POST /vendor/shipments/:id/return
//
// Creates a SEPARATE return shipment pointing back at this one. The original
// parcel keeps its AWB, package and costs.
async function createReturn(req, res) {
  const result = await shipmentService.createReturnShipment({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '',
    // Optional: a partial return. Omitted means the whole parcel.
    items: Array.isArray(req.body?.items) ? req.body.items : null,
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.status(result.alreadyExisted ? 200 : 201).json({
    success: true,
    message: result.alreadyExisted ? 'A return is already in progress for this parcel' : 'Return booked with the courier',
    data: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
  });
}

// GET /vendor/shipments/:id/documents/:type  (LABEL | MANIFEST | INVOICE)
//
// Returns the carrier-hosted URL rather than proxying the PDF bytes: the
// document lives on the carrier's CDN, and streaming it through this server
// would buy nothing but latency. Ownership is still enforced here, so a seller
// can only ever reach a URL for their own parcel.
//
// `?refresh=1` forces a fresh render — the stored URL is cached and carrier
// links do eventually expire.
async function getShipmentDocument(req, res) {
  const type = String(req.params.type || '').toUpperCase();

  const result = await shipmentService.generateDocument({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    type,
    force: req.query.refresh === '1' || req.query.refresh === 'true',
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: result.cached ? 'Document ready' : 'Document generated',
    data: {
      type,
      url: result.url,
      cached: Boolean(result.cached),
      shipment: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }),
    },
  });
}

// GET /vendor/shipments/:id/ndr
//
// What the courier says about a failed delivery attempt. Read live rather
// than stored: an NDR changes as the courier re-attempts, and a cached copy
// would have the seller answering a question that has already moved on.
async function getShipmentNdr(req, res) {
  const result = await shipmentService.getNdr({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: 'Delivery report fetched',
    data: { ndr: result.ndr, shipment: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }) },
  });
}

// POST /vendor/shipments/:id/ndr/action  { action, comments }
//
// Answers the courier. The response is an ACKNOWLEDGEMENT, not an outcome —
// what actually happens to the parcel arrives later on the tracking webhook,
// and the message says so rather than claiming the parcel is on its way.
async function actOnShipmentNdr(req, res) {
  const result = await shipmentService.actOnNdr({
    shipmentId: req.params.id,
    vendorId: scopeFor(req),
    action: req.body?.action,
    comments: req.body?.comments,
    actor: req.vendor ? 'SELLER' : 'ADMIN',
  });

  if (!result.ok) return respondToFailure(res, result);

  res.json({
    success: true,
    message: 'Sent to the courier. They will confirm on the next tracking update.',
    data: { result: result.result, shipment: serializeShipment(result.shipment, { includeInternal: Boolean(req.admin) }) },
  });
}

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
function normaliseIdempotencyKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return IDEMPOTENCY_KEY_RE.test(trimmed) ? trimmed : null;
}

module.exports = {
  cancelShipment,
  getShipmentDocument,
  getShipmentNdr,
  actOnShipmentNdr,
  createReturn,
  getTracking,
  refreshTracking,
  createShipment,
  assignAwb,
  schedulePickup,
  listShipments,
  getShipment,
  serializeShipment,
};
