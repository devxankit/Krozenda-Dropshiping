const mongoose = require('mongoose');
const Order = require('../Models/Order');
const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');

// ---------------------------------------------------------------------------
// The assistant's ONLY route to the database.
//
// Every exported tool takes `userId` as its first positional argument and the
// model-supplied arguments as its second. The model can influence the second
// argument; it can never influence the first — aiAssistant.js binds that from
// req.user._id, and the tool declarations below deliberately do not contain a
// userId/customerId parameter for the model to fill in. A tool call is
// therefore incapable of expressing "another customer's data": there is no
// field in which to say it.
//
// Each tool also returns a hand-built plain object rather than a Mongoose
// document, so a schema field added later (payment ids, internal notes,
// gateway references) is never silently forwarded to Gemini. Data
// minimisation is enforced by construction, not by remembering to strip.
// ---------------------------------------------------------------------------

// Real order statuses as stored by Models/Order. There are no PACKED /
// OUT_FOR_DELIVERY / RETURNED / REFUNDED order states in this system — return
// and refund state lives on ReturnRequest and Order.paymentStatus instead, and
// is surfaced from there rather than invented here.
const STATUS_LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const PAYMENT_STATUS_LABELS = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
};

// How many orders a single tool call may return. Keeps the Gemini payload
// bounded no matter what limit the model asks for.
const MAX_ORDERS_PER_CALL = 10;

// Customer-facing reference. Order._id is a Mongo ObjectId and is never shown
// to a buyer in full anywhere in the app, so the assistant speaks the same
// short form the rest of the UI does.
function orderRef(order) {
  return `ORD${order._id.toString().slice(-6).toUpperCase()}`;
}

function formatAddressSummary(address) {
  if (!address) return null;
  // City / state / pincode only. The recipient's name, phone and street lines
  // are never needed to answer "where is my order?" and so are not sent.
  return [address.city, address.state, address.pincode].filter(Boolean).join(', ') || null;
}

// Resolves seller names for a set of order items in one query, so a 10-order
// answer costs 1 vendor lookup rather than 10-50.
async function resolveVendorNames(orders) {
  const vendorIds = new Set();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.vendor) vendorIds.add(item.vendor.toString());
    }
  }
  if (vendorIds.size === 0) return new Map();

  const vendors = await Vendor.find({ _id: { $in: [...vendorIds] } })
    .select('name')
    .lean();
  return new Map(vendors.map((v) => [v._id.toString(), v.name]));
}

function serializeItem(item, vendorNames) {
  const tracking = {};
  // Tracking in this system is per line item, not per order — a multi-vendor
  // cart ships in several parcels. Absent fields are omitted entirely so the
  // model sees "not present" rather than an empty string it might render as a
  // blank tracking id.
  if (item.courierName) tracking.courier = item.courierName;
  if (item.trackingNumber) tracking.trackingNumber = item.trackingNumber;

  return {
    productName: item.name,
    quantity: item.quantity,
    price: item.price,
    variant: item.variant || undefined,
    itemStatus: STATUS_LABELS[item.status] || item.status,
    seller: item.vendor ? vendorNames.get(item.vendor.toString()) || undefined : undefined,
    ...(Object.keys(tracking).length ? { tracking } : {}),
  };
}

function serializeOrderSummary(order, vendorNames) {
  return {
    orderRef: orderRef(order),
    placedOn: order.createdAt,
    status: STATUS_LABELS[order.status] || order.status,
    paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: order.total,
    itemCount: (order.items || []).length,
    items: (order.items || []).map((item) => serializeItem(item, vendorNames)),
  };
}

