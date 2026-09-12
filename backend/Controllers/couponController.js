const mongoose = require('mongoose');
const Coupon = require('../Models/Coupon');
const CouponRedemption = require('../Models/CouponRedemption');

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((v) => String(v));
}

function serializeCoupon(c) {
  return {
    id: c._id.toString(),
    _id: c._id.toString(),
    code: c.code,
    description: c.description || '',
    discountType: c.discountType,
    discountValue: c.discountValue || 0,
    maxDiscountAmount: c.maxDiscountAmount ?? null,
    minOrderAmount: c.minOrderAmount || 0,
    minQuantity: c.minQuantity ?? null,
    maxQuantity: c.maxQuantity ?? null,
    usageLimit: c.usageLimit ?? null,
    usedCount: c.usedCount || 0,
    perUserLimit: c.perUserLimit ?? null,
    applicableTo: c.applicableTo,
    productIds: (c.productIds || []).map((id) => id.toString()),
    categoryIds: (c.categoryIds || []).map((id) => id.toString()),
    vendorIds: (c.vendorIds || []).map((id) => id.toString()),
    customerEligibility: c.customerEligibility,
    customerIds: (c.customerIds || []).map((id) => id.toString()),
    startDate: c.startDate,
    endDate: c.endDate,
    isActive: c.isActive !== false,
    status: Coupon.resolveStatus(c),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function validateCouponFields({ discountType, discountValue, startDate, endDate }) {
  if (!Coupon.DISCOUNT_TYPES.includes(discountType)) {
    return 'Enter a valid discount type';
  }

  if (discountType !== 'FREE_SHIPPING') {
    if (discountValue === null || discountValue <= 0) {
      return 'Enter a valid discount value';
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      return 'Percentage discount cannot exceed 100';
    }
  }

  if (!startDate || !endDate) {
    return 'Start and end dates are required';
  }
  if (endDate <= startDate) {
    return 'End date must be after start date';
  }

  return null;
}

async function listCoupons(req, res) {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  const items = coupons.map(serializeCoupon);

  const stats = {
    total: items.length,
    active: items.filter((c) => c.status === 'ACTIVE').length,
    upcoming: items.filter((c) => c.status === 'UPCOMING').length,
    expired: items.filter((c) => c.status === 'EXPIRED').length,
    usageLimitReached: items.filter((c) => c.status === 'USAGE_LIMIT_REACHED').length,
    inactive: items.filter((c) => c.status === 'INACTIVE').length,
  };

  res.json({ success: true, data: { items, stats } });
}

async function getCoupon(req, res) {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }
  res.json({ success: true, data: serializeCoupon(coupon) });
}

async function createCoupon(req, res) {
  const {
    code,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    minQuantity,
    maxQuantity,
    usageLimit,
    perUserLimit,
    applicableTo,
    productIds,
    categoryIds,
    vendorIds,
    customerEligibility,
    customerIds,
    startDate,
    endDate,
    isActive,
  } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }
  const normalizedCode = code.trim().toUpperCase();

  const discountValueNum = toNumber(discountValue, 0);
  const start = toDate(startDate);
  const end = toDate(endDate);

  const fieldError = validateCouponFields({ discountType, discountValue: discountValueNum, startDate: start, endDate: end });
  if (fieldError) {
    return res.status(400).json({ success: false, message: fieldError });
  }

  const existing = await Coupon.findOne({ code: normalizedCode });
  if (existing) {
    return res.status(400).json({ success: false, message: `Coupon code ${normalizedCode} already exists` });
  }

  try {
    const coupon = await Coupon.create({
      code: normalizedCode,
      description: description ? String(description).trim() : '',
      discountType,
      discountValue: discountType === 'FREE_SHIPPING' ? 0 : discountValueNum,
      maxDiscountAmount: toNumber(maxDiscountAmount),
      minOrderAmount: toNumber(minOrderAmount, 0),
      minQuantity: toNumber(minQuantity),
      maxQuantity: toNumber(maxQuantity),
      usageLimit: toNumber(usageLimit),
      perUserLimit: toNumber(perUserLimit),
      applicableTo: applicableTo || 'ALL',
      productIds: normalizeIds(productIds),
      categoryIds: normalizeIds(categoryIds),
      vendorIds: normalizeIds(vendorIds),
      customerEligibility: customerEligibility || 'ALL',
      customerIds: normalizeIds(customerIds),
      startDate: start,
      endDate: end,
      isActive: toBool(isActive, true),
      createdBy: req.admin?._id || null,
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: serializeCoupon(coupon),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: `Coupon code ${normalizedCode} already exists` });
    }
    throw err;
  }
}

