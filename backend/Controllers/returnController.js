const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const { getImageUrl } = require('../utils/imageHelper');
const { createNotification } = require('./notificationController');
const { alertAdmins } = require('../services/adminAlertService');
const { findDropshipIdsByProductIds } = require('../utils/dropship');
const { linePaidPaise, findLineIndex } = require('../utils/orderLines');

const { RETURN_WINDOW_DAYS, returnDeadline, isWithinReturnWindow } = require('../utils/returnWindow');

function serializeRequest(r) {
  return {
    id: r._id.toString(),
    orderId: r.order.toString(),
    productId: r.product.toString(),
    variantId: r.variantId ? r.variantId.toString() : null,
    productName: r.productName,
    productImage: r.productImage,
    requestType: r.requestType,
    reason: r.reason,
    photos: (r.photos || []).map(getImageUrl),
    status: r.status,
    adminNote: r.adminNote || '',
    refundAmount: r.refundAmount,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
    // Progress after approval, for the buyer's tracker.
    acceptedAt: r.acceptedAt || null,
    pickupMode: r.pickupMode || null,
    itemReceivedAt: r.itemReceivedAt || null,
    completedAt: r.completedAt || null,
    refundDestination: r.refundDestination || null,
    replacementOrderId: r.replacementOrder ? r.replacementOrder.toString() : null,
  };
}

function lineKey(orderId, productId, variantId) {
  return `${orderId}:${productId}:${variantId || ''}`;
}

// GET /user/returns/returnable — every order line from this user's DELIVERED
// orders, each flagged with any existing return request on it (unlike
// reviews, NOT deduped by product — the same product bought across two
// separate orders is independently returnable, and so are two variants of it
// in one order).
//
// Dropshipping lines are left out entirely: they cannot be returned
// (business rule, 2026-09), and listing them only to refuse them later is
// worse than not offering them.
async function getReturnableItems(req, res) {
  const orders = await Order.find({ user: req.user._id, status: 'DELIVERED' }).sort({ deliveredAt: -1 });

  const orderIds = orders.map((o) => o._id);
  const requests = await ReturnRequest.find({ user: req.user._id, order: { $in: orderIds } });
  const requestByKey = new Map(
    requests.map((r) => [lineKey(r.order.toString(), r.product.toString(), r.variantId && r.variantId.toString()), r])
  );
  const dropshipIds = await findDropshipIdsByProductIds(orders.flatMap((o) => o.items.map((item) => item.product)));

  const items = [];
  for (const order of orders) {
    if (order.fulfillmentType === 'DROPSHIP') continue;
    for (const item of order.items) {
      if (dropshipIds.has(item.product.toString())) continue;
      // The seller/admin marked this product non-returnable when it was bought.
      if (item.returnable === false) continue;
      const variantId = item.variantId ? item.variantId.toString() : null;
      const existing = requestByKey.get(lineKey(order._id.toString(), item.product.toString(), variantId));
      items.push({
        orderId: order._id.toString(),
        productId: item.product.toString(),
        variantId,
        variant: item.variant || '',
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        deliveredAt: order.deliveredAt || order.updatedAt || order.createdAt,
        returnEligible: isWithinReturnWindow(order.deliveredAt, order.updatedAt || order.createdAt),
        returnWindowExpiresAt: returnDeadline(order.deliveredAt, order.updatedAt || order.createdAt),
        existingRequest: existing
          ? { id: existing._id.toString(), status: existing.status, requestType: existing.requestType }
          : null,
      });
    }
  }

  res.json({ success: true, data: { items } });
}

