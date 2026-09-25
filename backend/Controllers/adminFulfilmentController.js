const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Rto = require('../Models/Rto');
const { toPaise } = require('../utils/money');
const { releaseStock } = require('./orderController');
const { cancelLine, claimCancelledOrderRefund } = require('../services/orderCancellationService');
const { createNotification } = require('./notificationController');

function vendorLabel(v) {
  return v?.business?.businessName || v?.name || 'Krozenda (platform)';
}

function paged(items, { page = 1, rowsPerPage = 25 } = {}, tabCounts) {
  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: currentPage, rowsPerPage: perPage, totalItems, totalPages, tabCounts };
}

// ---------------------------------------------------------------------------
// Sub-orders — one row per (order, line item). "model" is the line's channel,
// the same three the dashboard and Revenue screen use: a CJ (DROPSHIP) order
// is CJ Dropshipping, a seller's line is Sellers, anything else is Own stock.
// ---------------------------------------------------------------------------

function ageHours(date) {
  return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60)));
}

function serializeSubOrder(order, item) {
  return {
    // The variant is part of the id: two colours of one product are two
    // sub-orders, and cancelling one must not reach the other.
    id: `${order._id}:${item.product}:${item.variantId || ''}`,
    orderId: order._id.toString(),
    placedAt: order.createdAt,
    model: order.fulfillmentType === 'DROPSHIP' ? 'dropshipping' : item.vendorDoc ? 'marketplace' : 'own_stock',
    seller: vendorLabel(item.vendorDoc),
    buyer: order.user?.name || '',
    status: item.status,
    awb: item.trackingNumber || null,
    ageHours: ageHours(order.createdAt),
    total: toPaise(item.price * item.quantity),
  };
}

async function listSubOrders(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const orders = await Order.find({ 'items.0': { $exists: true } })
    .populate('user', 'name')
    .populate('items.vendor', 'name business.businessName')
    .sort({ createdAt: -1 })
    .lean();

  const allSerialized = [];
  for (const order of orders) {
    for (const item of order.items) {
      allSerialized.push(serializeSubOrder(order, { ...item, vendorDoc: item.vendor }));
    }
  }

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((s) => s.orderId.includes(term) || s.seller.toLowerCase().includes(term) || s.buyer.toLowerCase().includes(term));
  }

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'awaiting') items = items.filter((s) => s.status === 'PENDING');
  else if (effectiveTab === 'in_flight') items = items.filter((s) => s.status === 'PROCESSING' || s.status === 'SHIPPED');
  else if (effectiveTab === 'exceptions') items = items.filter((s) => s.status === 'CANCELLED');
  else if (effectiveTab === 'delivered') items = items.filter((s) => s.status === 'DELIVERED');

  const tabCounts = {
    all: allSerialized.length,
    awaiting: allSerialized.filter((s) => s.status === 'PENDING').length,
    in_flight: allSerialized.filter((s) => s.status === 'PROCESSING' || s.status === 'SHIPPED').length,
    exceptions: allSerialized.filter((s) => s.status === 'CANCELLED').length,
    delivered: allSerialized.filter((s) => s.status === 'DELIVERED').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

// `<order>:<product>[:<variant>]`. Ids issued before the variant was added
// still parse, and match the product's first line.
function parseSubOrderId(id) {
  const [orderId, productId, variantId] = String(id).split(':');
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId)) return null;
  if (variantId && !mongoose.isValidObjectId(variantId)) return null;
  return { orderId, productId, variantId: variantId || null };
}

function findSubOrderIndex(order, { productId, variantId }) {
  return order.items.findIndex(
    (i) =>
      i.product.toString() === productId &&
      (variantId ? String(i.variantId) === variantId : true)
  );
}

