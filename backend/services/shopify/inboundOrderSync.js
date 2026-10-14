const Order = require('../../Models/Order');
const ShopifyOrderPush = require('../../Models/ShopifyOrderPush');
const { log } = require('./shopifyClient');

// Shopify telling Krozenda what happened to an order after the supplier took
// it: shipped, tracking number, delivered, cancelled.
//
// Every handler here is IDEMPOTENT. Shopify delivers at least once, the
// webhook ledger dedupes by id but is explicitly allowed to fail open on a
// transient write error, and the reconciliation poller replays anything
// missed — so the same event arriving twice must be a no-op, not a second
// status change.
//
// Status only ever moves FORWARD. A late-arriving "shipped" must not pull a
// delivered order backwards, and nothing resurrects a cancelled one.

const LINE_RANK = Object.freeze({ PENDING: 0, PROCESSING: 1, SHIPPED: 2, DELIVERED: 3 });

// Shopify fulfilment status -> the buyer-facing line status.
const FULFILLMENT_TO_LINE = Object.freeze({
  SUCCESS: 'SHIPPED',
  OPEN: 'SHIPPED',
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'SHIPPED',
  ATTEMPTED_DELIVERY: 'SHIPPED',
  DELIVERED: 'DELIVERED',
});

/** Find the Krozenda order a Shopify payload belongs to. */
async function resolveOrder(payload) {
  const gid = payload?.admin_graphql_api_id || (payload?.id ? `gid://shopify/Order/${payload.id}` : null);

  // The push row is the authoritative link. The tag is a fallback for an
  // order adopted after a timeout, where the row may have been written by a
  // different attempt.
  if (gid) {
    const push = await ShopifyOrderPush.findOne({ shopifyOrderId: gid }).select('order').lean();
    if (push) return Order.findById(push.order);
  }

  const tag = (payload?.tags || '')
    .split(',')
    .map((t) => t.trim())
    .find((t) => t.startsWith('krozenda-order:'));
  if (tag) {
    const orderId = tag.split(':')[1];
    if (orderId) return Order.findById(orderId).catch(() => null);
  }

  return null;
}

function applyLineStatus(order, target) {
  if (!target) return false;
  let changed = false;
  for (const item of order.items) {
    if (item.status === 'CANCELLED') continue;
    if ((LINE_RANK[target] ?? 0) > (LINE_RANK[item.status] ?? 0)) {
      item.status = target;
      item.statusHistory.push({ status: target, at: new Date() });
      changed = true;
    }
  }
  return changed;
}

function applyTracking(order, { number, company, url }) {
  let changed = false;
  for (const item of order.items) {
    if (item.status === 'CANCELLED') continue;
    if (number && item.trackingNumber !== number) {
      item.trackingNumber = number;
      changed = true;
    }
    if (company && item.courierName !== company) {
      item.courierName = company;
      changed = true;
    }
  }
  if (url && order.trackingUrl !== url) {
    // Only set when the schema carries it; harmless otherwise.
    if ('trackingUrl' in order) order.trackingUrl = url;
  }
  return changed;
}

/** fulfillments/create and fulfillments/update */
async function handleFulfillment(payload) {
  const order = await resolveOrder({ id: payload?.order_id, admin_graphql_api_id: payload?.admin_graphql_api_id });
  if (!order) {
    log({ event: 'SHOPIFY_FULFILLMENT_UNKNOWN_ORDER', shopifyOrderId: payload?.order_id });
    return { handled: false, reason: 'UNKNOWN_ORDER' };
  }
  if (order.status === 'CANCELLED') return { handled: false, reason: 'ORDER_CANCELLED' };

  const status = String(payload?.shipment_status || payload?.status || '').toUpperCase();
  const target = FULFILLMENT_TO_LINE[status] || 'SHIPPED';

  const trackingChanged = applyTracking(order, {
    number: payload?.tracking_number || (payload?.tracking_numbers || [])[0] || '',
    company: payload?.tracking_company || '',
    url: payload?.tracking_url || (payload?.tracking_urls || [])[0] || '',
  });
  const statusChanged = applyLineStatus(order, target);

  if (statusChanged || trackingChanged) {
    // Saved through the document so the Order model's own hooks roll the
    // order status up from its lines and fire the buyer notifications.
    await order.save();
    log({
      event: 'SHOPIFY_FULFILLMENT_APPLIED',
      orderId: String(order._id),
      status: target,
      tracking: payload?.tracking_number || null,
    });
  }

  return { handled: true, changed: statusChanged || trackingChanged };
}

/** orders/updated — the catch-all, used mostly for cancellation and status drift. */
async function handleOrderUpdated(payload) {
  const order = await resolveOrder(payload);
  if (!order) return { handled: false, reason: 'UNKNOWN_ORDER' };
  if (order.status === 'CANCELLED') return { handled: false, reason: 'ALREADY_CANCELLED' };

  const fulfillmentStatus = String(payload?.fulfillment_status || '').toUpperCase();
  const target = fulfillmentStatus === 'FULFILLED' ? 'SHIPPED' : null;
  if (!target) return { handled: true, changed: false };

  const changed = applyLineStatus(order, target);
  if (changed) await order.save();
  return { handled: true, changed };
}

/**
 * orders/cancelled — the supplier side cancelled it.
 *
 * Krozenda's own cancellation already refunds through Razorpay, so this only
 * records what happened. It deliberately does NOT refund: an admin-initiated
 * cancel has already refunded by the time this arrives, and refunding again
 * on a webhook would pay the buyer twice.
 */