async function updateCoupon(req, res) {
  const { id } = req.params;
  const {
    code,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    minQuantity,
    maxQuantity,
    usageLimit,
    perUserLimit,
    applicableTo,
    productIds,
    categoryIds,
    vendorIds,
    customerEligibility,
    customerIds,
    startDate,
    endDate,
    isActive,
  } = req.body;

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  if (code && code.trim()) {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode !== coupon.code) {
      const existing = await Coupon.findOne({ code: normalizedCode, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `Coupon code ${normalizedCode} already exists` });
      }
      coupon.code = normalizedCode;
    }
  }

  const nextDiscountType = discountType || coupon.discountType;
  const nextDiscountValue = discountValue !== undefined ? toNumber(discountValue, 0) : coupon.discountValue;
  const nextStart = startDate !== undefined ? toDate(startDate) : coupon.startDate;
  const nextEnd = endDate !== undefined ? toDate(endDate) : coupon.endDate;

  const fieldError = validateCouponFields({
    discountType: nextDiscountType,
    discountValue: nextDiscountValue,
    startDate: nextStart,
    endDate: nextEnd,
  });
  if (fieldError) {
    return res.status(400).json({ success: false, message: fieldError });
  }

  if (description !== undefined) coupon.description = String(description).trim();
  coupon.discountType = nextDiscountType;
  coupon.discountValue = nextDiscountType === 'FREE_SHIPPING' ? 0 : nextDiscountValue;
  coupon.startDate = nextStart;
  coupon.endDate = nextEnd;

  if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = toNumber(maxDiscountAmount);
  if (minOrderAmount !== undefined) coupon.minOrderAmount = toNumber(minOrderAmount, 0);
  if (minQuantity !== undefined) coupon.minQuantity = toNumber(minQuantity);
  if (maxQuantity !== undefined) coupon.maxQuantity = toNumber(maxQuantity);
  if (usageLimit !== undefined) coupon.usageLimit = toNumber(usageLimit);
  if (perUserLimit !== undefined) coupon.perUserLimit = toNumber(perUserLimit);
  if (applicableTo !== undefined) coupon.applicableTo = applicableTo;
  if (productIds !== undefined) coupon.productIds = normalizeIds(productIds);
  if (categoryIds !== undefined) coupon.categoryIds = normalizeIds(categoryIds);
  if (vendorIds !== undefined) coupon.vendorIds = normalizeIds(vendorIds);
  if (customerEligibility !== undefined) coupon.customerEligibility = customerEligibility;
  if (customerIds !== undefined) coupon.customerIds = normalizeIds(customerIds);
  if (isActive !== undefined) coupon.isActive = toBool(isActive, coupon.isActive);

  await coupon.save();

  res.json({
    success: true,
    message: 'Coupon updated successfully',
    data: serializeCoupon(coupon),
  });
}

