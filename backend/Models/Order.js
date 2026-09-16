const mongoose = require('mongoose');

const PAYMENT_METHODS = ['COD', 'WALLET', 'RAZORPAY'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

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
    variant: { type: String, default: '' },
    // Snapshotted from Product.vendor at order time (same reasoning as the
    // rest of this schema): a support ticket raised against this item must
    // keep pointing at the seller who owned it when it was bought, even if
    // the product is reassigned or removed later.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    // Per-vendor fulfilment state for this line item. The order-level
    // `status` above stays the buyer-facing/admin aggregate; this lets a
    // seller move their own line item through PROCESSING/SHIPPED/DELIVERED
    // independently in a multi-vendor cart, without touching other sellers'
    // items or the parent order's status.
    status: { type: String, enum: STATUSES, default: 'PENDING' },
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
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    shippingAddress: { type: shippingAddressSchema, required: true },

    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    shippingFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

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
    cancelledBy: { type: String, enum: ['buyer', 'admin', null], default: null },
    // Real transition log — TrackShipmentScreen renders this timeline
    // directly instead of fabricated courier/AWB data, since there's no
    // courier integration behind this order system.
    statusHistory: {
      type: [{ status: { type: String, enum: STATUSES }, at: { type: Date, default: Date.now } }],
      default: () => [{ status: 'PENDING', at: new Date() }],
      _id: false,
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, status: 1, createdAt: -1 });
// Not redundant with the index above: with `status` sitting between them,
// that one can only use `user` as a prefix for an unfiltered "my orders,
// newest first" query and still has to sort in memory. This serves
// listOrders() and the AI assistant's getMyLatestOrder/getMyRecentOrders
// lookups, which are exactly that shape.
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.vendor': 1, createdAt: -1 });
// A captured Razorpay payment can back at most one order — without this, a
// single valid (orderId, paymentId, signature) triple could be replayed
// across multiple POST /user/orders calls to mint unlimited "paid" orders.
orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

const Order = mongoose.model('Order', orderSchema);
Order.PAYMENT_METHODS = PAYMENT_METHODS;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;
Order.STATUSES = STATUSES;

module.exports = Order;
