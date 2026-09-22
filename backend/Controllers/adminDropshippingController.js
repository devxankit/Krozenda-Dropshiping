const Vendor = require('../Models/Vendor');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { toPaise } = require('../utils/money');

// "Dropshipping partner" on this panel is not a separate entity — it IS a
// B2B Vendor (vendorType: 'B2B'). See adminAnalyticsController.ATTRIBUTE_LINES,
// which already treats vendorType 'B2B' as business model "direct
// dropshipping", and adminFinanceController's commission-rules screen, which
// already treats Vendor.commissionRatePercent as the real commission rule.
//
// This module scopes those same real collections (Vendor/Order/Product) to
// B2B only and serves them under /admin/dropshipping/*. Fields that describe
// a genuinely unbuilt feature (external supplier sync/auto-forwarding — see
// dropshippingSchema.js's integrationMode/autoForward/syncStatus/etc.) are
// NOT fabricated here: they are returned as honest constants (see inline
// comments at each such field) rather than invented values.

const DEFAULT_COMMISSION_RATE = 10; // mirrors adminFinanceController.DEFAULT_COMMISSION_RATE

const BUSINESS_TYPE_LABELS = {
  proprietorship: 'Proprietorship',
  partnership: 'Partnership',
  llp: 'LLP',
  private_limited: 'Private limited',
  public_limited: 'Public limited',
  huf: 'HUF',
  society_trust: 'Society / Trust',
  other: 'Other',
};

// Vendor.verificationStatus -> frontend REVIEW_STATUS (constants.js). There is
// no "changes_requested"/"draft"/"not_applicable" concept on Vendor, so those
// three values are simply never produced here.
const KYC_STATUS_OUT = {
  PENDING: 'submitted',
  UNDER_REVIEW: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Order.items[].status -> the forwarding-status vocabulary the frontend's
// ORDER_TABS (awaiting_partner/accepted/shipped) expect. PENDING (seller
// hasn't acted yet) maps to "awaiting the partner"; PROCESSING (accepted, not
// yet shipped) maps to "accepted"; SHIPPED/DELIVERED both count as shipped
// out; CANCELLED passes through unchanged since there is no forwarding
// equivalent for it.
const FORWARDING_STATUS_OUT = {
  PENDING: 'awaiting_partner',
  PROCESSING: 'accepted',
  SHIPPED: 'shipped',
  DELIVERED: 'shipped',
  CANCELLED: 'cancelled',
};

function vendorLabel(v) {
  return v?.business?.businessName || v?.name || 'Unknown seller';
}

function vendorStatus(v) {
  const isRejected = v.verificationStatus === 'REJECTED';
  if (isRejected || (v.verificationStatus === 'APPROVED' && !v.isActive)) return 'suspended';
  return v.isActive ? 'active' : 'pending';
}

function paged(items, { page = 1, rowsPerPage = 25 } = {}, tabCounts) {
  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: currentPage,
    rowsPerPage: perPage,
    totalItems,
    totalPages,
    tabCounts,
  };
}

async function b2bVendorIds() {
  const vendors = await Vendor.find({ vendorType: 'B2B' }).select('_id').lean();
  return vendors.map((v) => v._id);
}

// Per-vendor products/orders/revenue, scoped to B2B, same shape as
// adminVendorController.vendorTradeStats but written locally per this
// module's instructions (do not import from another controller).
async function b2bTradeStats(vendorIds) {
  const [skuRows, salesRows] = await Promise.all([
    Product.aggregate([
      { $match: { vendor: { $in: vendorIds } } },
      { $group: { _id: '$vendor', products: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $unwind: '$items' },
      { $match: { 'items.vendor': { $in: vendorIds } } },
      {
        $group: {
          _id: '$items.vendor',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $addToSet: '$_id' },
        },
      },
    ]),
  ]);

  const byVendor = new Map();
  for (const row of skuRows) {
    byVendor.set(row._id.toString(), { products: row.products, orders: 0, revenue: 0 });
  }
  for (const row of salesRows) {
    const key = row._id.toString();
    const existing = byVendor.get(key) || { products: 0, orders: 0, revenue: 0 };
    existing.orders = row.orders.length;
    existing.revenue = Math.round(row.revenue * 100); // rupees -> paise
    byVendor.set(key, existing);
  }
  return byVendor;
}