function serializeOrderDetail(order, vendorNames) {
  return {
    ...serializeOrderSummary(order, vendorNames),
    deliveredOn: order.deliveredAt || undefined,
    shippingTo: formatAddressSummary(order.shippingAddress),
    // Stated explicitly rather than omitted: this platform stores no courier
    // ETA, and saying so keeps the model from filling the gap itself.
    expectedDeliveryDate: null,
    expectedDeliveryNote: 'This platform does not store an estimated delivery date for orders.',
    statusTimeline: (order.statusHistory || []).map((entry) => ({
      status: STATUS_LABELS[entry.status] || entry.status,
      at: entry.at,
    })),
  };
}

// The projection every order read goes through. Payment gateway ids, finance
// reconciliation flags, COD remittance references and the recipient's contact
// details are excluded at the database level.
const ORDER_FIELDS =
  'items shippingAddress.city shippingAddress.state shippingAddress.pincode total paymentMethod paymentStatus status deliveredAt statusHistory createdAt';

// --- Tools -----------------------------------------------------------------

async function getMyProfile(userId) {
  const user = await User.findById(userId).select('name email mobileNumber createdAt').lean();
  if (!user) return { found: false };

  return {
    found: true,
    name: user.name || null,
    // Contact details are masked: enough for the customer to recognise their
    // own account, never enough to be a useful leak if a transcript escapes.
    email: user.email
      ? user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
      : null,
    mobileNumber: user.mobileNumber ? `******${user.mobileNumber.slice(-4)}` : null,
    memberSince: user.createdAt,
  };
}

async function getMyOrderCount(userId) {
  const total = await Order.countDocuments({ user: userId });
  return { totalOrders: total };
}

async function getMyOrderCountByStatus(userId, { status } = {}) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();

  if (!Order.STATUSES.includes(normalized)) {
    return {
      error: `Unknown status "${status}". Valid statuses are: ${Order.STATUSES.join(', ')}.`,
      validStatuses: Order.STATUSES,
    };
  }

  const count = await Order.countDocuments({ user: userId, status: normalized });
  return { status: STATUS_LABELS[normalized], count };
}

async function getMyOrderCountsByEveryStatus(userId) {
  // One grouped pass instead of five countDocuments round trips.
  const rows = await Order.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = Object.fromEntries(Order.STATUSES.map((s) => [STATUS_LABELS[s], 0]));
  let total = 0;
  for (const row of rows) {
    counts[STATUS_LABELS[row._id] || row._id] = row.count;
    total += row.count;
  }

  return { totalOrders: total, countsByStatus: counts };
}

async function getMyRecentOrders(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ORDERS_PER_CALL);

  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(capped)
    .select(ORDER_FIELDS)
    .lean();

  if (orders.length === 0) return { orders: [], note: 'This customer has not placed any orders yet.' };

  const vendorNames = await resolveVendorNames(orders);
  return { orders: orders.map((o) => serializeOrderSummary(o, vendorNames)) };
}

async function getMyLatestOrder(userId) {
  const order = await Order.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select(ORDER_FIELDS)
    .lean();

  if (!order) return { found: false, note: 'This customer has not placed any orders yet.' };

  const vendorNames = await resolveVendorNames([order]);
  return { found: true, order: serializeOrderDetail(order, vendorNames) };
}

