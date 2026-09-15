const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const { getImageUrl } = require('../utils/imageHelper');
const { createNotification } = require('./notificationController');

// Standard e-commerce return window — no such rule existed before, so a
// return could be filed against a delivery from years ago. 7 days is a
// reasonable default; tune here if the business wants a different policy.
const RETURN_WINDOW_DAYS = 7;

function returnDeadline(deliveredAt) {
  if (!deliveredAt) return null;
  return new Date(new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function isWithinReturnWindow(deliveredAt) {
  const deadline = returnDeadline(deliveredAt);
  return Boolean(deadline) && Date.now() <= deadline.getTime();
}

function serializeRequest(r) {
  return {
    id: r._id.toString(),
    orderId: r.order.toString(),
    productId: r.product.toString(),
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
  };
}

// GET /user/returns/returnable — every (order, product) line item from this
// user's DELIVERED orders, each flagged with any existing return request on
// it (unlike reviews, NOT deduped by product — the same product bought
// across two separate orders is independently returnable).
async function getReturnableItems(req, res) {
  const orders = await Order.find({ user: req.user._id, status: 'DELIVERED' }).sort({ deliveredAt: -1 });

  const orderIds = orders.map((o) => o._id);
  const requests = await ReturnRequest.find({ user: req.user._id, order: { $in: orderIds } });
  const requestByKey = new Map(requests.map((r) => [`${r.order.toString()}:${r.product.toString()}`, r]));

  const items = [];
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${order._id.toString()}:${item.product.toString()}`;
      const existing = requestByKey.get(key);
      items.push({
        orderId: order._id.toString(),
        productId: item.product.toString(),
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        deliveredAt: order.deliveredAt,
        returnEligible: isWithinReturnWindow(order.deliveredAt),
        returnWindowExpiresAt: returnDeadline(order.deliveredAt),
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
  if (!isWithinReturnWindow(order.deliveredAt)) {
    return res.status(400).json({
      success: false,
      message: `The ${RETURN_WINDOW_DAYS}-day return window for this order has expired`,
    });
  }

  const orderItem = order.items.find((item) => item.product.toString() === productId);
  if (!orderItem) {
    return res.status(403).json({ success: false, message: 'This product was not part of that order' });
  }

  const photoUrls = (req.files || []).map((file) => file.url);

  try {
    const request = await ReturnRequest.create({
      user: req.user._id,
      order: orderId,
      product: productId,
      productName: orderItem.name,
      productImage: orderItem.image,
      requestType,
      reason: reason.trim(),
      photos: photoUrls,
      refundAmount: orderItem.price * orderItem.quantity,
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
