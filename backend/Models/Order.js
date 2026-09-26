const mongoose = require('mongoose');

const PAYMENT_METHODS = ['COD', 'WALLET', 'RAZORPAY'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
// STANDARD: sold and shipped by a seller / the platform — the normal flow.
// DROPSHIP: fulfilled by CJ Dropshipping. Online payment only, and the buyer
// can neither cancel nor return it (business rule, 2026-09). A cart holding
// both is split at checkout into one order of each type, paid by one
// Razorpay payment, so each keeps its own tracking, cancel and return flow.
const FULFILLMENT_TYPES = ['STANDARD', 'DROPSHIP'];

// Line items and the shipping address are snapshotted at order time (name,
// price, image, full address text) rather than left as live refs, so
// editing/deleting the source Product or Address later never rewrites
// order history — mirrors the snapshot approach cartController/
// wishlistController already use when serializing for the frontend.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    // Which variant was bought. Null on a simple product, and on every line
    // written before variants existed. Stock is returned to this variant on a
    // cancellation or an RTO, so it has to survive on the order, not be
    // re-derived from a product that may have changed since.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Snapshotted label and SKU, for the same reason as `name` and `price`
    // above: renaming or deleting a variant must never rewrite order history.
    variant: { type: String, default: '' },
    variantSku: { type: String, default: '' },
    // Which pricing rule produced `price` — PRODUCT, PRODUCT_SALE, VARIANT,
    // VARIANT_SALE or PRICE_TIER. Kept so a support query about "why was I
    // charged this" is answerable from the order alone.
    priceSource: { type: String, default: 'PRODUCT' },

    // --- tax snapshot, integer paise ---------------------------------------
    // Frozen at order time. A GST rate changing next month must not rewrite
    // the tax on an invoice already issued.
    hsnCode: { type: String, default: '' },
    gstRate: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    // How the product was priced. `price` above is ALWAYS what the buyer paid
    // per unit, tax included; on an exclusive product that is the listed
    // price plus GST, and `listPrice` keeps the figure the buyer saw listed.
    gstInclusive: { type: Boolean, default: true },
    listPrice: { type: Number, default: null, min: 0 },
    // This line's share of the order's coupon discount, in rupees, fixed at
    // checkout. Only lines the coupon actually applied to carry any. Refunds
    // and the seller ledger read it, so a return pays back what the buyer
    // really paid and a seller's coupon never comes out of another seller's
    // line. Null on orders written before it existed.
    discountAmount: { type: Number, default: null, min: 0 },
    // Snapshotted from Product.vendor at order time (same reasoning as the
    // rest of this schema): a support ticket raised against this item must
    // keep pointing at the seller who owned it when it was bought, even if
    // the product is reassigned or removed later.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    // The commission TERMS this seller line was sold under, frozen when the
    // order was placed (accountingPosting.attachCommissionSnapshots). The
    // ledger posts from these — for a COD order that can be days later — so
    // an admin editing, adding or retiring a rule after checkout never
    // changes what the order is charged. Null on platform lines (nothing to
    // charge) and on orders written before snapshots existed; those are
    // resolved against the rules as of the order date instead.
    commission: {
      type: new mongoose.Schema(
        {
          ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionRule', default: null },
          ruleName: { type: String, default: '' },
          // PRODUCT | SELLER | CATEGORY | GLOBAL, or DEFAULT for the
          // platform default.
          scope: { type: String, required: true },
          type: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
          // Percent for PERCENTAGE, rupees per unit for FIXED.
          value: { type: Number, required: true, min: 0 },
          // AccountingConfig.commissionBase in force at checkout.
          basis: { type: String, required: true },
          // What the terms came to at checkout, in paise — for display. The
          // ledger recomputes from the terms above and lands on the same
          // figure.
          amountPaise: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
    // Snapshotted from Product.isReturnable at order time, so the return
    // policy the buyer saw is the one they get. Lines written before this
    // existed read as true, which was the only policy back then.
    returnable: { type: Boolean, default: true },
    // Per-vendor fulfilment state for this line item. The order-level
    // `status` above stays the buyer-facing/admin aggregate; this lets a
    // seller move their own line item through PROCESSING/SHIPPED/DELIVERED
    // independently in a multi-vendor cart, without touching other sellers'
    // items or the parent order's status.
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    // When the seller accepted this line (PENDING -> PROCESSING). Null while
    // it is still waiting on them, which is what makes an acceptance SLA
    // measurable at all.
    acceptedAt: { type: Date, default: null },
    // Why the seller rejected it. Required when a seller cancels a line -
    // "cancelled" with no reason tells the buyer nothing and gives support
    // nothing to work with.
    rejectionReason: { type: String, default: '', trim: true },
    courierName: { type: String, default: '', trim: true },
    trackingNumber: { type: String, default: '', trim: true },
    statusHistory: {
      type: [{ status: { type: String, enum: STATUSES }, at: { type: Date, default: Date.now } }],
      default: () => [{ status: 'PENDING', at: new Date() }],
      _id: false,
    },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    shippingAddress: { type: shippingAddressSchema, required: true },

    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    shippingFee: { type: Number, default: 0, min: 0 },
    // Buyer-paid platform fee (PlatformSettings.buyerPlatformFee*), part of
    // `total`. Platform revenue, never a seller's.
    platformFee: { type: Number, default: 0, min: 0 },
    // Set on the zero-value order that ships a replacement for an approved
    // return. It carries no money: no sale, commission or invoice total.
    replacementFor: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },
    total: { type: Number, required: true, min: 0 },
    // How much of `total` has already gone back to the buyer through single
    // lines being cancelled (seller rejection, admin sub-order cancel). A
    // later whole-order cancellation refunds only what is left, so a line is
    // never paid back twice.
    refundedAmount: { type: Number, default: 0, min: 0 },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    // Client-generated key for one checkout attempt. The unique index below
    // is what actually stops a double-tapped "Place Order" (or a retry after
    // a timeout) from minting a second order: the second insert loses on the
    // index and createOrder returns the first order instead. The Razorpay
    // path already had this property via razorpayPaymentId; COD and WALLET
    // had nothing, so a double tap really did create two orders.
    idempotencyKey: { type: String, default: null },

    fulfillmentType: { type: String, enum: FULFILLMENT_TYPES, default: 'STANDARD' },
    // Orders split from one checkout share this id, the Razorpay payment and
    // the idempotency key. Index 0 is the primary: it carries the coupon
    // redemption and the gateway's fixed per-payment fee.
    checkoutGroupId: { type: String, default: null, index: true },
    checkoutGroupIndex: { type: Number, default: 0 },
    // The CJ logistics line the buyer was quoted at checkout, so the CJ order
    // is created on the same line the buyer paid for.
    cjLogisticName: { type: String, default: null },

    status: { type: String, enum: STATUSES, default: 'PENDING' },
    deliveredAt: { type: Date, default: null },
    // Admin Finance > Transactions: whether this payment capture has been
    // matched against the bank/gateway statement. Purely a bookkeeping flag —
    // never affects order fulfilment.
    financeReconciled: { type: Boolean, default: false },
    // COD only. A cash order is collected by the courier at the door, so the
    // money does not reach the platform when the order is placed or even when
    // it is delivered — it arrives when the courier remits it. Admin
    // Accounting > Transactions records that remittance, which is the moment
    // the order's sale is posted to the ledger and the seller's line becomes
    // settleable (see services/accountingPosting.recordCodRemittance).
    // Null on every prepaid order.
    codRemittedAt: { type: Date, default: null },
    codRemittanceReference: { type: String, default: '', trim: true },
    // Who cancelled this order — only set when status transitions to
    // CANCELLED. Used by Admin Fulfilment > Cancellations to show the actor.
    // 'system': cancelled automatically, e.g. CJ refused the order after the
    // buyer had paid and the payment was refunded.
    cancelledBy: { type: String, enum: ['buyer', 'admin', 'seller', 'system', null], default: null },
    // Real transition log — TrackShipmentScreen renders this timeline
    // directly instead of fabricated courier/AWB data, since there's no
    // courier integration behind this order system.
    statusHistory: {
      type: [{ status: { type: String, enum: STATUSES }, at: { type: Date, default: Date.now } }],
      default: () => [{ status: 'PENDING', at: new Date() }],
      _id: false,
    },
    // --- B2B Business Invoicing --------------------------------------------
    b2b: {
      isB2B: { type: Boolean, default: false },
      companyName: { type: String, trim: true, default: '' },
      gstin: { type: String, trim: true, uppercase: true, default: '' },
    },
    // Who issued this order's invoice(s) — platform and/or sellers, with the
    // GSTIN, name and address as they were when the invoice was first
    // produced (services/invoiceService). Frozen so a seller changing their
    // GSTIN later never rewrites an invoice already issued. Absent until then.
    invoiceSuppliers: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    invoiceGeneratedAt: { type: Date, default: null },
    // One row per WhatsApp update sent to the buyer (see
    // services/whatsappService.js). Doubles as the idempotency claim, so each
    // event goes out at most once per order.
    whatsappLog: {
      type: [
        {
          event: { type: String, required: true },
          template: { type: String, default: '' },
          status: { type: String, enum: ['SENDING', 'SENT', 'FAILED'], default: 'SENDING' },
          messageId: { type: String, default: null },
          error: { type: String, default: null },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
      _id: false,
    },
  },
  { timestamps: true }
);

// --- WhatsApp order updates ------------------------------------------------
// Status moves happen in a dozen places (admin, seller, Shiprocket webhooks,
// CJ sync, the cancellation services, checkout's insertMany), so the buyer's
// WhatsApp is triggered here, off the data, rather than at each call site —
// a new status path can't forget to message the buyer.
//
// What the buyer is told follows the furthest the order as a whole has got:
// the order-level status, or the least advanced live line when sellers move
// lines on their own (a seller shipping the only line ships the order).
const STATUS_RANK = { PENDING: 0, PROCESSING: 1, SHIPPED: 2, DELIVERED: 3 };

function buyerFacingStatus(order) {
  if (!order) return null;
  if (order.status === 'CANCELLED') return 'CANCELLED';
  const items = order.items || [];
  const live = items.filter((i) => i.status !== 'CANCELLED');
  if (items.length > 0 && live.length === 0) return 'CANCELLED';
  const lowestLine = live.reduce((acc, i) => Math.min(acc, STATUS_RANK[i.status] ?? 0), STATUS_RANK.DELIVERED);
  const rank = Math.max(STATUS_RANK[order.status] ?? 0, live.length ? lowestLine : 0);
  return Object.keys(STATUS_RANK).find((key) => STATUS_RANK[key] === rank);
}

// Only forward moves and cancellations are worth a message.
function whatsappEventFor(before, after) {
  if (!before || !after || before === after || before === 'CANCELLED') return null;
  if (after === 'CANCELLED') return 'CANCELLED';
  return STATUS_RANK[after] > STATUS_RANK[before] ? after : null;
}

// Required lazily: the service requires this model.
function whatsapp() {
  return require('../services/whatsappService');
}

function sendWhatsapp(orderId, event) {
  if (!event) return;
  // Detached on purpose: the request that moved the order never waits on, or
  // fails because of, the gateway. notifyOrderEvent never rejects.
  whatsapp().notifyOrderEvent(orderId, event);
}

function touchesStatus(update) {
  const stages = Array.isArray(update) ? update : [update];
  return stages.some((stage) =>
    Object.entries(stage || {}).some(([key, value]) => {
      const keys = key.startsWith('$') && value && typeof value === 'object' ? Object.keys(value) : [key];
      return keys.some((k) => k === 'status' || k === 'items' || /^items\..*\.status$/.test(k));
    })
  );
}

orderSchema.post('init', function rememberBuyerStatus() {
  this.$locals.buyerStatus = buyerFacingStatus(this);
});

orderSchema.pre('save', function markNew() {
  this.$locals.wasNew = this.isNew;
});

// Delivered = the order is DELIVERED, or every line that was not cancelled is.
function isFullyDelivered(order) {
  if (order.status === 'DELIVERED') return true;
  const live = (order.items || []).filter((item) => item.status !== 'CANCELLED');
  return live.length > 0 && live.every((item) => item.status === 'DELIVERED');
}

// A COD order is paid the moment it is delivered: the buyer handed the cash
// to the courier. Whether the courier has passed that cash on to us is a
// separate question, tracked by `codRemittedAt` — the ledger waits for that,
// not for this.
orderSchema.pre('save', function markCodPaidOnDelivery() {
  if (this.paymentMethod === 'COD' && this.paymentStatus === 'PENDING' && isFullyDelivered(this)) {
    this.paymentStatus = 'PAID';
  }
});

orderSchema.post('save', function whatsappOnSave() {
  if (!whatsapp().isEnabled()) return;
  if (this.$locals.wasNew) {
    this.$locals.buyerStatus = buyerFacingStatus(this);
    sendWhatsapp(this._id, 'PLACED');
    return;
  }
  const after = buyerFacingStatus(this);
  const event = whatsappEventFor(this.$locals.buyerStatus, after);
  this.$locals.buyerStatus = after;
  sendWhatsapp(this._id, event);
});

orderSchema.post('insertMany', function whatsappOnInsert(docs) {
  if (!whatsapp().isEnabled()) return;
  for (const doc of docs || []) sendWhatsapp(doc._id, 'PLACED');
});

// findOneAndUpdate / updateOne carry no "before" state, so the matching order
// is read first — only when WhatsApp is on and the update touches a status.
for (const op of ['findOneAndUpdate', 'updateOne']) {
  orderSchema.pre(op, async function captureBuyerStatus() {
    if (!whatsapp().isEnabled() || !touchesStatus(this.getUpdate())) return;
    this._whatsappBefore = await this.model.findOne(this.getFilter()).select('status items.status').lean();
  });

  orderSchema.post(op, async function whatsappOnUpdate() {
    const before = this._whatsappBefore;
    if (!before) return;
    const after = await this.model.findById(before._id).select('status items.status').lean();
    sendWhatsapp(before._id, whatsappEventFor(buyerFacingStatus(before), buyerFacingStatus(after)));
  });
}

orderSchema.index({ user: 1, status: 1, createdAt: -1 });
// Not redundant with the index above: with `status` sitting between them,
// that one can only use `user` as a prefix for an unfiltered "my orders,
// newest first" query and still has to sort in memory. This serves
// listOrders() and the AI assistant's getMyLatestOrder/getMyRecentOrders
// lookups, which are exactly that shape.
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.vendor': 1, createdAt: -1 });
// A captured Razorpay payment can back at most one order OF EACH TYPE —
// without this, a single valid (orderId, paymentId, signature) triple could
// be replayed across multiple POST /user/orders calls to mint unlimited
// "paid" orders. Split checkouts legitimately put one payment on a STANDARD
// and a DROPSHIP order, hence the second key.
//
// Named, and different from the old single-field indexes, so an existing
// database gets the new ones created alongside — the old ones must be dropped
// by migrate-split-order-indexes.js or they will reject every split order.
orderSchema.index(
  { razorpayPaymentId: 1, fulfillmentType: 1 },
  {
    unique: true,
    name: 'razorpayPaymentId_fulfillmentType_unique',
    partialFilterExpression: { razorpayPaymentId: { $type: 'string' } },
  }
);
// Scoped to the user so two buyers can never collide on a key, and partial so
// the pre-existing orders that carry no key don't all clash on null.
orderSchema.index(
  { user: 1, idempotencyKey: 1, fulfillmentType: 1 },
  {
    unique: true,
    name: 'user_idempotencyKey_fulfillmentType_unique',
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

// The indexes the split-order change replaced; see migrate-split-order-indexes.js.
const LEGACY_INDEX_NAMES = ['razorpayPaymentId_1', 'user_1_idempotencyKey_1'];

const Order = mongoose.model('Order', orderSchema);
Order.FULFILLMENT_TYPES = FULFILLMENT_TYPES;
Order.LEGACY_INDEX_NAMES = LEGACY_INDEX_NAMES;
Order.PAYMENT_METHODS = PAYMENT_METHODS;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;
Order.isFullyDelivered = isFullyDelivered;
Order.STATUSES = STATUSES;

module.exports = Order;