// Resolves whatever the customer typed ("ORD4F2A9C", a bare suffix, a full
// ObjectId) to one of THEIR OWN orders. The user filter is applied in the
// query itself in every branch, so an id belonging to somebody else simply
// does not match — the caller cannot tell "not yours" from "does not exist",
// which is the point.
async function findOwnedOrder(userId, rawOrderId) {
  const cleaned = String(rawOrderId || '')
    .trim()
    .replace(/^#/, '')
    .replace(/^ORD/i, '');

  if (!cleaned) return null;

  if (mongoose.isValidObjectId(cleaned)) {
    return Order.findOne({ _id: cleaned, user: userId }).select(ORDER_FIELDS).lean();
  }

  // Short customer-facing reference: match on the trailing hex of the id,
  // scanning only this customer's own orders.
  if (/^[0-9a-f]{4,24}$/i.test(cleaned)) {
    const suffix = cleaned.toLowerCase();
    const candidates = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .select(ORDER_FIELDS)
      .lean();
    return candidates.find((o) => o._id.toString().toLowerCase().endsWith(suffix)) || null;
  }

  return null;
}

async function getMyOrderById(userId, { orderId } = {}) {
  const order = await findOwnedOrder(userId, orderId);
  // Identical response whether the order belongs to another customer or was
  // never real. Never "that order exists but is not yours".
  if (!order) return { found: false, note: 'No order with that reference was found on this account.' };

  const vendorNames = await resolveVendorNames([order]);
  return { found: true, order: serializeOrderDetail(order, vendorNames) };
}

async function getMyOrderStatus(userId, { orderId } = {}) {
  const order = await findOwnedOrder(userId, orderId);
  if (!order) return { found: false, note: 'No order with that reference was found on this account.' };

  const vendorNames = await resolveVendorNames([order]);
  const detail = serializeOrderDetail(order, vendorNames);

  return {
    found: true,
    orderRef: detail.orderRef,
    status: detail.status,
    paymentStatus: detail.paymentStatus,
    deliveredOn: detail.deliveredOn,
    expectedDeliveryDate: null,
    expectedDeliveryNote: detail.expectedDeliveryNote,
    shipments: detail.items
      .filter((item) => item.tracking)
      .map((item) => ({ productName: item.productName, ...item.tracking, itemStatus: item.itemStatus })),
    statusTimeline: detail.statusTimeline,
  };
}

async function getMyReturnRequests(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ORDERS_PER_CALL);

  const requests = await ReturnRequest.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(capped)
    .select('order productName requestType status refundAmount resolvedAt createdAt')
    .populate({ path: 'order', select: '_id' })
    .lean();

  if (requests.length === 0) {
    return { requests: [], note: 'This customer has no return or replacement requests.' };
  }

  return {
    requests: requests.map((r) => ({
      orderRef: r.order ? `ORD${r.order._id.toString().slice(-6).toUpperCase()}` : null,
      productName: r.productName,
      type: r.requestType,
      status: r.status,
      refundAmount: r.refundAmount ?? undefined,
      resolvedOn: r.resolvedAt || undefined,
      requestedOn: r.createdAt,
    })),
  };
}

// "What do I buy most?" — answered by aggregating the customer's own order
// items into category totals. Cancelled orders are excluded so an abandoned
// purchase doesn't count as a preference.
async function getMyPurchaseSummary(userId) {
  const rows = await Order.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), status: { $ne: 'CANCELLED' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        productName: { $first: '$items.name' },
        unitsBought: { $sum: '$items.quantity' },
        amountSpent: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { unitsBought: -1 } },
    { $limit: 50 },
  ]);

  if (rows.length === 0) {
    return { note: 'This customer has no completed purchases to summarise yet.' };
  }

  const products = await Product.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } })
    .select('category')
    .populate({ path: 'category', select: 'name' })
    .lean();
  const categoryByProduct = new Map(
    products.map((p) => [p._id.toString(), p.category?.name || 'Uncategorised'])
  );

  const byCategory = new Map();
  let totalSpent = 0;
  let totalUnits = 0;

  for (const row of rows) {
    const category = row._id
      ? categoryByProduct.get(row._id.toString()) || 'Uncategorised'
      : 'Uncategorised';
    const current = byCategory.get(category) || { category, unitsBought: 0, amountSpent: 0 };
    current.unitsBought += row.unitsBought;
    current.amountSpent += row.amountSpent;
    byCategory.set(category, current);
    totalSpent += row.amountSpent;
    totalUnits += row.unitsBought;
  }

  return {
    totalItemsBought: totalUnits,
    totalAmountSpent: Math.round(totalSpent),
    topCategories: [...byCategory.values()]
      .sort((a, b) => b.unitsBought - a.unitsBought)
      .slice(0, 5)
      .map((c) => ({ ...c, amountSpent: Math.round(c.amountSpent) })),
    topProducts: rows.slice(0, 5).map((r) => ({
      productName: r.productName,
      unitsBought: r.unitsBought,
      amountSpent: Math.round(r.amountSpent),
    })),
  };
}

