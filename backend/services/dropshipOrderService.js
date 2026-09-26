const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const CjOrder = require('../Models/CjOrder');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const cjOrderService = require('./cj/cjOrderService');
const accounting = require('./accountingPosting');
const { resolveCjVariant } = require('./shipping/checkoutQuoteService');
const { createNotification } = require('../Controllers/notificationController');
const { releaseCoupon } = require('../Controllers/couponController');
const { toPaise } = require('../utils/money');
const { alertAdmins } = require('./adminAlertService');

// The life of a DROPSHIP (CJ-fulfilled) order after it has been paid for.
//
// Business rules this file enforces (2026-09):
//   * the buyer paid online (Razorpay) — COD and wallet are refused at checkout
//   * the buyer can neither cancel nor return it
//   * if CJ refuses the order after payment, the buyer is refunded to the
//     original payment automatically
//   * an admin may cancel it, which cancels it at CJ first and then refunds
//     the buyer to the original payment
//
// "The original payment" matters: a dropship order cannot be paid from the
// wallet, so refunding it INTO the wallet would hand the buyer money they
// cannot spend on the same thing again.

function log(entry) {
  console.log(JSON.stringify({ scope: 'DROPSHIP', at: new Date().toISOString(), ...entry }));
}

function orderLabel(id) {
  return `ORD-${String(id).slice(-8).toUpperCase()}`;
}

// A CJ order that did not go through after the buyer paid is money and goods
// in limbo — the team hears about it straight away, not from the logs.
function alertCjFailure(order, reason, { refunded }) {
  return alertAdmins({
    event: 'CJ_ORDER_FAILED',
    title: refunded ? 'CJ order failed — buyer refunded' : 'CJ order needs reconciliation',
    message: refunded
      ? `Dropship order ${orderLabel(order._id)} (₹${Number(order.total || 0).toLocaleString('en-IN')}) was not accepted by CJ: ${reason}. It was cancelled and refunded automatically.`
      : `CJ did not answer for dropship order ${orderLabel(order._id)} — it may or may not exist at CJ. Reconcile it before doing anything else.`,
    link: '/admin/cj/orders',
    key: `CJ_ORDER_FAILED:${order._id}`,
    urgent: !refunded,
  });
}

// Lazy: orderController requires this file.
function releaseStock(items) {
  return require('../Controllers/orderController').releaseStock(items);
}

/**
 * Give the coupon back, but only once EVERY order bought with it is
 * cancelled. A split checkout redeems a coupon once (against the primary
 * order) while its discount is spread over both orders — cancelling one half
 * does not un-use the coupon.
 */
async function releaseCouponIfWholeCheckoutCancelled(order) {
  if (!order?.couponCode) return null;

  const siblings = order.checkoutGroupId
    ? await Order.find({ checkoutGroupId: order.checkoutGroupId }).select('status').lean()
    : [{ _id: order._id, status: 'CANCELLED' }];
  if (siblings.some((o) => o.status !== 'CANCELLED')) return null;

  for (const sibling of siblings) {
    const released = await releaseCoupon({ orderId: sibling._id || order._id });
    if (released) return released;
  }
  return null;
}

/**
 * Refund a Razorpay-paid order to the original payment, cancel it, put the
 * stock back, reverse the ledger and tell the buyer.
 *
 * Status-guarded: the update only matches an order that is not already
 * cancelled, so two concurrent callers cannot both refund it.
 *
 * @returns {{ ok: boolean, status?: number, message?: string, order?: object }}
 */
