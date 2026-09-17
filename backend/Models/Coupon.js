const mongoose = require('mongoose');

const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED', 'FREE_SHIPPING'];
const APPLICABLE_TO = ['ALL', 'PRODUCTS', 'CATEGORIES', 'VENDORS'];
const CUSTOMER_ELIGIBILITY = ['ALL', 'NEW', 'EXISTING', 'SPECIFIC'];
const STATUSES = ['INACTIVE', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'USAGE_LIMIT_REACHED'];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true, default: '' },

    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },

    minOrderAmount: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: null, min: 0 },
    maxQuantity: { type: Number, default: null, min: 0 },

    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: null, min: 1 },

    applicableTo: { type: String, enum: APPLICABLE_TO, default: 'ALL' },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    vendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],

    customerEligibility: { type: String, enum: CUSTOMER_ELIGIBILITY, default: 'ALL' },
    customerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Set only for a coupon a seller created for their own catalog (via
    // vendorCouponController) — distinct from `vendorIds` above, which is
    // admin's cross-vendor *targeting* list. null = admin-created coupon.
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
  },
  { timestamps: true }
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

couponSchema.pre('validate', function guardDateRange() {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    throw new Error('End date must be after start date');
  }
});

// Pure function (not just a document method) so listing/serialization can
// compute status off a .lean() object without a live Mongoose document.
function resolveStatus(coupon, now = new Date()) {
  if (!coupon.isActive) return 'INACTIVE';
  if (now < coupon.startDate) return 'UPCOMING';
  if (now > coupon.endDate) return 'EXPIRED';
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return 'USAGE_LIMIT_REACHED';
  return 'ACTIVE';
}

couponSchema.methods.computeStatus = function computeStatus(now) {
  return resolveStatus(this, now);
};

const Coupon = mongoose.model('Coupon', couponSchema);

Coupon.DISCOUNT_TYPES = DISCOUNT_TYPES;
Coupon.APPLICABLE_TO = APPLICABLE_TO;
Coupon.CUSTOMER_ELIGIBILITY = CUSTOMER_ELIGIBILITY;
Coupon.STATUSES = STATUSES;
Coupon.resolveStatus = resolveStatus;

module.exports = Coupon;
