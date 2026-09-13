const mongoose = require('mongoose');

const PAYMENT_METHODS = ['COD', 'WALLET', 'RAZORPAY'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];
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
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, status: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
Order.PAYMENT_METHODS = PAYMENT_METHODS;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;
Order.STATUSES = STATUSES;

module.exports = Order;
