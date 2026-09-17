const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const Vendor = require('../Models/Vendor');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const CouponRedemption = require('../Models/CouponRedemption');
const Notification = require('../Models/Notification');
const Ticket = require('../Models/Ticket');
const Review = require('../Models/Review');

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

// How many rows any single tool call may return. Keeps the Gemini payload
// bounded no matter what limit the model asks for.
const MAX_ORDERS_PER_CALL = 10;
const MAX_ROWS_PER_CALL = 10;

// Wallet ledger reasons, in customer language rather than enum spelling.
const SOURCE_LABELS = {
  TOPUP: 'Wallet top-up',
  ORDER_PAYMENT: 'Paid for an order',
  ORDER_REFUND: 'Refund for a cancelled or returned order',
};

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

// The customer's own account details, shown in full.
//
// These are deliberately NOT masked. It is the caller's own profile, already
// displayed in full on the Edit Profile screen, so masking it here only made
// the assistant useless ("your email is r****@example.com") without protecting
// anything the customer cannot already see. The protection that matters is
// that `userId` is the authenticated id — a different customer's profile is
// unreachable, not merely redacted.
//
// `password` is absent from the projection and is `select: false` on the
// schema besides, so there is no path by which a hash reaches this object.
async function getMyProfile(userId) {
  const user = await Customer.findById(userId)
    .select('name email mobileNumber gender dob walletBalance createdAt')
    .lean();
  if (!user) return { found: false };

  return {
    found: true,
    name: user.name || null,
    email: user.email || null,
    mobileNumber: user.mobileNumber || null,
    gender: user.gender || null,
    dateOfBirth: user.dob || null,
    walletBalance: user.walletBalance ?? 0,
    memberSince: user.createdAt,
  };
}

// Wallet balance plus the recent ledger. Razorpay order/payment ids are
// excluded from the projection: they identify a payment instrument and are of
// no use in a support answer.
async function getMyWallet(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ROWS_PER_CALL);

  const [user, transactions] = await Promise.all([
    Customer.findById(userId).select('walletBalance').lean(),
    WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(capped)
      .select('type amount balanceAfter source status orderId createdAt')
      .lean(),
  ]);

  if (!user) return { found: false };

  return {
    found: true,
    balance: user.walletBalance ?? 0,
    currency: 'INR',
    recentTransactions: transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      reason: SOURCE_LABELS[t.source] || t.source,
      status: t.status,
      at: t.createdAt,
    })),
  };
}

async function getMyAddresses(userId) {
  const addresses = await Address.find({ user: userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .select('type fullName phone line1 line2 city state pincode country isDefault')
    .lean();

  if (addresses.length === 0) {
    return { addresses: [], note: 'This customer has no saved addresses yet.' };
  }

  return {
    addresses: addresses.map((a) => ({
      label: a.type,
      isDefault: a.isDefault,
      recipient: a.fullName,
      phone: a.phone,
      address: [a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', '),
    })),
  };
}

async function getMyCart(userId) {
  const cart = await Cart.findOne({ user: userId })
    .populate({ path: 'items.product', select: 'name price salePrice isActive stock' })
    .lean();

  // Mirrors checkout: a product deleted or delisted since it was added is not
  // a cart line any more, so it must not be reported as one.
  const entries = (cart?.items || []).filter((entry) => entry.product && entry.product.isActive);

  if (entries.length === 0) {
    return { items: [], itemCount: 0, note: 'This customer\'s cart is empty.' };
  }

  const items = entries.map((entry) => {
    const price = entry.product.salePrice ?? entry.product.price ?? 0;
    return {
      productName: entry.product.name,
      quantity: entry.quantity,
      price,
      lineTotal: price * entry.quantity,
      variant: entry.variant || undefined,
      inStock: entry.product.stock > 0,
    };
  });

  return {
    items,
    itemCount: items.length,
    // A quote of the items only. Shipping, coupons and wallet credit are
    // applied at checkout, so this is explicitly not "what you will pay".
    itemsSubtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    note: 'Subtotal covers items only. Delivery charges and any coupon are applied at checkout.',
  };
}

async function getMyWishlist(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), MAX_ROWS_PER_CALL);

  const wishlist = await Wishlist.findOne({ user: userId })
    .populate({ path: 'items.product', select: 'name price salePrice isActive stock' })
    .lean();

  const entries = (wishlist?.items || []).filter((entry) => entry.product && entry.product.isActive);

  if (entries.length === 0) {
    return { items: [], note: 'This customer has nothing saved to their wishlist.' };
  }

  return {
    totalSaved: entries.length,
    items: entries.slice(0, capped).map((entry) => ({
      productName: entry.product.name,
      price: entry.product.salePrice ?? entry.product.price ?? 0,
      inStock: entry.product.stock > 0,
      savedOn: entry.addedAt,
    })),
  };
}