const NEXT_STATUS = { PENDING: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED' };

async function advanceSubOrder(req, res) {
  const parsed = parseSubOrderId(req.params.id);
  if (!parsed) return res.status(400).json({ success: false, message: 'Invalid sub-order id' });
  const { awb } = req.body;

  const order = await Order.findById(parsed.orderId).populate('user', 'name').populate('items.vendor', 'name business.businessName');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  const item = order.items[findSubOrderIndex(order, parsed)];
  if (!item) return res.status(404).json({ success: false, message: 'Sub-order not found' });

  const next = NEXT_STATUS[item.status];
  if (!next) return res.status(400).json({ success: false, message: `Cannot advance a sub-order that is ${item.status}` });

  item.status = next;
  if (awb) item.trackingNumber = awb;
  item.statusHistory.push({ status: next, at: new Date() });
  await order.save();

  res.json({ success: true, message: `Advanced to ${next}`, data: serializeSubOrder(order, { ...item.toObject(), vendorDoc: item.vendor }) });
}

async function cancelSubOrder(req, res) {
  const parsed = parseSubOrderId(req.params.id);
  if (!parsed) return res.status(400).json({ success: false, message: 'Invalid sub-order id' });
  const { reason } = req.body;

  const existing = await Order.findById(parsed.orderId);
  if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });
  const lineIndex = findSubOrderIndex(existing, parsed);
  if (lineIndex < 0) return res.status(404).json({ success: false, message: 'Sub-order not found' });

  // Cancels the line atomically, puts its stock back AND refunds the buyer
  // what they paid for it — the refund used to be missing entirely.
  const result = await cancelLine({ orderId: existing._id, lineIndex, cancelledBy: 'admin', reason });
  if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

  const order = await Order.findById(existing._id).populate('user', 'name').populate('items.vendor', 'name business.businessName');
  const item = order.items[lineIndex];

  await createNotification({
    userId: order.user._id,
    type: 'ORDER',
    title: 'Item Cancelled',
    message: `"${item.name}" from your order was cancelled.${reason ? ` Reason: ${reason}` : ''}${
      result.refunded > 0 ? ` ₹${result.refunded.toLocaleString('en-IN')} has been refunded to your wallet.` : ''
    }`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  res.json({ success: true, message: 'Sub-order cancelled', data: serializeSubOrder(order, { ...item.toObject(), vendorDoc: item.vendor }) });
}

// ---------------------------------------------------------------------------
// Shipments — sub-orders that have a tracking number (item.status SHIPPED or
// beyond). No live courier API exists, so "lastEvent"/"isLate" are derived
// from what's on the order, not a real tracking feed.
// ---------------------------------------------------------------------------

function serializeShipment(order, item) {
  const isLate = item.status === 'SHIPPED' && ageHours(order.updatedAt) > 96;
  return {
    id: `${order._id}:${item.product}:${item.variantId || ''}`,
    subOrderId: `${order._id.toString().slice(-8).toUpperCase()}`,
    awb: item.trackingNumber || '',
    courier: item.courierName || 'Unassigned',
    seller: vendorLabel(item.vendorDoc),
    pickupPincode: '',
    dropPincode: order.shippingAddress?.pincode || '',
    status: item.status,
    lastEvent: item.status === 'DELIVERED' ? 'Delivered' : item.status === 'SHIPPED' ? 'In transit' : 'Processing',
    lastEventAt: order.updatedAt,
    promisedBy: '',
    isLate,
  };
}

async function listShipments(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const orders = await Order.find({ 'items.trackingNumber': { $ne: '' } })
    .populate('items.vendor', 'name business.businessName')
    .sort({ updatedAt: -1 })
    .lean();

  const allSerialized = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.trackingNumber) continue;
      allSerialized.push(serializeShipment(order, { ...item, vendorDoc: item.vendor }));
    }
  }

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) items = items.filter((s) => s.awb.toLowerCase().includes(term) || s.seller.toLowerCase().includes(term));

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'in_transit') items = items.filter((s) => s.status === 'SHIPPED');
  else if (effectiveTab === 'late') items = items.filter((s) => s.isLate);
  else if (effectiveTab === 'exception') items = items.filter((s) => s.status === 'CANCELLED');
  else if (effectiveTab === 'delivered') items = items.filter((s) => s.status === 'DELIVERED');

  const tabCounts = {
    all: allSerialized.length,
    in_transit: allSerialized.filter((s) => s.status === 'SHIPPED').length,
    late: allSerialized.filter((s) => s.isLate).length,
    exception: allSerialized.filter((s) => s.status === 'CANCELLED').length,
    delivered: allSerialized.filter((s) => s.status === 'DELIVERED').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function updateShipment(req, res) {
  const parsed = parseSubOrderId(req.params.id);
  if (!parsed) return res.status(400).json({ success: false, message: 'Invalid shipment id' });
  const { status, lastEvent } = req.body;

  const order = await Order.findById(parsed.orderId).populate('items.vendor', 'name business.businessName');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  const item = order.items[findSubOrderIndex(order, parsed)];
  if (!item) return res.status(404).json({ success: false, message: 'Shipment not found' });

  if (status && Order.STATUSES.includes(status)) {
    item.status = status;
    item.statusHistory.push({ status, at: new Date() });
  }
  if (lastEvent) item.courierName = item.courierName || lastEvent;
  await order.save();

  res.json({ success: true, message: 'Shipment updated', data: serializeShipment(order, { ...item.toObject(), vendorDoc: item.vendor }) });
}

// ---------------------------------------------------------------------------
// RTO
// ---------------------------------------------------------------------------

function serializeRto(r) {
  return {
    id: r._id.toString(),
    subOrderId: `${r.order.toString().slice(-8).toUpperCase()}`,
    awb: r.awb || '',
    seller: vendorLabel(r.vendor),
    reason: r.reason,
    initiatedAt: r.initiatedAt,
    costBearer: r.costBearer,
    shippingCost: toPaise(r.shippingCost || 0),
    orderValue: toPaise(r.orderValue || 0),
    settlementReversed: r.settlementReversed,
    stockRestored: r.stockRestored,
  };
}

async function listRtos(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const rows = await Rto.find().populate('vendor', 'name business.businessName').sort({ createdAt: -1 }).lean();
  const allSerialized = rows.map(serializeRto);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) items = items.filter((r) => r.awb.toLowerCase().includes(term) || r.seller.toLowerCase().includes(term));

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'open') items = items.filter((r) => !r.stockRestored || !r.settlementReversed);
  else if (effectiveTab === 'vendor_bears') items = items.filter((r) => r.costBearer === 'vendor');
  else if (effectiveTab === 'platform_bears') items = items.filter((r) => r.costBearer === 'platform');

  const tabCounts = {
    all: allSerialized.length,
    open: allSerialized.filter((r) => !r.stockRestored || !r.settlementReversed).length,
    vendor_bears: allSerialized.filter((r) => r.costBearer === 'vendor').length,
    platform_bears: allSerialized.filter((r) => r.costBearer === 'platform').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function restockRto(req, res) {
  const { id } = req.params;
  const rto = await Rto.findById(id).populate('vendor', 'name business.businessName');
  if (!rto) return res.status(404).json({ success: false, message: 'RTO not found' });
  if (rto.stockRestored) return res.status(400).json({ success: false, message: 'Stock was already restored for this RTO' });

  // Credited to the variant that shipped when there is one — see the note on
  // Rto.variantId.
  if (rto.variantId) {
    await Product.updateOne(
      { _id: rto.product, 'variants._id': rto.variantId },
      { $inc: { 'variants.$.stock': 1 } }
    );
  } else {
    await Product.updateOne({ _id: rto.product }, { $inc: { stock: 1 } });
  }
  rto.stockRestored = true;
  await rto.save();

  res.json({ success: true, message: 'Stock restored', data: serializeRto(rto) });
}

// ---------------------------------------------------------------------------
// Cancellations — whole-order cancellations only (see Order.cancelledBy);
// per-item sub-order cancellations show up in Sub-orders > Exceptions instead.
// ---------------------------------------------------------------------------

function serializeCancellation(o) {
  return {
    id: o._id.toString(),
    subOrderId: `${o._id.toString().slice(-8).toUpperCase()}`,
    orderId: o._id.toString(),
    cancelledBy: o.cancelledBy || 'buyer',
    actor: o.cancelledBy === 'admin' ? 'Admin' : o.user?.name || 'Buyer',
    reason: o.cancelledBy === 'admin' ? 'Cancelled by admin' : 'Cancelled by buyer',
    cancelledAt: o.updatedAt,
    refundStatus: o.paymentStatus === 'REFUNDED' ? 'completed' : o.paymentMethod === 'COD' ? 'not_required' : 'pending',
    refundAmount: toPaise(o.paymentStatus === 'REFUNDED' ? o.total : 0),
  };
}

async function listCancellations(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const orders = await Order.find({ status: 'CANCELLED' }).populate('user', 'name').sort({ updatedAt: -1 }).lean();
  const allSerialized = orders.map(serializeCancellation);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) items = items.filter((c) => c.subOrderId.toLowerCase().includes(term) || c.actor.toLowerCase().includes(term));

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'refund_open') items = items.filter((c) => c.refundStatus === 'pending' || c.refundStatus === 'processing');
  else if (effectiveTab === 'buyer') items = items.filter((c) => c.cancelledBy === 'buyer');
  else if (effectiveTab === 'vendor') items = items.filter((c) => c.cancelledBy === 'vendor');
  else if (effectiveTab === 'admin') items = items.filter((c) => c.cancelledBy === 'admin');

  const tabCounts = {
    all: allSerialized.length,
    refund_open: allSerialized.filter((c) => c.refundStatus === 'pending' || c.refundStatus === 'processing').length,
    buyer: allSerialized.filter((c) => c.cancelledBy === 'buyer').length,
    vendor: allSerialized.filter((c) => c.cancelledBy === 'vendor').length,
    admin: allSerialized.filter((c) => c.cancelledBy === 'admin').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function resolveCancellationRefund(req, res) {
  const { id } = req.params;
  const order = await Order.findById(id).populate('user', 'name');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.status !== 'CANCELLED') return res.status(400).json({ success: false, message: 'Order is not cancelled' });
  if (order.paymentStatus === 'REFUNDED' || order.paymentMethod === 'COD') {
    return res.json({ success: true, message: 'Nothing to refund', data: serializeCancellation(order) });
  }

  // A dropship order goes back to the original payment, not the wallet — the
  // wallet cannot buy dropship items. Its automatic refund may have failed;
  // this retries it.
  const { isDropshipOrder } = require('../utils/dropship');
  if (await isDropshipOrder(order)) {
    const result = await require('../services/dropshipOrderService').retryRefund({ orderId: order._id });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    const refreshed = await Order.findById(order._id).populate('user', 'name');
    return res.json({ success: true, message: 'Refund sent to the original payment method', data: serializeCancellation(refreshed) });
  }

  // Claimed atomically before paying: two clicks used to credit the wallet
  // twice, because nothing stopped the second one.
  const amount = await claimCancelledOrderRefund(order._id);
  const refreshed = await Order.findById(order._id).populate('user', 'name');

  res.json({
    success: true,
    message: amount > 0 ? 'Refund credited to wallet' : 'Nothing to refund',
    data: serializeCancellation(refreshed),
  });
}

module.exports = {
  listSubOrders,
  advanceSubOrder,
  cancelSubOrder,
  listShipments,
  updateShipment,
  listRtos,
  restockRto,
  listCancellations,
  resolveCancellationRefund,
};
