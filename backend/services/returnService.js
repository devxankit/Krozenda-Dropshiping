// The return lifecycle after the buyer raises a request.
//
//   PENDING --accept--> ACCEPTED --item back + complete--> APPROVED
//      |                    |
//      +------reject--------+-------------------------> REJECTED
//
// Accepting books the reverse pickup (when the item came by courier) and moves
// no money. Completing happens once the item is back — or straight away when
// nothing has to come back (a missing item) — and is where the refund is paid
// or the replacement order is created, and the units optionally restocked.
//
// Every transition is a status-guarded findOneAndUpdate, so a double click can
// only win once.
const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Shipment = require('../Models/Shipment');
const { createNotification } = require('../Controllers/notificationController');
const { findLineIndex } = require('../utils/orderLines');

function fail(status, message, extra = {}) {
  return { ok: false, status, message, ...extra };
}

async function notifyBuyer(request, title, message) {
  try {
    await createNotification({
      userId: request.user?._id || request.user,
      type: 'ORDER',
      title,
      message,
      actionType: 'ORDER',
      actionRefId: request.order?._id || request.order,
    });
  } catch (err) {
    console.error('[returnService] buyer notification failed', { requestId: String(request._id), error: err.message });
  }
}

// The order line a request is about, with its quantity.
async function loadLine(request) {
  const order = await Order.findById(request.order?._id || request.order);
  if (!order) return { order: null, item: null };
  let index = findLineIndex(order, request.product, request.variantId);
  if (index < 0) index = order.items.findIndex((item) => String(item.product) === String(request.product));
  return { order, item: index >= 0 ? order.items[index] : null };
}

// Book the courier to collect the item, when it went out as a courier parcel
// we can reverse. Anything else — delivered by hand, or the carrier refusing —
// leaves the pickup to admin, with the reason kept for the screen.
async function bookPickup(request, item) {
  const forward = await Shipment.findOne({
    order: request.order,
    shipmentType: 'FORWARD',
    internalStatus: 'DELIVERED',
    'items.product': request.product,
  }).select('_id');
  if (!forward) {
    return { pickupMode: 'MANUAL', pickupError: 'This item was not delivered through a courier booking, so collect it by hand.' };
  }

  // Lazy: shipmentService pulls in the carrier client and its config.
  const shipmentService = require('./shipping/shipmentService');
  try {
    const result = await shipmentService.createReturnShipment({
      shipmentId: forward._id,
      reason: request.reason,
      items: [{ productId: String(request.product), quantity: item?.quantity || 1 }],
      actor: 'ADMIN',
    });
    if (result.ok) {
      return { pickupMode: 'COURIER', returnShipment: result.shipment._id, pickupError: '' };
    }
    return { pickupMode: 'MANUAL', returnShipment: result.shipment?._id || null, pickupError: result.message || 'The courier could not book the pickup.' };
  } catch (err) {
    return { pickupMode: 'MANUAL', pickupError: `The courier could not book the pickup: ${err.message}` };
  }
}

/**
 * Approve a PENDING request. `requireItemBack: false` (nothing to send back —
 * a missing item) completes it immediately.
 */
async function acceptReturn({ requestId, admin = null, note = '', requireItemBack = true, restock = false }) {
  if (!mongoose.isValidObjectId(requestId)) return fail(400, 'Invalid return id');

  const request = await ReturnRequest.findOneAndUpdate(
    { _id: requestId, status: 'PENDING' },
    {
      $set: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        adminNote: String(note || '').trim(),
        pickupMode: requireItemBack ? null : 'NOT_REQUIRED',
      },
    },
    { new: true }
  ).populate('user', 'name');
  if (!request) {
    const exists = await ReturnRequest.exists({ _id: requestId });
    return fail(exists ? 409 : 404, exists ? 'This request has already been decided' : 'Return request not found');
  }

  if (!requireItemBack) {
    return completeReturn({ requestId, admin, restock });
  }

  const { item } = await loadLine(request);
  const pickup = await bookPickup(request, item);
  Object.assign(request, pickup);
  await request.save();

  await notifyBuyer(
    request,
    'Return Approved',
    pickup.pickupMode === 'COURIER'
      ? `Your return for ${request.productName} is approved. A courier will collect it — keep it packed.`
      : `Your return for ${request.productName} is approved. Our team will contact you to collect it.`
  );
  return { ok: true, request };
}

