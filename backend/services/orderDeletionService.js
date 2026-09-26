// Deleting an order or a parcel — for test and cancelled orders only.
//
// An order is a financial and legal record: its GST invoice, its ledger rows
// and any wallet movement must survive. So deletion is allowed only when
// nothing of that exists: the order is CANCELLED, no money was ever taken or
// refunded for it, nothing was posted to the ledger, and no CJ order or
// courier parcel is still live for it. Everything else is refused with the
// reason, and the order stays exactly as it was.
//
// Routes are super-admin only; every call is recorded by the admin audit
// middleware.
const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Shipment = require('../Models/Shipment');
const TrackingEvent = require('../Models/TrackingEvent');
const ReturnRequest = require('../Models/ReturnRequest');
const Notification = require('../Models/Notification');
const WalletTransaction = require('../Models/WalletTransaction');
const AccountingTransaction = require('../Models/AccountingTransaction');
const CjOrder = require('../Models/CjOrder');
const CjShipment = require('../Models/CjShipment');

// Parcels that are finished at the carrier, or never reached it.
const DELETABLE_SHIPMENT_STATUSES = ['CANCELLED', 'CANCEL_REQUESTED', 'FAILED', 'PENDING', 'READY_TO_SHIP', 'SERVICEABILITY_CHECKED'];

function fail(status, message, code) {
  return { ok: false, status, message, code };
}

function sentToCarrier(shipment) {
  return Boolean(shipment.shiprocketOrderId || shipment.shiprocketShipmentId || shipment.awbCode);
}

// Why this order may not be deleted, or null when it may.
async function blockerFor(order) {
  if (order.status !== 'CANCELLED') {
    return fail(409, 'Only a cancelled order can be deleted. Cancel it first.', 'NOT_CANCELLED');
  }
  if (['PAID', 'REFUNDED'].includes(order.paymentStatus)) {
    return fail(409, 'Money was taken for this order, so it is kept for the accounts. Only unpaid (test or COD) orders can be deleted.', 'MONEY_MOVED');
  }
  if (await WalletTransaction.exists({ orderId: order._id })) {
    return fail(409, 'This order moved wallet money, so it is kept for the accounts.', 'MONEY_MOVED');
  }
  if (await AccountingTransaction.exists({ order: order._id })) {
    return fail(409, 'This order is on the accounting ledger, so it is kept.', 'ON_LEDGER');
  }
  const cjOrder = await CjOrder.findOne({ krozendaOrderId: order._id }).select('cjOrderId status').lean();
  if (cjOrder?.cjOrderId && cjOrder.status !== 'CANCELLED') {
    return fail(409, 'This order is still live at CJ Dropshipping. Cancel it there first.', 'CJ_LIVE');
  }
  return null;
}

/**
 * Delete a cancelled, never-paid order and everything hanging off it.
 * A parcel still open at Shiprocket is cancelled there first; one the courier
 * already has stops the deletion.
 */
async function deleteOrder({ orderId }) {
  if (!mongoose.isValidObjectId(orderId)) return fail(400, 'Invalid order id');
  const order = await Order.findById(orderId).lean();
  if (!order) return fail(404, 'Order not found');

  const blocked = await blockerFor(order);
  if (blocked) return blocked;

  const shipments = await Shipment.find({ order: order._id });
  for (const shipment of shipments) {
    if (DELETABLE_SHIPMENT_STATUSES.includes(shipment.internalStatus) || !sentToCarrier(shipment)) continue;
    // Lazy: the carrier client loads config this module does not need.
    const result = await require('./shipping/shipmentService').cancelShipment({
      shipmentId: shipment._id,
      reason: 'Order deleted by admin',
      actor: 'ADMIN',
    });
    if (!result.ok) {
      return fail(409, `Its Shiprocket parcel could not be cancelled (${result.message}). Resolve it in Shiprocket, then delete.`, 'SHIPMENT_LIVE');
    }
  }

  const shipmentIds = shipments.map((s) => s._id);
  const cjOrders = await CjOrder.find({ krozendaOrderId: order._id }).select('_id').lean();
  await Promise.all([
    TrackingEvent.deleteMany({ shipment: { $in: shipmentIds } }),
    Shipment.deleteMany({ _id: { $in: shipmentIds } }),
    ReturnRequest.deleteMany({ order: order._id }),
    Notification.deleteMany({ actionRefId: order._id }),
    CjShipment.deleteMany({ cjOrder: { $in: cjOrders.map((c) => c._id) } }),
    CjOrder.deleteMany({ krozendaOrderId: order._id }),
  ]);
  await Order.deleteOne({ _id: order._id });

  return { ok: true, deleted: { order: String(order._id), shipments: shipmentIds.length } };
}

/**
 * Delete one parcel record — only one that is finished at the carrier
 * (cancelled / failed) or never reached it. The order is untouched.
 */
async function deleteShipment({ shipmentId }) {
  if (!mongoose.isValidObjectId(shipmentId)) return fail(400, 'Invalid shipment id');
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) return fail(404, 'Shipment not found');

  if (!DELETABLE_SHIPMENT_STATUSES.includes(shipment.internalStatus) && sentToCarrier(shipment)) {
    return fail(409, 'This parcel is live at Shiprocket. Cancel it first; a cancelled parcel can then be deleted.', 'SHIPMENT_LIVE');
  }
  if (await ReturnRequest.exists({ returnShipment: shipment._id, status: { $in: ['PENDING', 'ACCEPTED'] } })) {
    return fail(409, 'This is the pickup for an open return. Finish or reject the return first.', 'RETURN_OPEN');
  }

  await TrackingEvent.deleteMany({ shipment: shipment._id });
  await Shipment.deleteOne({ _id: shipment._id });
  return { ok: true, deleted: { shipment: String(shipment._id) } };
}

module.exports = { deleteOrder, deleteShipment, blockerFor, DELETABLE_SHIPMENT_STATUSES };