async function createReturnRequest(req, res) {
  const { orderId, productId, requestType, reason } = req.body;

  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid order or product id' });
  }
  if (!ReturnRequest.REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({ success: false, message: 'Select a valid request type' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required' });
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id, status: 'DELIVERED' });
  if (!order) {
    return res.status(403).json({ success: false, message: 'You can only request returns on delivered orders' });
  }
  if (!isWithinReturnWindow(order.deliveredAt, order.updatedAt || order.createdAt)) {
    return res.status(400).json({
      success: false,
      message: `The ${RETURN_WINDOW_DAYS}-day return window for this order has expired`,
    });
  }

  const variantId = req.body.variantId && mongoose.isValidObjectId(req.body.variantId) ? req.body.variantId : null;
  const lineIndex = findLineIndex(order, productId, variantId);
  if (lineIndex < 0) {
    const onOrder = order.items.some((item) => item.product.toString() === productId);
    return res.status(onOrder ? 400 : 403).json({
      success: false,
      message: onOrder
        ? 'Choose which option of this product you want to return'
        : 'This product was not part of that order',
    });
  }
  const orderItem = order.items[lineIndex];

  const dropship = await findDropshipIdsByProductIds([orderItem.product]);
  if (order.fulfillmentType === 'DROPSHIP' || dropship.size > 0) {
    return res.status(403).json({
      success: false,
      code: 'DROPSHIP_NOT_RETURNABLE',
      message: 'Dropshipping items cannot be returned or replaced.',
    });
  }

  if (orderItem.returnable === false) {
    return res.status(403).json({
      success: false,
      code: 'NOT_RETURNABLE',
      message: 'This product is not eligible for return or replacement.',
    });
  }

  // A replacement order carried no money, so there is nothing to refund.
  if (order.replacementFor && requestType === 'REFUND') {
    return res.status(400).json({
      success: false,
      code: 'REPLACEMENT_NOT_REFUNDABLE',
      message: 'This was a free replacement. Request another replacement instead.',
    });
  }

  // One request per line: an open one is being handled, and a completed one
  // has already been refunded or replaced. The unique index only covers
  // PENDING, so the later states are checked here.
  const blocking = await ReturnRequest.findOne({
    order: order._id,
    product: orderItem.product,
    variantId: orderItem.variantId || null,
    status: { $in: ReturnRequest.BLOCKING_STATUSES },
  }).select('status');
  if (blocking) {
    return res.status(400).json({
      success: false,
      message:
        blocking.status === 'APPROVED'
          ? 'This item has already been returned.'
          : 'A request is already pending for this item',
    });
  }

  const photoUrls = (req.files || []).map((file) => file.url);

  try {
    const request = await ReturnRequest.create({
      user: req.user._id,
      order: orderId,
      product: productId,
      variantId: orderItem.variantId || null,
      productName: orderItem.name,
      productImage: orderItem.image,
      requestType,
      reason: reason.trim(),
      photos: photoUrls,
      // What the buyer actually paid for this line: its coupon share comes
      // off. Refunding the list price paid back money that was never paid.
      refundAmount: linePaidPaise(order, lineIndex) / 100,
    });

    if (orderItem.vendor) {
      await createNotification({
        vendorId: orderItem.vendor,
        type: 'ORDER',
        title: requestType === 'REFUND' ? 'Refund Requested' : 'Replacement Requested',
        message: `A customer requested a ${requestType.toLowerCase()} for "${orderItem.name}".`,
        actionType: 'ORDER',
        actionRefId: order._id,
      });
    }

    await alertAdmins({
      event: 'RETURN_REQUESTED',
      title: requestType === 'REFUND' ? 'New refund request' : 'New replacement request',
      message: `"${orderItem.name}" on ORD-${String(order._id).slice(-8).toUpperCase()} — ₹${request.refundAmount.toLocaleString('en-IN')}. Reason: ${reason.trim().slice(0, 120)}`,
      link: `/admin/orders/returns/${request._id}`,
      key: `RETURN_REQUESTED:${request._id}`,
    });

    res.status(201).json({ success: true, message: 'Return request submitted', data: serializeRequest(request) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A request is already pending for this item' });
    }
    throw err;
  }
}

async function listMyReturnRequests(req, res) {
  const requests = await ReturnRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { items: requests.map(serializeRequest) } });
}

module.exports = { getReturnableItems, createReturnRequest, listMyReturnRequests, serializeRequest };