/** Refuse a request — before the item comes back, or after it fails inspection. */
async function rejectReturn({ requestId, admin = null, reason = '' }) {
  if (!mongoose.isValidObjectId(requestId)) return fail(400, 'Invalid return id');
  const note = String(reason || '').trim();
  if (!note) return fail(400, 'Give a reason for rejecting — it is sent to the buyer');

  const request = await ReturnRequest.findOneAndUpdate(
    { _id: requestId, status: { $in: ['PENDING', 'ACCEPTED'] }, completing: { $ne: true } },
    { $set: { status: 'REJECTED', adminNote: note, resolvedAt: new Date() } },
    { new: true }
  ).populate('user', 'name');
  if (!request) {
    const exists = await ReturnRequest.exists({ _id: requestId });
    return fail(exists ? 409 : 404, exists ? 'This request has already been decided' : 'Return request not found');
  }

  await notifyBuyer(request, 'Return Request Rejected', `Your return request for ${request.productName} was rejected. Reason: ${note}`);
  return { ok: true, request, adminId: admin?._id || null };
}

/** The item is back at the warehouse — from the courier's delivery scan, or admin. */
async function markItemReceived({ requestId }) {
  if (!mongoose.isValidObjectId(requestId)) return fail(400, 'Invalid return id');
  const request = await ReturnRequest.findOneAndUpdate(
    { _id: requestId, status: 'ACCEPTED', itemReceivedAt: null },
    { $set: { itemReceivedAt: new Date() } },
    { new: true }
  );
  if (!request) {
    const current = await ReturnRequest.findById(requestId).select('status itemReceivedAt').lean();
    if (!current) return fail(404, 'Return request not found');
    if (current.itemReceivedAt) return { ok: true, request: await ReturnRequest.findById(requestId), alreadyReceived: true };
    return fail(409, 'Only an approved return waiting for its item can be marked received');
  }
  return { ok: true, request };
}

// Called from the Shipment save hook when a reverse parcel is delivered back.
async function onReturnShipmentDelivered(shipmentId) {
  const request = await ReturnRequest.findOne({ returnShipment: shipmentId, status: 'ACCEPTED', itemReceivedAt: null }).select('_id');
  if (request) await markItemReceived({ requestId: request._id });
}

async function restockLine(item) {
  if (item.variantId) {
    await Product.updateOne({ _id: item.product, 'variants._id': item.variantId }, { $inc: { 'variants.$.stock': item.quantity } });
  } else {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
  }
}

