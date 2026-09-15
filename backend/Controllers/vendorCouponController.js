const Coupon = require('../Models/Coupon');
const Product = require('../Models/Product');

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
    code: c.code,
    description: c.description || '',
    discountType: c.discountType,
    discountValue: c.discountValue || 0,
    maxDiscountAmount: c.maxDiscountAmount ?? null,
    minOrderAmount: c.minOrderAmount || 0,
    usageLimit: c.usageLimit ?? null,
    usedCount: c.usedCount || 0,
    perUserLimit: c.perUserLimit ?? null,
    productIds: (c.productIds || []).map((id) => id.toString()),
    startDate: c.startDate,
    endDate: c.endDate,
    isActive: c.isActive !== false,
    status: Coupon.resolveStatus(c),
    createdAt: c.createdAt,
  };
}

async function listMyCoupons(req, res) {
  const { tab, search, page = 1, rowsPerPage = 25 } = req.query;

  const coupons = await Coupon.find({ vendorId: req.vendor._id }).sort({ createdAt: -1 }).lean();
  const allSerialized = coupons.map(serializeCoupon);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((c) => c.code.toLowerCase().includes(term) || c.description.toLowerCase().includes(term));
  }

  const effectiveTab = tab && tab !== 'all' ? tab.toUpperCase() : null;
  if (effectiveTab) {
    items = items.filter((c) => c.status === effectiveTab);
  }

  const tabCounts = {
    all: allSerialized.length,
    active: allSerialized.filter((c) => c.status === 'ACTIVE').length,
    upcoming: allSerialized.filter((c) => c.status === 'UPCOMING').length,
    expired: allSerialized.filter((c) => c.status === 'EXPIRED').length,
    usage_limit_reached: allSerialized.filter((c) => c.status === 'USAGE_LIMIT_REACHED').length,
    inactive: allSerialized.filter((c) => c.status === 'INACTIVE').length,
  };

  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;

  res.json({
    success: true,
    data: {
      items: items.slice(start, start + perPage),
      page: currentPage,
      rowsPerPage: perPage,
      totalItems,
      totalPages,
      tabCounts,
    },
  });
}

// A seller coupon is always scoped to a subset of THEIR OWN products — never
// sitewide/category/other-vendor — so the marketplace-level discount surface
// stays admin-controlled (per platform rule: sellers get their own coupons,
// not platform-wide ones).
async function createMyCoupon(req, res) {
  const { code, description, discountType, discountValue, maxDiscountAmount, minOrderAmount, usageLimit, perUserLimit, productIds, startDate, endDate } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }
  const normalizedCode = code.trim().toUpperCase();

  const discountValueNum = toNumber(discountValue, 0);
  if (!Coupon.DISCOUNT_TYPES.includes(discountType)) {
    return res.status(400).json({ success: false, message: 'Enter a valid discount type' });
  }
  if (discountType !== 'FREE_SHIPPING' && (discountValueNum === null || discountValueNum <= 0)) {
    return res.status(400).json({ success: false, message: 'Enter a valid discount value' });
  }

  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || end <= start) {
    return res.status(400).json({ success: false, message: 'Enter a valid date range' });
  }

  const ids = normalizeIds(productIds);
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Select at least one of your products' });
  }
  const ownedCount = await Product.countDocuments({ _id: { $in: ids }, vendor: req.vendor._id });
  if (ownedCount !== ids.length) {
    return res.status(400).json({ success: false, message: 'You can only apply coupons to your own products' });
  }

  const existing = await Coupon.findOne({ code: normalizedCode });
  if (existing) {
    return res.status(400).json({ success: false, message: `Coupon code ${normalizedCode} already exists` });
  }

  const coupon = await Coupon.create({
    code: normalizedCode,
    description: description ? String(description).trim() : '',
    discountType,
    discountValue: discountType === 'FREE_SHIPPING' ? 0 : discountValueNum,
    maxDiscountAmount: toNumber(maxDiscountAmount),
    minOrderAmount: toNumber(minOrderAmount, 0),
    usageLimit: toNumber(usageLimit),
    perUserLimit: toNumber(perUserLimit),
    applicableTo: 'PRODUCTS',
    productIds: ids,
    startDate: start,
    endDate: end,
    isActive: true,
    vendorId: req.vendor._id,
  });

  res.status(201).json({ success: true, message: 'Coupon created successfully', data: serializeCoupon(coupon) });
}

async function updateMyCouponStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  const coupon = await Coupon.findOne({ _id: id, vendorId: req.vendor._id });
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }

  coupon.isActive = toBool(isActive, coupon.isActive);
  await coupon.save();

  res.json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`, data: serializeCoupon(coupon) });
}

async function deleteMyCoupon(req, res) {
  const { id } = req.params;
  const coupon = await Coupon.findOne({ _id: id, vendorId: req.vendor._id });
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
  }
  await coupon.deleteOne();
  res.json({ success: true, message: 'Coupon deleted successfully', data: { id: coupon._id.toString() } });
}

module.exports = { listMyCoupons, createMyCoupon, updateMyCouponStatus, deleteMyCoupon };
