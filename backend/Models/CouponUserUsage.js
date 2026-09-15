const mongoose = require('mongoose');

// Backs the atomic per-user redemption cap in couponController.redeemCoupon.
// CouponRedemption rows can't enforce this alone: two concurrent inserts of
// *different* new redemption documents never conflict at the Mongo
// document level, so a plain countDocuments()-then-insert check can be
// raced past a perUserLimit of 1. A single counter document per
// (coupon, user), guarded by the unique index below plus an upsert whose
// filter includes `count: { $lt: perUserLimit }`, closes that race: only one
// of two concurrent attempts can win the increment once the cap is hit — the
// loser hits the unique index instead of silently creating a duplicate.
const couponUserUsageSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  count: { type: Number, default: 0, min: 0 },
});

couponUserUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CouponUserUsage', couponUserUsageSchema);