// A zero-value order for the same line, so the seller ships it like any other
// order. Stock is taken atomically; no stock, no replacement.
async function createReplacementOrder(request, order, item) {
  const reserved = item.variantId
    ? await Product.findOneAndUpdate(
        { _id: item.product, variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } } },
        { $inc: { 'variants.$.stock': -item.quantity } }
      )
    : await Product.findOneAndUpdate({ _id: item.product, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });
  if (!reserved) {
    return fail(409, `"${item.name}" is out of stock, so a replacement cannot be sent. Refund the buyer instead, or restock first.`);
  }

  // Only what identifies the item — the original line's tracking, acceptance
  // and commission terms belong to the original shipment, not this one.
  const replacement = await Order.create({
    user: order.user,
    items: [
      {
        product: item.product,
        name: item.name,
        image: item.image,
        price: 0,
        listPrice: 0,
        quantity: item.quantity,
        variantId: item.variantId || null,
        variant: item.variant || '',
        variantSku: item.variantSku || '',
        priceSource: 'REPLACEMENT',
        hsnCode: item.hsnCode || '',
        gstRate: item.gstRate || 0,
        gstInclusive: item.gstInclusive !== false,
        discountAmount: 0,
        vendor: item.vendor || null,
        // Can be replaced again if it is faulty too; a REFUND on it is refused
        // in returnController, since this order carried no money.
        returnable: item.returnable !== false,
      },
    ],
    shippingAddress: order.shippingAddress,
    subtotal: 0,
    discountAmount: 0,
    shippingFee: 0,
    platformFee: 0,
    total: 0,
    paymentMethod: order.paymentMethod,
    // Nothing to collect: the buyer already paid for this item once.
    paymentStatus: 'PAID',
    fulfillmentType: order.fulfillmentType || 'STANDARD',
    replacementFor: request._id,
    status: 'PENDING',
  });

  // The seller ships it like any new order, so they hear about it the same way.
  try {
    await require('./vendorAlertService').notifyVendorsOfNewOrder({ _id: replacement._id, items: replacement.items });
  } catch (err) {
    console.error('[returnService] seller alert for replacement failed', { orderId: String(replacement._id), error: err.message });
  }
  return { ok: true, order: replacement };
}

/**
 * Finish an ACCEPTED return: pay the refund (to the original payment where
 * there is one) or create the replacement order, and restock if asked.
 */
async function completeReturn({ requestId, admin = null, restock = false }) {
  if (!mongoose.isValidObjectId(requestId)) return fail(400, 'Invalid return id');

  // Claim it, so a second click cannot pay twice.
  const request = await ReturnRequest.findOneAndUpdate(
    { _id: requestId, status: 'ACCEPTED', completing: { $ne: true } },
    { $set: { completing: true } },
    { new: true }
  ).populate('user', 'name');
  if (!request) {
    const current = await ReturnRequest.findById(requestId).select('status').lean();
    if (!current) return fail(404, 'Return request not found');
    return fail(409, current.status === 'APPROVED' ? 'This return is already completed' : 'Approve the return before completing it');
  }

  const release = () => ReturnRequest.updateOne({ _id: request._id }, { $set: { completing: false } });

  if (request.pickupMode !== 'NOT_REQUIRED' && !request.itemReceivedAt) {
    await release();
    return fail(409, 'The item has not come back yet. Mark it received first.');
  }

  const { order, item } = await loadLine(request);
  if (!order || !item) {
    await release();
    return fail(404, 'The order line for this return no longer exists');
  }

  const set = { status: 'APPROVED', completing: false, completedAt: new Date(), resolvedAt: new Date() };

  if (request.requestType === 'REFUND') {
    // Lazy: refundService lazily requires this module too.
    const { issueReturnRefund } = require('./refundService');
    const paid = await issueReturnRefund({ request, admin });
    if (!paid.ok) {
      await release();
      return paid;
    }
    set.refundDestination = paid.destination;
    set.razorpayRefundId = paid.razorpayRefundId || '';
  } else {
    const created = await createReplacementOrder(request, order, item);
    if (!created.ok) {
      await release();
      return created;
    }
    set.replacementOrder = created.order._id;
    await notifyBuyer(
      request,
      'Replacement On The Way',
      `A replacement for ${request.productName} has been ordered for you (order #${String(created.order._id).slice(-8).toUpperCase()}).`
    );
  }

  // Back into sellable stock only when admin says the item is fit to sell.
  // Never for an item that did not come back.
  if (restock && request.pickupMode !== 'NOT_REQUIRED' && !request.restocked) {
    await restockLine(item);
    set.restocked = true;
  }

  const done = await ReturnRequest.findByIdAndUpdate(request._id, { $set: set }, { new: true }).populate('user', 'name');
  return { ok: true, request: done };
}

module.exports = {
  acceptReturn,
  rejectReturn,
  markItemReceived,
  completeReturn,
  onReturnShipmentDelivered,
};
