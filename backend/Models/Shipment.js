const mongoose = require('mongoose');
const {
  SHIPMENT_TYPES,
  SHIPMENT_STATUSES,
  SHIPPING_PROVIDERS,
  SHIPPING_ACCOUNT_TYPES,
  TERMINAL_STATUSES,
  canTransitionTo,
} = require('../Config/shipping');

// One physical package.
//
// GROUPING KEY: (order, vendor, pickupLocation).
//
// That is the decision this whole model turns on. Before this, fulfilment
// state lived per LINE ITEM on Order.items[] — two products from the same
// seller in the same order each carried their own status and their own
// manually-typed tracking number, even though they physically ship in one box.
// Mapping that 1:1 onto a carrier would create two carrier orders and pay
// twice for one package. Here, those two products are two entries in `items[]`
// of ONE shipment. A seller shipping one order from two warehouses still gets
// two shipments, because the pickup location is part of the key.
//
// SOURCE OF TRUTH: this document, not Order.items[]. Order.items[] deliberately
// gains no `shipment` back-reference — a line item can be split, re-shipped or
// returned, and a single ref could not express that. To find a line's
// shipments, query `{ order, 'items.product': productId }`.
//
// LINE IDENTITY: `items[].product`. Order.items[] is declared `{ _id: false }`,
// so an order line has no id of its own; the codebase already treats
// (order, product) as the line key — ReturnRequest's unique index and the
// admin sub-order id "orderId:productId" both do. This inherits that, and with
// it the assumption that a product appears at most once per order. The cart
// enforces that today (cartController upserts by product). If variant-level
// lines are ever introduced, this key has to grow a variant component.

const shipmentItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshotted at shipment time for the same reason Order.items[] snapshots
    // them: editing or deleting the product later must not rewrite what was
    // in the box.
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    // Unit selling price, used for the carrier's declared value and for COD.
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Immutable record of WHICH carrier account shipped this (task §46). Kept as a
// snapshot, not a live lookup, because a seller may disconnect or switch
// accounts afterwards and this shipment must still be trackable, cancellable
// and returnable through the account that actually created it.
const accountSnapshotSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: SHIPPING_PROVIDERS, required: true },
    integration: { type: mongoose.Schema.Types.ObjectId, ref: 'ShippingIntegration', required: true },
    accountType: { type: String, enum: SHIPPING_ACCOUNT_TYPES, required: true },
    // The seller whose account was used; null for the platform account.
    accountOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
  },
  { _id: false }
);

// The package as MEASURED at shipment time, after the seller's "Verify
// Package" step (Decision B). Snapshotted so a later product edit cannot
// change a historical shipment's dimensions or its chargeable weight.
const packageSchema = new mongoose.Schema(
  {
    lengthCm: { type: Number, required: true, min: 0.5 },
    breadthCm: { type: Number, required: true, min: 0.5 },
    heightCm: { type: Number, required: true, min: 0.5 },
    actualWeightKg: { type: Number, required: true, min: 0.01 },
    // (L x B x H) / divisor, computed at verification time.
    volumetricWeightKg: { type: Number, required: true, min: 0 },
    // max(actual, volumetric) — what the carrier bills on.
    chargeableWeightKg: { type: Number, required: true, min: 0 },
    // Recorded because it is a setting that can change; without it an old
    // shipment's volumetric figure could not be explained.
    volumetricDivisor: { type: Number, required: true, min: 1 },
    // Where the numbers came from: 'PRODUCT' | 'VENDOR_DEFAULT' | 'PLATFORM_DEFAULT' | 'MANUAL'
    source: { type: String, default: 'MANUAL' },
  },
  { _id: false }
);