async function updateCouponStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  coupon.isActive = toBool(isActive, coupon.isActive);
  await coupon.save();

  res.json({
    success: true,
    message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`,
    data: serializeCoupon(coupon),
  });
}

async function deleteCoupon(req, res) {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  await coupon.deleteOne();

  res.json({
    success: true,
    message: 'Coupon deleted successfully',
    data: { id: coupon._id.toString() },
  });
}

// ---------------------------------------------------------------------------
// Checkout-time engine. Not wired to any route yet: there is no Order/Cart
// model and no shopper-auth middleware in this backend (Middlewares/
// userAuthMiddleware.js and utils/orderHelper.js are still empty stubs), so
// there is nowhere safe to source an authenticated `userId` from. Trusting a
// client-supplied userId over an unauthenticated endpoint would let anyone
// redeem/exhaust coupons on another shopper's behalf. Once the order/checkout
// module exists, call evaluateCoupon/redeemCoupon/releaseCoupon directly from
// it (req.user.id from real auth), or wrap them in routes at that point.
// ---------------------------------------------------------------------------

function filterEligibleItems(coupon, cartItems) {
  if (coupon.applicableTo === 'ALL') return cartItems;

  const key =
    coupon.applicableTo === 'PRODUCTS'
      ? 'productId'
      : coupon.applicableTo === 'CATEGORIES'
        ? 'categoryId'
        : 'vendorId';

  const idSet = new Set(
    (coupon.applicableTo === 'PRODUCTS'
      ? coupon.productIds
      : coupon.applicableTo === 'CATEGORIES'
        ? coupon.categoryIds
        : coupon.vendorIds
    ).map((v) => v.toString())
  );

  return cartItems.filter((item) => item[key] && idSet.has(String(item[key])));
}

function computeDiscountAmount(coupon, eligibleAmount, shippingFee) {
  if (coupon.discountType === 'FREE_SHIPPING') {
    const cap = coupon.maxDiscountAmount ?? shippingFee;
    return Math.max(0, Math.min(shippingFee, cap));
  }

  let raw =
    coupon.discountType === 'PERCENTAGE'
      ? (eligibleAmount * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.maxDiscountAmount != null) {
    raw = Math.min(raw, coupon.maxDiscountAmount);
  }

  return Math.max(0, Math.min(raw, eligibleAmount));
}

// cartItems: [{ productId, categoryId, vendorId, price, quantity }]
async function evaluateCoupon(coupon, { userId, cartItems = [], cartTotal, shippingFee = 0, isNewCustomer = false }) {
  const status = Coupon.resolveStatus(coupon);

  if (status === 'INACTIVE') return { valid: false, reason: 'This coupon is not active' };
  if (status === 'UPCOMING') return { valid: false, reason: 'This coupon is not valid yet' };
  if (status === 'EXPIRED') return { valid: false, reason: 'This coupon has expired' };
  if (status === 'USAGE_LIMIT_REACHED') return { valid: false, reason: 'This coupon has reached its usage limit' };

  if (coupon.customerEligibility === 'NEW' && !isNewCustomer) {
    return { valid: false, reason: 'This coupon is only for new customers' };
  }
  if (coupon.customerEligibility === 'EXISTING' && isNewCustomer) {
    return { valid: false, reason: 'This coupon is only for existing customers' };
  }
  if (coupon.customerEligibility === 'SPECIFIC') {
    const allowed = (coupon.customerIds || []).some((id) => id.toString() === String(userId));
    if (!allowed) return { valid: false, reason: 'This coupon is not available for your account' };
  }

  if (coupon.perUserLimit != null) {
    const usedByUser = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
      status: 'SUCCESS',
    });
    if (usedByUser >= coupon.perUserLimit) {
      return { valid: false, reason: 'You have already used this coupon the maximum number of times' };
    }
  }

  const eligibleItems = filterEligibleItems(coupon, cartItems);
  if (coupon.applicableTo !== 'ALL' && eligibleItems.length === 0) {
    return { valid: false, reason: 'Your cart has no items eligible for this coupon' };
  }

  const eligibleAmount = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const eligibleQuantity = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);
  const amountForMinCheck = coupon.applicableTo === 'ALL' ? (cartTotal ?? eligibleAmount) : eligibleAmount;

  if (coupon.minOrderAmount && amountForMinCheck < coupon.minOrderAmount) {
    return { valid: false, reason: `Minimum order amount of ${coupon.minOrderAmount} required` };
  }
  if (coupon.minQuantity != null && eligibleQuantity < coupon.minQuantity) {
    return { valid: false, reason: `Minimum quantity of ${coupon.minQuantity} required` };
  }
  if (coupon.maxQuantity != null && eligibleQuantity > coupon.maxQuantity) {
    return { valid: false, reason: `Maximum quantity of ${coupon.maxQuantity} exceeded` };
  }

  const discountAmount = computeDiscountAmount(coupon, eligibleAmount, shippingFee);
  if (discountAmount <= 0) {
    return { valid: false, reason: 'This coupon does not apply to your cart' };
  }

  return { valid: true, eligibleAmount, discountAmount };
}

// Atomically applies a coupon to an order: re-validates against the cart
// passed in (never trusts a discount amount computed earlier by the client —
// the cart may have changed since), then guards the global usage limit with
// a conditional $inc and wraps the per-user-limit check + redemption insert
// in a transaction so two concurrent redemptions can't both slip past a
// usageLimit/perUserLimit of 1.
async function redeemCoupon({ code, userId, orderId, cartItems = [], cartTotal, shippingFee = 0, isNewCustomer = false }) {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon) {
    throw Object.assign(new Error('Invalid coupon code'), { status: 404 });
  }

  const evaluation = await evaluateCoupon(coupon, { userId, cartItems, cartTotal, shippingFee, isNewCustomer });
  if (!evaluation.valid) {
    throw Object.assign(new Error(evaluation.reason), { status: 400 });
  }

  const session = await mongoose.startSession();
  try {
    let redemption;

    await session.withTransaction(async () => {
      if (coupon.perUserLimit != null) {
        const usedByUser = await CouponRedemption.countDocuments({
          couponId: coupon._id,
          userId,
          status: 'SUCCESS',
        }).session(session);
        if (usedByUser >= coupon.perUserLimit) {
          throw Object.assign(new Error('You have already used this coupon the maximum number of times'), { status: 400 });
        }
      }

      const usageFilter = { _id: coupon._id, isActive: true };
      if (coupon.usageLimit != null) usageFilter.usedCount = { $lt: coupon.usageLimit };

      const updatedCoupon = await Coupon.findOneAndUpdate(
        usageFilter,
        { $inc: { usedCount: 1 } },
        { new: true, session }
      );
      if (!updatedCoupon) {
        throw Object.assign(new Error('This coupon has reached its usage limit'), { status: 400 });
      }

      try {
        const [created] = await CouponRedemption.create(
          [
            {
              couponId: coupon._id,
              userId,
              orderId,
              discountAmount: evaluation.discountAmount,
              status: 'SUCCESS',
            },
          ],
          { session }
        );
        redemption = created;
      } catch (err) {
        if (err.code === 11000) {
          throw Object.assign(new Error('This order already has a coupon applied'), { status: 400 });
        }
        throw err;
      }
    });

    return { redemptionId: redemption._id.toString(), discountAmount: redemption.discountAmount };
  } finally {
    await session.endSession();
  }
}

// Reconciles a coupon's usage when the order it was applied to fails or is
// cancelled after redemption (e.g. payment declined) — releases the slot so
// it isn't unnecessarily consumed.
async function releaseCoupon({ orderId }) {
  const redemption = await CouponRedemption.findOne({ orderId, status: 'SUCCESS' });
  if (!redemption) {
    return null;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      redemption.status = 'CANCELLED';
      await redemption.save({ session });
      await Coupon.updateOne({ _id: redemption.couponId }, { $inc: { usedCount: -1 } }, { session });
    });

    return { redemptionId: redemption._id.toString() };
  } finally {
    await session.endSession();
  }
}

// Storefront-safe subset — no usage/eligibility internals, no admin-only
// fields — for sitewide coupons only (a category/product/vendor-scoped
// coupon wouldn't make sense as a generic homepage banner).
async function listPublicCoupons(req, res) {
  const now = new Date();
  const { limit = 3 } = req.query;

  const coupons = await Coupon.find({
    isActive: true,
    applicableTo: 'ALL',
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ discountValue: -1 })
    .limit(Math.min(10, Math.max(1, Number(limit) || 3)))
    .lean();

  const eligible = coupons.filter(
    (c) => c.usageLimit == null || c.usedCount < c.usageLimit
  );

  const items = eligible.map((c) => ({
    code: c.code,
    description: c.description || '',
    discountType: c.discountType,
    discountValue: c.discountValue || 0,
    maxDiscountAmount: c.maxDiscountAmount ?? null,
    minOrderAmount: c.minOrderAmount || 0,
    endDate: c.endDate,
  }));

  res.json({ success: true, data: { items } });
}

module.exports = {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
  evaluateCoupon,
  redeemCoupon,
  releaseCoupon,
  listPublicCoupons,
};