async function handleOrderCancelled(payload) {
  const order = await resolveOrder(payload);
  if (!order) return { handled: false, reason: 'UNKNOWN_ORDER' };
  if (order.status === 'CANCELLED') return { handled: true, changed: false };

  log({
    event: 'SHOPIFY_ORDER_CANCELLED_UPSTREAM',
    orderId: String(order._id),
    reason: payload?.cancel_reason || null,
  });

  const { alertAdmins } = require('../adminAlertService');
  await alertAdmins({
    event: 'SHOPIFY_ORDER_CANCELLED_UPSTREAM',
    title: 'Supplier cancelled a paid order',
    message:
      `Order ORD-${String(order._id).slice(-8).toUpperCase()} was cancelled in Shopify ` +
      `(${payload?.cancel_reason || 'no reason given'}), but the buyer has paid and has NOT been refunded. ` +
      `Cancel and refund it from the order screen.`,
    link: `/admin/orders/detail/${order._id}`,
    key: `SHOPIFY_CANCELLED_UPSTREAM:${order._id}`,
    urgent: true,
  });

  return { handled: true, changed: false, alerted: true };
}


/**
 * Read an order's current state from Shopify and apply it.
 *
 * WHY POLLING EXISTS ALONGSIDE WEBHOOKS. Webhooks are faster and are the
 * primary path, but they need a PUBLIC HTTPS address. A server on localhost,
 * behind a firewall, or between deploys receives none — and Shopify deletes a
 * subscription that fails for long enough. Without polling the buyer's order
 * then sits at PENDING forever while the parcel is already moving.
 *
 * Idempotent and forward-only, exactly like the webhook path, so the two can
 * both run and the second one to arrive simply changes nothing.
 */
async function pollOrder(push) {
  if (!push.shopifyOrderId) return { polled: false, reason: 'NOT_PUSHED' };

  const shopifyOrderService = require('./shopifyOrderService');
  const remote = await shopifyOrderService.getOrderStatus(push.shopifyOrderId);
  if (!remote) return { polled: false, reason: 'NOT_FOUND_AT_PROVIDER' };

  const order = await Order.findById(push.order);
  if (!order) return { polled: false, reason: 'ORDER_MISSING' };
  if (order.status === 'CANCELLED') return { polled: true, changed: false, reason: 'ORDER_CANCELLED' };

  let changed = false;

  // Tracking, from whichever fulfilment carries one.
  for (const fulfillment of remote.fulfillments || []) {
    const info = (fulfillment.trackingInfo || [])[0];
    if (!info) continue;
    if (applyTracking(order, { number: info.number, company: info.company, url: info.url })) changed = true;
  }

  // Shopify's own words for where the order is. Only ever moves forward.
  const fulfilmentState = String(remote.displayFulfillmentStatus || '').toUpperCase();
  const target =
    fulfilmentState === 'FULFILLED'
      ? 'SHIPPED'
      : fulfilmentState === 'PARTIALLY_FULFILLED'
        ? 'SHIPPED'
        : fulfilmentState === 'IN_PROGRESS'
          ? 'PROCESSING'
          : null;

  if (applyLineStatus(order, target)) changed = true;

  // A delivered fulfilment is the strongest signal Shopify gives.
  const delivered = (remote.fulfillments || []).some((f) => String(f.status || '').toUpperCase() === 'DELIVERED');
  if (delivered && applyLineStatus(order, 'DELIVERED')) changed = true;

  if (changed) {
    // Saved through the document so Order's own hooks roll the order status up
    // from its lines and fire the buyer's notifications.
    await order.save();
    log({
      event: 'SHOPIFY_ORDER_POLLED',
      orderId: String(order._id),
      shopifyOrder: remote.name,
      fulfilment: fulfilmentState,
      changed: true,
    });
  }

  // Cancelled upstream while we were not listening.
  if (remote.cancelledAt && order.status !== 'CANCELLED') {
    await handleOrderCancelled({ admin_graphql_api_id: push.shopifyOrderId });
  }

  return { polled: true, changed, fulfilment: fulfilmentState };
}

/**
 * Poll every order that is still in flight.
 *
 * A DELIVERED or CANCELLED order is finished and is skipped, so the work does
 * not grow without bound as the store's history does.
 */
async function pollOpenOrders({ limit = 50 } = {}) {
  const ShopifyOrderPush = require('../../Models/ShopifyOrderPush');
  const pushes = await ShopifyOrderPush.find({ status: 'PUSHED', shopifyOrderId: { $ne: null } })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  const summary = { checked: 0, changed: 0, failed: 0, skipped: 0 };
  for (const push of pushes) {
    const order = await Order.findById(push.order).select('status').lean();
    if (!order || ['DELIVERED', 'CANCELLED'].includes(order.status)) {
      summary.skipped += 1;
      continue;
    }
    summary.checked += 1;
    try {
      const result = await pollOrder(push);
      if (result.changed) summary.changed += 1;
    } catch (err) {
      summary.failed += 1;
      log({ event: 'SHOPIFY_POLL_FAILED', orderId: String(push.order), error: err.message });
    }
  }
  return summary;
}

module.exports = { handleFulfillment, handleOrderUpdated, handleOrderCancelled, resolveOrder, FULFILLMENT_TO_LINE, pollOrder, pollOpenOrders };
