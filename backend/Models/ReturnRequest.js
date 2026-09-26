const mongoose = require('mongoose');

const REQUEST_TYPES = ['REPLACEMENT', 'REFUND'];
// PENDING   buyer raised it, admin has not decided.
// ACCEPTED  admin approved it; waiting for the item to come back (pickup
//           booked with the courier, or collected by hand). No money yet.
// APPROVED  done: the refund was paid or the replacement order was created.
//           Reports, analytics and the ledger read APPROVED as "money moved",
//           which is why the in-between state has its own name.
// REJECTED  refused, before or after the item came back.
const STATUSES = ['PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED'];
// A line with one of these cannot get another request.
const BLOCKING_STATUSES = ['PENDING', 'ACCEPTED', 'APPROVED'];
const PICKUP_MODES = ['COURIER', 'MANUAL', 'NOT_REQUIRED'];
const REFUND_DESTINATIONS = ['WALLET', 'RAZORPAY'];
const SELLER_RECOMMENDATIONS = ['APPROVE', 'REJECT'];

// What the seller thinks should happen, and why. Advisory only — the decision
// and the money stay with admin (adminReturnController.decideReturnRequest),
// because approving a REFUND credits the buyer's wallet and a seller must not
// be the judge of a claim against their own product.
//
// The value of capturing it anyway: the seller is the only party who knows
// whether the returned item came back damaged, whether it is even their SKU,
// or whether this buyer has done it four times. Admin was deciding without any
// of that.
const sellerRecommendationSchema = new mongoose.Schema(
  {
    decision: { type: String, enum: SELLER_RECOMMENDATIONS, required: true },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Which variant line of the order this is about. Two colours of one
    // product are two lines, and each can be returned on its own.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productName: { type: String, required: true },
    productImage: { type: String, default: null },

    requestType: { type: String, enum: REQUEST_TYPES, required: true },
    reason: { type: String, required: true, trim: true },
    photos: { type: [String], default: [] },

    status: { type: String, enum: STATUSES, default: 'PENDING' },
    adminNote: { type: String, default: '', trim: true },
    // Null until the seller weighs in; they may also change their mind while
    // the request is still PENDING, in which case this is overwritten.
    sellerRecommendation: { type: sellerRecommendationSchema, default: null },
    // Refund credited to Wallet on approval of a REFUND request — snapshot of
    // what was actually paid at checkout for this line item.
    refundAmount: { type: Number, default: null, min: 0 },
    resolvedAt: { type: Date, default: null },

    // --- after approval -----------------------------------------------------
    acceptedAt: { type: Date, default: null },
    // How the item comes back. COURIER: a reverse pickup was booked
    // (`returnShipment`). MANUAL: no courier parcel to reverse, or booking
    // failed — admin collects it and marks it received. NOT_REQUIRED: nothing
    // to send back (a missing item), so the request completes at once.
    pickupMode: { type: String, enum: PICKUP_MODES, default: null },
    returnShipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    pickupError: { type: String, default: '' },
    itemReceivedAt: { type: Date, default: null },
    // Set when admin put the returned units back into stock.
    restocked: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    // Where a REFUND went: back to the Razorpay payment it came from, or the
    // Krozenda wallet (COD and wallet orders, which have no card to refund).
    refundDestination: { type: String, enum: REFUND_DESTINATIONS, default: null },
    razorpayRefundId: { type: String, default: '' },
    // The zero-value order that ships the replacement item.
    replacementOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    // Guards completion against a double click: set while it runs.
    completing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ returnShipment: 1 }, { sparse: true });
// One active (non-terminal) request per order line at a time. Replaces the
// old order+product index (dropped by migrate-split-order-indexes.js), which
// blocked returning a second variant of the same product.
returnRequestSchema.index(
  { order: 1, product: 1, variantId: 1 },
  { unique: true, name: 'order_product_variant_pending_unique', partialFilterExpression: { status: 'PENDING' } }
);

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
ReturnRequest.LEGACY_INDEX_NAMES = ['order_1_product_1'];
ReturnRequest.REQUEST_TYPES = REQUEST_TYPES;
ReturnRequest.STATUSES = STATUSES;
ReturnRequest.BLOCKING_STATUSES = BLOCKING_STATUSES;
ReturnRequest.PICKUP_MODES = PICKUP_MODES;
ReturnRequest.SELLER_RECOMMENDATIONS = SELLER_RECOMMENDATIONS;

module.exports = ReturnRequest;