// Coupons this customer has actually used. Deliberately scoped to their own
// redemptions rather than listing the platform's active coupon catalogue —
// that is a marketing surface, not account data, and belongs on the Offers
// screen where the real eligibility rules are applied.
async function getMyCouponUsage(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ROWS_PER_CALL);

  const redemptions = await CouponRedemption.find({ userId })
    .sort({ redeemedAt: -1 })
    .limit(capped)
    .select('couponId discountAmount status redeemedAt')
    .populate({ path: 'couponId', select: 'code' })
    .lean();

  if (redemptions.length === 0) {
    return { redemptions: [], note: 'This customer has not used any coupons yet.' };
  }

  const totalSaved = redemptions.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

  return {
    totalDiscountSaved: Math.round(totalSaved),
    redemptions: redemptions.map((r) => ({
      code: r.couponId?.code || 'Unknown',
      discountAmount: r.discountAmount,
      status: r.status,
      usedOn: r.redeemedAt,
    })),
  };
}

async function getMyNotifications(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ROWS_PER_CALL);

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(capped)
      .select('type title message isRead createdAt')
      .lean(),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  if (notifications.length === 0) {
    return { notifications: [], unreadCount: 0, note: 'This customer has no notifications.' };
  }

  return {
    unreadCount,
    notifications: notifications.map((n) => ({
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      at: n.createdAt,
    })),
  };
}

async function getMySupportTickets(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ROWS_PER_CALL);

  const tickets = await Ticket.find({ user: userId, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(capped)
    .select('ticketId subject category status priority messages resolvedAt createdAt')
    .lean();

  if (tickets.length === 0) {
    return { tickets: [], note: 'This customer has not raised any support tickets.' };
  }

  return {
    tickets: tickets.map((t) => {
      // Internal notes are staff-only annotations that happen to live on the
      // same thread. They are filtered out here, before anything is counted or
      // quoted, so no part of one can reach the model.
      const visible = (t.messages || []).filter((m) => !m.isInternal);
      const last = visible[visible.length - 1];

      return {
        ticketRef: t.ticketId,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        messageCount: visible.length,
        lastMessage: last ? { from: last.sender, text: last.message, at: last.createdAt } : undefined,
        resolvedOn: t.resolvedAt || undefined,
        raisedOn: t.createdAt,
      };
    }),
  };
}

async function getMyReviews(userId, { limit } = {}) {
  const parsed = Number.parseInt(limit, 10);
  const capped = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 5, 1), MAX_ROWS_PER_CALL);

  const reviews = await Review.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(capped)
    .select('product rating reviewText createdAt')
    .populate({ path: 'product', select: 'name' })
    .lean();

  if (reviews.length === 0) {
    return { reviews: [], note: 'This customer has not reviewed anything yet.' };
  }

  return {
    reviews: reviews.map((r) => ({
      productName: r.product?.name || 'a product no longer listed',
      rating: r.rating,
      review: r.reviewText || undefined,
      writtenOn: r.createdAt,
    })),
  };
}