// Address snapshots. Both ends are frozen at shipment time — the buyer may
// edit or delete the address afterwards, and Order already snapshots its own
// copy for the same reason.
const addressSnapshotSchema = new mongoose.Schema(
  {
    contactName: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    // --- what is being shipped ---------------------------------------------
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    // null = a platform-owned catalog item (Product.vendor is nullable).
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: { type: [shipmentItemSchema], required: true, validate: (v) => v.length > 0 },

    // FORWARD or RETURN. A return is a SEPARATE document pointing back at the
    // forward one, never an overwrite — so the original AWB survives (task §22).
    shipmentType: { type: String, enum: SHIPMENT_TYPES, default: 'FORWARD' },
    parentShipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },

    // --- where it ships from / to -------------------------------------------
    pickupLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupLocation', default: null },
    // The carrier-side nickname at the time of shipping; the location row may
    // be renamed or deactivated later.
    pickupLocationName: { type: String, default: '' },
    pickupAddress: { type: addressSnapshotSchema, default: () => ({}) },
    deliveryAddress: { type: addressSnapshotSchema, default: () => ({}) },

    // --- which carrier account (immutable) ----------------------------------
    account: { type: accountSnapshotSchema, default: null },

    // --- package -------------------------------------------------------------
    package: { type: packageSchema, default: null },

    // --- money ----------------------------------------------------------------
    // Kept separate on purpose (task §20). Overwriting one with another is how
    // a marketplace loses track of whether it is making or losing money on
    // shipping.
    paymentMethod: { type: String, enum: ['COD', 'PREPAID'], required: true },
    // COD only: what the courier must collect at the door.
    collectableAmount: { type: Number, default: 0, min: 0 },
    // Declared value of the goods.
    declaredValue: { type: Number, default: 0, min: 0 },
    // The weight the carrier says it is billing on, from the AWB response.
    // Compare against package.chargeableWeightKg: if this is higher, the
    // parcel measured bigger than declared and the invoice will reflect that.
    carrierAppliedWeightKg: { type: Number, default: null },
    // What the BUYER was charged for shipping, apportioned to this shipment.
    customerShippingCharge: { type: Number, default: 0, min: 0 },
    // What the CARRIER actually charged. Only known once rated/shipped.
    carrierShippingCost: { type: Number, default: null, min: 0 },
    // customerShippingCharge - carrierShippingCost. Stored rather than derived
    // so a settings change cannot retroactively alter historical margin.
    platformShippingMargin: { type: Number, default: null },

    // --- carrier identifiers ---------------------------------------------------
    shiprocketOrderId: { type: String, default: null },
    shiprocketShipmentId: { type: String, default: null },
    channelId: { type: String, default: null },
    courierId: { type: Number, default: null },
    courierName: { type: String, default: '' },
    awbCode: { type: String, default: null },

    // --- documents --------------------------------------------------------------
    // Carrier-hosted URLs. Served to sellers through our own endpoint rather
    // than handed over directly (task §32).
    labelUrl: { type: String, default: null },
    manifestUrl: { type: String, default: null },
    invoiceUrl: { type: String, default: null },
    trackingUrl: { type: String, default: null },

    // --- status ------------------------------------------------------------------
    internalStatus: { type: String, enum: SHIPMENT_STATUSES, default: 'PENDING', required: true },
    // The carrier's own wording, stored verbatim for support and for filling
    // gaps in the status map. Never drives logic.
    shiprocketStatus: { type: String, default: '' },
    shiprocketStatusCode: { type: Number, default: null },
    statusHistory: {
      type: [
        {
          status: { type: String, enum: SHIPMENT_STATUSES },
          at: { type: Date, default: Date.now },
          // 'SYSTEM' | 'WEBHOOK' | 'POLL' | 'SELLER' | 'ADMIN'
          source: { type: String, default: 'SYSTEM' },
          note: { type: String, default: '' },
        },
      ],
      default: () => [{ status: 'PENDING', at: new Date(), source: 'SYSTEM' }],
      _id: false,
    },

    // --- lifecycle timestamps -------------------------------------------------------
    pickupScheduledAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    rtoInitiatedAt: { type: Date, default: null },
    rtoDeliveredAt: { type: Date, default: null },
    returnRequestedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    estimatedDeliveryAt: { type: Date, default: null },

    // --- sync bookkeeping -------------------------------------------------------------
    lastTrackingSyncAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },

    // --- reliability ---------------------------------------------------------------------
    // Client-supplied per create attempt, so a double-tapped "Create shipment"
    // or a retried request resolves to ONE shipment (task §31).
    idempotencyKey: { type: String, default: null },
    // Set when an external call timed out and we do not know whether the
    // carrier acted. NEVER retried blindly — reconciled first (task §38).
    reconciliationRequired: { type: Boolean, default: false },
    reconciliationNote: { type: String, default: '' },
    retryCount: { type: Number, default: 0, min: 0 },
    // A SAFE message. Never the carrier's raw error, never credentials.
    errorMessage: { type: String, default: '' },

    // Why a parcel was stopped or sent back. Written by whoever asked for it
    // (seller, admin or buyer) and kept for support — a cancellation with no
    // recorded reason is unanswerable three weeks later.
    cancellationReason: { type: String, default: '', trim: true, maxlength: 500 },
    returnReason: { type: String, default: '', trim: true, maxlength: 500 },

    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

// --- indexes ---------------------------------------------------------------
// Derived from the queries this collection actually serves, not one per field.