// ---------------------------------------------------------------------------
// GET /admin/dropshipping/partners
// ---------------------------------------------------------------------------
async function getDropshipPartners(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const vendors = await Vendor.find({ vendorType: 'B2B' }).sort({ createdAt: -1 }).lean();
  const vendorIds = vendors.map((v) => v._id);
  const tradeStats = await b2bTradeStats(vendorIds);

  const allSerialized = vendors.map((v) => {
    const stats = tradeStats.get(v._id.toString()) || { products: 0, orders: 0, revenue: 0 };
    return {
      id: v._id.toString(),
      name: v.business?.businessName || v.name,
      supplierType: BUSINESS_TYPE_LABELS[v.business?.businessType] || 'Business seller',
      city: v.address?.city || '',
      gstin: v.business?.gstin || null,
      // No real supplier-integration system exists on this platform — every
      // partner is onboarded and managed manually, so this is a true
      // constant rather than an invented "REST API Adapter" style value.
      integrationMode: 'Manual',
      products: stats.products,
      ordersCount: stats.orders,
      revenue: stats.revenue,
      kycStatus: KYC_STATUS_OUT[v.verificationStatus] || 'submitted',
      routeLinked: Boolean(v.razorpay?.isSettlementEligible),
      // No auto-forward feature exists; always false rather than fabricated.
      autoForward: false,
      joinedAt: v.createdAt,
      status: vendorStatus(v),
    };
  });

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.city.toLowerCase().includes(term) ||
        (p.gstin || '').toLowerCase().includes(term),
    );
  }

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab && ['active', 'pending', 'suspended'].includes(effectiveTab)) {
    items = items.filter((p) => p.status === effectiveTab);
  }

  const tabCounts = {
    all: allSerialized.length,
    active: allSerialized.filter((p) => p.status === 'active').length,
    pending: allSerialized.filter((p) => p.status === 'pending').length,
    suspended: allSerialized.filter((p) => p.status === 'suspended').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

// ---------------------------------------------------------------------------
// GET /admin/dropshipping/overview
// ---------------------------------------------------------------------------
async function getDropshipOverview(req, res) {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const vendorIds = await b2bVendorIds();

  const [activePartners, pendingPartners, liveSkus, todayLineRows, vendorRateRows] = await Promise.all([
    Vendor.countDocuments({ vendorType: 'B2B', isActive: true, verificationStatus: 'APPROVED' }),
    Vendor.countDocuments({ vendorType: 'B2B', verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
    Product.countDocuments({ vendor: { $in: vendorIds } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfToday, $lt: endOfToday } } },
      { $unwind: '$items' },
      { $match: { 'items.vendor': { $in: vendorIds } } },
      {
        $group: {
          _id: { order: '$_id', vendor: '$items.vendor' },
          createdAt: { $first: '$createdAt' },
          status: { $first: '$items.status' },
          trackingNumber: { $first: '$items.trackingNumber' },
          productName: { $first: '$items.name' },
          qty: { $sum: '$items.quantity' },
          amount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
    Vendor.find({ vendorType: 'B2B' }).select('commissionRatePercent').lean(),
  ]);

  const rateByVendor = new Map(vendorRateRows.map((v) => [v._id.toString(), v.commissionRatePercent ?? DEFAULT_COMMISSION_RATE]));

  const vendorNameRows = await Vendor.find({ _id: { $in: todayLineRows.map((r) => r._id.vendor) } })
    .select('name business.businessName')
    .lean();
  const nameByVendor = new Map(vendorNameRows.map((v) => [v._id.toString(), vendorLabel(v)]));

  let grossSalesToday = 0;
  let platformMarginToday = 0;
  const suffixes = new Map();
  const recentOrders = todayLineRows.slice(0, 8).map((row) => {
    const vendorId = row._id.vendor.toString();
    const orderId = row._id.order.toString();
    const rate = rateByVendor.get(vendorId) ?? DEFAULT_COMMISSION_RATE;
    const commission = Math.round(row.amount * (rate / 100));
    grossSalesToday += row.amount;
    platformMarginToday += commission;

    const index = suffixes.get(orderId) || 0;
    suffixes.set(orderId, index + 1);

    return {
      subOrderId: `${orderId.slice(-8).toUpperCase()}-${String.fromCharCode(65 + index)}`,
      parentOrderId: orderId,
      partnerName: nameByVendor.get(vendorId) || 'Unknown partner',
      productName: row.productName,
      qty: row.qty,
      amount: toPaise(row.amount),
      commission: toPaise(commission),
      status: FORWARDING_STATUS_OUT[row.status] || 'awaiting_partner',
      forwardedAt: row.createdAt,
    };
  });

  res.json({
    success: true,
    data: {
      activePartners,
      pendingPartners,
      liveSkus,
      forwardedOrdersToday: todayLineRows.length,
      grossSalesToday: toPaise(grossSalesToday),
      platformMarginToday: toPaise(platformMarginToday),
      // No supplier auto-forwarding system exists on this platform, so there
      // is no real success rate to report. 0 (not a fabricated percentage)
      // is the honest value until that feature is built.
      autoForwardSuccessRate: 0,
      // Same reasoning: no supplier sync system exists to report health for.
      syncHealth: 'not_configured',
      recentOrders,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/dropshipping/orders
// ---------------------------------------------------------------------------
async function getForwardedOrders(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const vendorIds = await b2bVendorIds();
  const vendorRows = await Vendor.find({ _id: { $in: vendorIds } })
    .select('name business.businessName commissionRatePercent')
    .lean();
  const vendorById = new Map(vendorRows.map((v) => [v._id.toString(), v]));

  const orders = await Order.find({ 'items.vendor': { $in: vendorIds } })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const allSerialized = [];
  orders.forEach((order) => {
    order.items
      .filter((item) => item.vendor && vendorById.has(item.vendor.toString()))
      .forEach((item) => {
        const vendor = vendorById.get(item.vendor.toString());
        const rate = vendor.commissionRatePercent ?? DEFAULT_COMMISSION_RATE;
        const orderValue = item.price * item.quantity;
        const commissionAmount = Math.round(orderValue * (rate / 100));

        allSerialized.push({
          id: `${order._id.toString()}:${item.vendor.toString()}`,
          parentOrderId: order._id.toString(),
          customerName: order.user?.name || '',
          partnerName: vendorLabel(vendor),
          productName: item.name,
          quantity: item.quantity,
          orderValue: toPaise(orderValue),
          commissionAmount: toPaise(commissionAmount),
          supplierPayable: toPaise(orderValue - commissionAmount),
          forwardingStatus: FORWARDING_STATUS_OUT[item.status] || 'awaiting_partner',
          awb: item.trackingNumber || null,
          placedAt: order.createdAt,
        });
      });
  });

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (o) =>
        o.parentOrderId.includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        o.partnerName.toLowerCase().includes(term) ||
        o.productName.toLowerCase().includes(term),
    );
  }

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab && ['awaiting_partner', 'accepted', 'shipped', 'cancelled'].includes(effectiveTab)) {
    items = items.filter((o) => o.forwardingStatus === effectiveTab);
  }

  const tabCounts = {
    all: allSerialized.length,
    awaiting_partner: allSerialized.filter((o) => o.forwardingStatus === 'awaiting_partner').length,
    accepted: allSerialized.filter((o) => o.forwardingStatus === 'accepted').length,
    shipped: allSerialized.filter((o) => o.forwardingStatus === 'shipped').length,
    cancelled: allSerialized.filter((o) => o.forwardingStatus === 'cancelled').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

// ---------------------------------------------------------------------------
// GET /admin/dropshipping/margins — mirrors
// adminFinanceController.listCommissionRules, scoped to active B2B vendors,
// plus the same synthetic platform-default row.
// ---------------------------------------------------------------------------
async function getDropshipMarginRules(req, res) {
  const vendors = await Vendor.find({ vendorType: 'B2B', isActive: true })
    .select('name business.businessName commissionRatePercent updatedAt isActive')
    .lean();

  const items = [
    {
      id: 'default',
      ruleName: 'Platform default commission',
      scope: 'default',
      targetName: 'All dropshipping partners',
      commissionType: 'percentage',
      value: DEFAULT_COMMISSION_RATE,
      manualOverrideAllowed: true,
      status: 'active',
    },
    ...vendors.map((v) => ({
      id: v._id.toString(),
      ruleName: `${vendorLabel(v)} commission`,
      scope: 'vendor',
      targetName: vendorLabel(v),
      commissionType: 'percentage',
      value: v.commissionRatePercent ?? DEFAULT_COMMISSION_RATE,
      manualOverrideAllowed: true,
      status: v.isActive ? 'active' : 'inactive',
    })),
  ];

  res.json({ success: true, data: items });
}

module.exports = {
  getDropshipPartners,
  getDropshipOverview,
  getForwardedOrders,
  getDropshipMarginRules,
};