async function refundAndCancel({ orderId, cancelledBy, reason, notify = true }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $ne: 'CANCELLED' } },
    {
      $set: { status: 'CANCELLED', cancelledBy },
      $push: { statusHistory: { status: 'CANCELLED', at: new Date() } },
    },
    { new: false }
  );
  if (!order) {
    return { ok: false, status: 409, message: 'This order is already cancelled' };
  }

  await releaseStock(order.items);

  let refunded = false;
  if (order.paymentStatus === 'PAID' && order.paymentMethod === 'RAZORPAY' && order.razorpayPaymentId) {
    try {
      // A PARTIAL refund of the shared payment when this order was split from
      // a mixed checkout: only this order's own total goes back.
      await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: toPaise(order.total),
        speed: 'optimum',
        notes: { orderId: String(order._id), reason: String(reason || '').slice(0, 250) },
      });
      refunded = true;
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });
    } catch (err) {
      // The order is cancelled either way; the money needs a human. Logged
      // with everything needed to issue the refund by hand.
      log({
        event: 'DROPSHIP_REFUND_FAILED',
        orderId: String(order._id),
        razorpayPaymentId: order.razorpayPaymentId,
        amountPaise: toPaise(order.total),
        error: err?.error?.description || err.message,
      });
      await alertAdmins({
        event: 'DROPSHIP_REFUND_FAILED',
        title: 'Refund failed — action needed',
        message: `Cancelled dropship order ${orderLabel(order._id)} could not be refunded (₹${order.total.toLocaleString('en-IN')}): ${err?.error?.description || err.message}. Retry the refund from the order.`,
        link: `/admin/orders/detail/${order._id}`,
        key: `DROPSHIP_REFUND_FAILED:${order._id}`,
        urgent: true,
      });
    }
  }

  if (refunded) {
    try {
      await accounting.postOrderCancellationRefund({
        order: { ...order.toObject(), paymentStatus: 'REFUNDED' },
      });
    } catch (err) {
      console.error('Accounting posting failed (dropship refund), will be reconciled on next read:', err.message);
    }
  }

  await releaseCouponIfWholeCheckoutCancelled({ ...order.toObject(), status: 'CANCELLED' });

  if (notify) {
    const label = String(order._id).slice(-8).toUpperCase();
    await createNotification({
      userId: order.user,
      type: 'ORDER',
      title: 'Order Cancelled',
      message: refunded
        ? `Your order #${label} was cancelled (${reason}). ₹${order.total.toLocaleString('en-IN')} is being refunded to your original payment method.`
        : `Your order #${label} was cancelled (${reason}). Our team will process your refund shortly.`,
      actionType: 'ORDER',
      actionRefId: order._id,
    });
  }

  log({ event: 'DROPSHIP_ORDER_CANCELLED', orderId: String(order._id), cancelledBy, refunded });
  return { ok: true, refunded, order };
}

/**
 * Send a freshly paid DROPSHIP order to CJ. Never throws — the buyer's order
 * is already placed.
 *
 * Outcomes:
 *   created            CJ accepted it
 *   refunded           CJ definitely refused it (or a line cannot be mapped
 *                      to a CJ variant), so the buyer was refunded
 *   needs_reconcile    CJ timed out; it MAY have created the order, so
 *                      refunding now could pay for goods twice. Left for the
 *                      CJ reconciliation flow, exactly as before.
 */
async function fulfil(order, { logisticName = null } = {}) {
  const items = order.items || [];
  const mappings = await ProductFulfillmentMapping.find({
    product: { $in: items.map((item) => item.product) },
    provider: 'CJ',
  }).lean();
  const mappingByProduct = new Map(mappings.map((m) => [String(m.product), m]));

  const cjItems = [];
  for (const item of items) {
    const mapping = mappingByProduct.get(String(item.product));
    const vMapping = resolveCjVariant(mapping, item.variantId);
    if (!mapping || !vMapping?.cjVariantId) {
      // Nothing to order from CJ for this line — the buyer must not be left
      // having paid for something that will never ship.
      log({ event: 'DROPSHIP_MAPPING_MISSING', orderId: String(order._id), productId: String(item.product) });
      await refundAndCancel({
        orderId: order._id,
        cancelledBy: 'system',
        reason: 'the item could not be ordered from our supplier',
      });
      await alertCjFailure(order, `no CJ variant mapped for "${item.name}"`, { refunded: true });
      return { outcome: 'refunded' };
    }
    cjItems.push({
      product: item.product,
      cjProductId: mapping.cjProductId,
      cjVariantId: vMapping.cjVariantId,
      quantity: item.quantity,
      unitCost: vMapping.providerCost || 0,
    });
  }

  const address = order.shippingAddress || {};
  try {
    await cjOrderService.createOrder({
      krozendaOrderId: order._id,
      krozendaSubOrderId: `CJ-${order._id.toString()}`,
      items: cjItems,
      shippingAddress: {
        countryCode: 'IN',
        country: address.country || 'India',
        province: address.state || '',
        city: address.city || '',
        line: [address.line1, address.line2].filter(Boolean).join(', '),
        name: address.fullName || '',
        zip: address.pincode || '',
        phone: address.phone || '',
        fromCountryCode: 'CN',
        // The line the buyer was quoted and paid for, not a hardcoded one.
        logisticName: logisticName || order.cjLogisticName || 'CJPacket Eub',
      },
    });
    // A tracking row from the start, so the CJ tracking poller follows this
    // parcel even if CJ's webhook never arrives. It only polls rows that exist.
    try {
      const created = await CjOrder.findOne({ krozendaOrderId: order._id });
      if (created?.cjOrderId) await require('./cj/cjLogisticsService').getOrCreateShipment(created);
    } catch (err) {
      log({ event: 'DROPSHIP_TRACKING_ROW_FAILED', orderId: String(order._id), error: err.message });
    }
    return { outcome: 'created' };
  } catch (err) {
    if (err.code === 'CJ_ORDER_CREATE_FAILED') {
      await refundAndCancel({
        orderId: order._id,
        cancelledBy: 'system',
        reason: 'our supplier could not accept the order',
      });
      await alertCjFailure(order, err.message, { refunded: true });
      return { outcome: 'refunded' };
    }
    log({ event: 'DROPSHIP_CJ_CREATE_UNCERTAIN', orderId: String(order._id), code: err.code, error: err.message });
    await alertCjFailure(order, err.message, { refunded: false });
    return { outcome: 'needs_reconcile' };
  }
}