// The grouping key. Unique so the same (order, vendor, pickup location) can
// never produce two FORWARD shipments — the database-level half of duplicate
// prevention, alongside the idempotency key. Partial on shipmentType because a
// RETURN legitimately shares all three values with its forward shipment.
shipmentSchema.index(
  { order: 1, vendor: 1, pickupLocation: 1 },
  { unique: true, partialFilterExpression: { shipmentType: 'FORWARD' } }
);
// Seller panel: "my shipments, newest first", optionally filtered by status.
shipmentSchema.index({ vendor: 1, internalStatus: 1, createdAt: -1 });
shipmentSchema.index({ vendor: 1, createdAt: -1 });
// Admin panel: "all shipments", optionally filtered by status.
shipmentSchema.index({ internalStatus: 1, createdAt: -1 });
// Buyer: the shipments on one order.
shipmentSchema.index({ order: 1 });
shipmentSchema.index({ customer: 1, createdAt: -1 });
// Webhook + tracking lookup by carrier identifiers. Sparse: only shipments
// that reached the carrier have these.
shipmentSchema.index({ awbCode: 1 }, { sparse: true });
shipmentSchema.index({ shiprocketShipmentId: 1 }, { sparse: true });
shipmentSchema.index({ shiprocketOrderId: 1 }, { sparse: true });
// Duplicate-create protection, scoped per order so two orders cannot collide.
shipmentSchema.index(
  { order: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
// The tracking poller's query: pollable shipments not synced recently.
shipmentSchema.index({ internalStatus: 1, lastTrackingSyncAt: 1 });

// Applies a status change if — and only if — it is a legal forward move.
// Returns true when the status actually changed.
//
// Every status write goes through this, which is what makes duplicate and
// out-of-order webhooks safe: a repeat of the current status is a no-op, and a
// stale earlier status is rejected rather than applied (task §49).
// `at` is WHEN THE EVENT HAPPENED, not when we heard about it. A carrier scan
// carries its own timestamp, and a webhook can arrive hours late or be replayed
// during a backfill — stamping `pickedUpAt` with the clock would then tell a
// buyer their parcel shipped today when the scan says yesterday. Callers that
// are themselves the event (a seller scheduling a pickup) pass nothing and get
// the current time, which is correct for them.
shipmentSchema.methods.applyStatus = function applyStatus(next, { source = 'SYSTEM', note = '', at = null } = {}) {
  if (!canTransitionTo(this.internalStatus, next)) return false;

  const now = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();

  this.internalStatus = next;
  this.statusHistory.push({ status: next, at: now, source, note });
  // Lifecycle timestamps are set here rather than by each caller, so they can
  // never disagree with the status that set them.
  if (next === 'PICKUP_SCHEDULED' && !this.pickupScheduledAt) this.pickupScheduledAt = now;
  if (next === 'PICKED_UP' && !this.pickedUpAt) this.pickedUpAt = now;
  if (next === 'DELIVERED' && !this.deliveredAt) this.deliveredAt = now;
  if (next === 'CANCELLED' && !this.cancelledAt) this.cancelledAt = now;
  if (next === 'RTO_INITIATED' && !this.rtoInitiatedAt) this.rtoInitiatedAt = now;
  if (next === 'RTO_DELIVERED' && !this.rtoDeliveredAt) this.rtoDeliveredAt = now;
  if (next === 'RETURN_REQUESTED' && !this.returnRequestedAt) this.returnRequestedAt = now;
  if (next === 'RETURN_DELIVERED' && !this.returnedAt) this.returnedAt = now;

  return true;
};

shipmentSchema.methods.isTerminal = function isTerminal() {
  return TERMINAL_STATUSES.includes(this.internalStatus);
};

// A reverse parcel scanned as delivered back to the seller: the returned item
// is in hand, so its return request can be completed. Lazy require — the
// return service itself loads this model.
shipmentSchema.post('save', function markReturnReceived(doc) {
  if (doc.shipmentType !== 'RETURN' || doc.internalStatus !== 'RETURN_DELIVERED') return;
  require('../services/returnService')
    .onReturnShipmentDelivered(doc._id)
    .catch((err) => console.error('[Shipment] could not mark the return received', { shipmentId: String(doc._id), error: err.message }));
});

const Shipment = mongoose.model('Shipment', shipmentSchema);
Shipment.SHIPMENT_TYPES = SHIPMENT_TYPES;
Shipment.SHIPMENT_STATUSES = SHIPMENT_STATUSES;

module.exports = Shipment;