// The "tell me everything about my account" tool.
//
// Exists because the tool loop is capped at MAX_TOOL_ROUNDS: answering a broad
// question by chaining eight separate lookups would exhaust the budget and
// fall back to a generic reply. One parallel pass returns headline figures for
// every area, and the model can follow up with a specific tool if the customer
// then drills into one.
async function getMyAccountOverview(userId) {
  const [profile, wallet, orderCounts, addresses, cart, wishlist, coupons, tickets, returns, reviews, unreadNotifications] =
    await Promise.all([
      getMyProfile(userId),
      Customer.findById(userId).select('walletBalance').lean(),
      getMyOrderCountsByEveryStatus(userId),
      Address.countDocuments({ user: userId }),
      Cart.findOne({ user: userId }).select('items').lean(),
      Wishlist.findOne({ user: userId }).select('items').lean(),
      CouponRedemption.countDocuments({ userId }),
      Ticket.countDocuments({ user: userId, isDeleted: { $ne: true } }),
      ReturnRequest.countDocuments({ user: userId }),
      Review.countDocuments({ user: userId }),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

  if (!profile.found) return { found: false };

  return {
    found: true,
    profile: {
      name: profile.name,
      email: profile.email,
      mobileNumber: profile.mobileNumber,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      memberSince: profile.memberSince,
    },
    wallet: { balance: wallet?.walletBalance ?? 0, currency: 'INR' },
    orders: orderCounts,
    savedAddresses: addresses,
    cartItems: (cart?.items || []).length,
    wishlistItems: (wishlist?.items || []).length,
    couponsUsed: coupons,
    supportTickets: tickets,
    returnRequests: returns,
    reviewsWritten: reviews,
    unreadNotifications,
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
    name: 'getMyAccountOverview',
    description:
      'A complete A-to-Z snapshot of the signed-in customer in one call: their profile details, wallet balance, order counts by status, and how many addresses, cart items, wishlist items, coupons used, support tickets, returns, reviews and unread notifications they have. USE THIS FIRST for any broad question such as "tell me about my account", "meri saari details batao", or "what do you know about me" - then call a specific tool if they want detail on one area.',
  },
  {
    name: 'getMyWallet',
    description:
      'The wallet balance in rupees for the signed-in customer, plus their recent wallet transactions (top-ups, order payments, refunds). Use for "wallet me kitna amount hai", "what is my balance", or any refund-to-wallet question.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many recent transactions to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMyAddresses',
    description:
      'The saved delivery addresses of the signed-in customer, including which one is the default.',
  },
  {
    name: 'getMyCart',
    description:
      'What is currently in the shopping cart of the signed-in customer, with quantities, prices and an items subtotal.',
  },
  {
    name: 'getMyWishlist',
    description:
      'Products the signed-in customer has saved to their wishlist, with current price and stock availability.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many items to return, 1 to 10. Defaults to 10.' },
      },
    },
  },
  {
    name: 'getMyCouponUsage',
    description:
      'Coupons the signed-in customer has actually redeemed, with the discount each one gave and the total they have saved. This does NOT list available offers - for those, point them to the Offers screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many redemptions to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMyNotifications',
    description:
      'The recent notifications for the signed-in customer and how many are unread.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many notifications to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMySupportTickets',
    description:
      'Support tickets the signed-in customer has raised, with status, category and the latest reply on each.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many tickets to return, 1 to 10. Defaults to 5.' },
      },
    },
  },
  {
    name: 'getMyReviews',
    description:
      'Product reviews and ratings the signed-in customer has written.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'How many reviews to return, 1 to 10. Defaults to 5.' },
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
  getMyAccountOverview,
  getMyProfile,
  getMyWallet,
  getMyAddresses,
  getMyCart,
  getMyWishlist,
  getMyCouponUsage,
  getMyNotifications,
  getMySupportTickets,
  getMyReviews,
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
  getMyAccountOverview,
  getMyProfile,
  getMyWallet,
  getMyAddresses,
  getMyCart,
  getMyWishlist,
  getMyCouponUsage,
  getMyNotifications,
  getMySupportTickets,
  getMyReviews,
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
