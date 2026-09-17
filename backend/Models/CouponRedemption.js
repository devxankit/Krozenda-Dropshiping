const mongoose = require('mongoose');

const STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];

const couponRedemptionSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // Not populated yet — no Order model exists in this backend so far.
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    discountAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });

// Enforces "one coupon per order" at the database level: only one
// non-terminal (PENDING/SUCCESS) redemption may exist per order at a time.
couponRedemptionSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'SUCCESS'] } } }
);

const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);
CouponRedemption.STATUSES = STATUSES;

module.exports = CouponRedemption;