// --- Gemini tool declarations ----------------------------------------------
//
// Note what is absent from every `parameters` block: there is no userId,
// customerId, email or phone parameter anywhere. The model has no vocabulary
// for requesting somebody else's data.
//
// Tools that take no arguments omit `parameters` entirely rather than
// declaring an empty object — the API rejects
// `{ type: 'OBJECT', properties: {} }` with "should be non-empty for OBJECT
// type", which would fail the whole request, not just that one declaration.
const TOOL_DECLARATIONS = [
  {
    name: 'getMyProfile',
    description:
      'Basic profile of the signed-in customer: their name and when they joined. Use for questions about their own account.',
  },
  {
    name: 'getMyOrderCount',
    description:
      'Total number of orders the signed-in customer has ever placed. Use for "how many orders have I placed".',
  },
  {
    name: 'getMyOrderCountsByEveryStatus',
    description:
      'Order counts broken down across every status at once (Pending, Processing, Shipped, Delivered, Cancelled). Prefer this when the customer asks about more than one status, or asks for a general breakdown.',
  },
  {
    name: 'getMyOrderCountByStatus',
    description:
      'Number of the signed-in customer\'s orders in ONE specific status. Use for "how many orders were delivered" or "how many did I cancel".',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          description: 'One of: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED.',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'getMyRecentOrders',
    description:
      'The signed-in customer\'s most recent orders, newest first, with products, amounts and status. Use for order history questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many orders to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMyLatestOrder',
    description:
      'Full detail of the signed-in customer\'s single most recent order, including items, status timeline and any tracking. Use for "what is my latest order" or "where is my order" when no specific order is named.',
  },
  {
    name: 'getMyOrderById',
    description:
      'Full detail of one specific order belonging to the signed-in customer, looked up by the order reference they mentioned (for example ORD4F2A9C). Returns found:false if no such order exists on their account.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'The order reference exactly as the customer wrote it.' },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'getMyOrderStatus',
    description:
      'Current status, payment status and any courier tracking for one specific order of the signed-in customer, looked up by order reference.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId: { type: 'STRING', description: 'The order reference exactly as the customer wrote it.' },
      },
      required: ['orderId'],
    },
  },
  {
    name: 'getMyReturnRequests',
    description:
      'The signed-in customer\'s return and replacement requests with their current status and any refund amount.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many requests to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMyPurchaseSummary',
    description:
      'Aggregated shopping summary for the signed-in customer: total spent, total items, top categories and top products. Use for "what do I buy the most" style questions.',
  },
];

// Name -> implementation. aiAssistant.js rejects any function name the model
// returns that is not an own key of this object, so a hallucinated tool is a
// handled error rather than a crash or an unchecked call.
const TOOL_IMPLEMENTATIONS = Object.freeze({
  getMyProfile,
  getMyOrderCount,
  getMyOrderCountsByEveryStatus,
  getMyOrderCountByStatus,
  getMyRecentOrders,
  getMyLatestOrder,
  getMyOrderById,
  getMyOrderStatus,
  getMyReturnRequests,
  getMyPurchaseSummary,
});

module.exports = {
  TOOL_DECLARATIONS,
  TOOL_IMPLEMENTATIONS,
  STATUS_LABELS,
  orderRef,
  // Exported individually for the security test suite.
  getMyProfile,
  getMyOrderCount,
  getMyOrderCountsByEveryStatus,
  getMyOrderCountByStatus,
  getMyRecentOrders,
  getMyLatestOrder,
  getMyOrderById,
  getMyOrderStatus,
  getMyReturnRequests,
  getMyPurchaseSummary,
};