/**
 * Admin cancellation. Cancels at CJ first — once CJ has shipped it refuses,
 * and then nothing is refunded, because the goods are already on their way.
 */
async function adminCancel({ orderId }) {
  const order = await Order.findById(orderId);
  if (!order) return { ok: false, status: 404, message: 'Order not found' };
  if (order.status === 'CANCELLED') return { ok: false, status: 409, message: 'This order is already cancelled' };
  if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
    return { ok: false, status: 409, message: 'This dropshipping order has already shipped and can no longer be cancelled' };
  }

  const cjOrder = await CjOrder.findOne({ krozendaOrderId: order._id });
  if (cjOrder?.cjOrderId && cjOrder.status !== 'CANCELLED') {
    try {
      await cjOrderService.cancelOrder(cjOrder.cjOrderId);
    } catch (err) {
      return {
        ok: false,
        status: err.status || 502,
        message: `CJ did not accept the cancellation: ${err.message}. The buyer has not been refunded.`,
      };
    }
  } else if (cjOrder && !cjOrder.cjOrderId && cjOrder.status !== 'FULFILLMENT_FAILED') {
    // A create call that timed out: CJ may hold an order we cannot see yet.
    return {
      ok: false,
      status: 409,
      message: 'This order is still being confirmed with CJ. Reconcile it before cancelling so the goods are not paid for twice.',
    };
  }

  return refundAndCancel({ orderId: order._id, cancelledBy: 'admin', reason: 'cancelled by Krozenda' });
}

/**
 * Retry the refund of a cancelled dropship order whose automatic refund
 * failed (DROPSHIP_REFUND_FAILED in the logs). Refunds to the original
 * payment, and claims the order first so two clicks cannot refund it twice.
 */
async function retryRefund({ orderId }) {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, status: 'CANCELLED', paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' },
    { $set: { paymentStatus: 'REFUNDED' } },
    { new: false }
  );
  if (!claimed) return { ok: false, status: 409, message: 'Nothing to refund on this order' };

  try {
    await razorpay.payments.refund(claimed.razorpayPaymentId, {
      amount: toPaise(claimed.total),
      speed: 'optimum',
      notes: { orderId: String(claimed._id), reason: 'cancellation refund retry' },
    });
  } catch (err) {
    // Hand the claim back so the next attempt can try again.
    await Order.updateOne({ _id: claimed._id, paymentStatus: 'REFUNDED' }, { $set: { paymentStatus: 'PAID' } });
    return { ok: false, status: 502, message: `Razorpay refused the refund: ${err?.error?.description || err.message}` };
  }

  try {
    await accounting.postOrderCancellationRefund({ order: { ...claimed.toObject(), paymentStatus: 'REFUNDED' } });
  } catch (err) {
    console.error('Accounting posting failed (dropship refund retry), will be reconciled on next read:', err.message);
  }
  return { ok: true, order: await Order.findById(claimed._id) };
}

module.exports = { fulfil, adminCancel, refundAndCancel, retryRefund, releaseCouponIfWholeCheckoutCancelled };
