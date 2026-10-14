const Order = require('../../Models/Order');
const ShopifyOrderPush = require('../../Models/ShopifyOrderPush');
const ShopifySettings = require('../../Models/ShopifySettings');
const shopifyOrderService = require('./shopifyOrderService');
const { log } = require('./shopifyClient');
const { alertAdmins } = require('../adminAlertService');
const externalOrderRefundService = require('../externalOrderRefundService');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const { labelOf } = require('./supplierResolver');

// Driving a paid Krozenda order into Shopify.
//
// The state machine:
//
//   SCHEDULED ──buyer/admin cancel──> CANCELLED   (nothing was ever sent)
//       │ cron claims it once dueAt has passed
//       ▼
//    PUSHING ──ok──> PUSHED           (Shopify has it; webhooks take over)
//       │ retryable (429/5xx/network) -> SCHEDULED, backoff
//       │ permanent (rejected)        -> FAILED    + admin alert
//       │ attempts exhausted          -> ABANDONED + admin alert
//
// A FAILED or ABANDONED push is money taken for goods nobody has been asked to
// ship. It is never left silent: an admin is alerted and can retry or refund.

const MAX_ATTEMPTS = Number(process.env.SHOPIFY_PUSH_MAX_ATTEMPTS) || 6;
const BATCH_SIZE = Number(process.env.SHOPIFY_PUSH_BATCH_SIZE) || 25;

// How long to wait before asking Shopify whether an ambiguous push actually
// created an order. Shopify's order search index lags its writes by a few
// seconds, so an immediate lookup answers "no" for an order that exists —
// which would turn one sale into two supplier orders.
const RECONCILE_DELAY_MS = Number(process.env.SHOPIFY_RECONCILE_DELAY_MS) || 120_000;

// Outcomes where the request was SENT and no answer came back. Shopify may or
// may not hold an order, so these are reconciled, never blindly retried.
const AMBIGUOUS_CODES = new Set(['TIMEOUT', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UPSTREAM']);

// Errors where retrying is pointless because the answer will not change.
const PERMANENT_CODES = new Set([
  'ORDER_REJECTED',
  // Shopify refused the query itself — a wrong field, a bad enum, a missing
  // required input. That verdict will not change on the tenth attempt, and
  // retrying only buries the real message under "abandoned after 6 attempts".
  'GRAPHQL_ERROR',
  'BAD_STATUS',
  'UNAUTHORIZED',
  'MAPPING_MISSING',
  'VARIANT_UNRESOLVED',
  'NO_LINE_ITEMS',
  'NO_ORDER_RETURNED',
  'FORBIDDEN',
]);

function backoffMs(attempt) {
  const base = Math.min(60 * 2 ** Math.max(0, attempt - 1), 1800) * 1000;
  return base + Math.floor(Math.random() * 5000);
}

function orderLabel(id) {
  return `ORD-${String(id).slice(-8).toUpperCase()}`;
}

/**
 * Schedule a push. Called from inside the checkout transaction.
 *
 * `session` is required by design: a push row written outside the transaction
 * could survive a rolled-back checkout (an order nobody placed, sent to a
 * supplier) or be lost while the order commits (a paid order never sent).
 */
/**
 * Split an order's lines by which dropshipping app supplies them.
 *
 * Delivery is apportioned by each supplier's share of the goods value rather
 * than duplicated: charging every supplier's Shopify order the full delivery
 * fee would overstate the store's revenue by a multiple of the supplier count.
 * The remainder goes to the first group so the parts always add back up to
 * exactly what the buyer paid.
 */
async function groupBySupplier(order) {
  const live = (order.items || []).filter((i) => i.status !== 'CANCELLED');
  const mappings = await ProductFulfillmentMapping.find({
    provider: 'SHOPIFY',
    product: { $in: live.map((i) => i.product) },
  })
    .select('product externalSupplier variants')
    .lean();
  const byProduct = new Map(mappings.map((m) => [String(m.product), m]));

  const groups = new Map();
  for (const item of live) {
    const mapping = byProduct.get(String(item.product));
    const supplier = mapping?.externalSupplier || 'UNKNOWN';
    if (!groups.has(supplier)) {
      groups.set(supplier, { supplier, productIds: [], subtotal: 0, providerCost: 0, linesWithoutCost: 0 });
    }
    const group = groups.get(supplier);
    group.productIds.push(item.product);
    group.subtotal += Number(item.price || 0) * Number(item.quantity || 0);

    const variant = item.variantId
      ? (mapping?.variants || []).find((v) => String(v.krozendaVariantId) === String(item.variantId))
      : (mapping?.variants || []).length === 1
        ? mapping.variants[0]
        : null;
    // null/undefined means the provider never told us, which is not zero.
    const unitCost = variant?.providerCost;
    if (unitCost === null || unitCost === undefined) group.linesWithoutCost += 1;
    else group.providerCost += Number(unitCost) * Number(item.quantity || 0);
  }

  const list = [...groups.values()];
  const goods = list.reduce((sum, g) => sum + g.subtotal, 0);
  const delivery = Number(order.shippingFee || 0);

  let allocated = 0;
  list.forEach((group, index) => {
    if (index === list.length - 1) {
      // The last group absorbs the rounding remainder, so the shares always
      // sum to exactly the delivery the buyer was charged.
      group.shippingFee = Math.round((delivery - allocated) * 100) / 100;
    } else {
      const share = goods > 0 ? Math.round(((delivery * group.subtotal) / goods) * 100) / 100 : 0;
      group.shippingFee = share;
      allocated += share;
    }
    group.subtotal = Math.round(group.subtotal * 100) / 100;
    group.providerCost = Math.round(group.providerCost * 100) / 100;
  });

  return list;
}

async function schedule({ orders, checkoutGroupId, session, graceWindowMinutes }) {
  const shopifyOrders = (orders || []).filter((o) => o.fulfillmentType === 'SHOPIFY');
  if (shopifyOrders.length === 0) return [];

  const grace = Math.max(0, Number(graceWindowMinutes) || 0);
  const dueAt = new Date(Date.now() + grace * 60 * 1000);

  const rows = [];
  for (const order of shopifyOrders) {
    // One push per supplier. A single Shopify order holding two suppliers'
    // lines can be fulfilled twice — two parcels billed for one sale.
    for (const group of await groupBySupplier(order)) {
      rows.push({
        order: order._id,
        user: order.user,
        checkoutGroupId: checkoutGroupId || '',
        supplier: group.supplier,
        supplierLabel: labelOf(group.supplier),
        productIds: group.productIds,
        subtotal: group.subtotal,
        shippingFee: group.shippingFee,
        providerCost: group.providerCost,
        linesWithoutCost: group.linesWithoutCost,
        status: 'SCHEDULED',
        dueAt,
        graceWindowMinutes: grace,
      });
    }
  }

  if (rows.length === 0) return [];
  return ShopifyOrderPush.create(rows, { session, ordered: true });
}

/**
 * Cancel a scheduled push, if it has not been claimed yet.
 *
 * The conditional update IS the mutual exclusion: the cron can never push a
 * row a buyer just cancelled, and a buyer can never cancel one mid-push.
 * Returns the row when the cancel won, null when it was already on its way.
 */
async function claimForCancel({ orderId, cancelledBy, reason = '' }) {
  // An order can now have several pushes, one per supplier. Cancelling must
  // be all-or-nothing: cancelling the buyer's order while one supplier's push
  // is already on its way would refund them for a parcel still being shipped.
  const total = await ShopifyOrderPush.countDocuments({ order: orderId });
  if (total === 0) return null;

  const sent = await ShopifyOrderPush.countDocuments({ order: orderId, status: { $ne: 'SCHEDULED' } });
  if (sent > 0) return null;

  const result = await ShopifyOrderPush.updateMany(
    { order: orderId, status: 'SCHEDULED' },
    { $set: { status: 'CANCELLED', cancelledBy, cancelledReason: reason } }
  );
  // Nothing claimed means another writer got there first.
  if (result.modifiedCount === 0) return null;
  return ShopifyOrderPush.findOne({ order: orderId });
}

/** Can the buyer still cancel this order themselves? */
async function isCancellable(orderId) {
  const pushes = await ShopifyOrderPush.find({ order: orderId }).select('status').lean();
  // No rows means no provider is involved, so the ordinary rules apply.
  if (pushes.length === 0) return true;
  // EVERY supplier's push must still be unsent. If one has gone, the order is
  // part-way to being shipped and cannot be cancelled as a whole.
  // NEEDS_RECONCILE counts as sent: the supplier may already hold it, and
  // promising a cancellation that cannot happen is worse than refusing one.
  return pushes.every((p) => p.status === 'SCHEDULED');
}

async function markPushed(push, shopifyOrder, { test }) {
  push.status = 'PUSHED';
  push.awaitingReconcile = false;
  push.shopifyOrderId = shopifyOrder.id;
  push.shopifyOrderName = shopifyOrder.name || '';
  push.pushedAt = new Date();
  push.test = Boolean(test);
  push.lastError = '';
  push.lastErrorCode = '';
  push.claimedAt = null;
  await push.save();

  log({
    event: 'SHOPIFY_PUSH_OK',
    orderId: String(push.order),
    shopifyOrderId: shopifyOrder.id,
    attempts: push.attempts,
    test: Boolean(test),
  });
}

async function markAmbiguous(push, err) {
  push.status = 'NEEDS_RECONCILE';
  push.awaitingReconcile = true;
  push.nextAttemptAt = new Date(Date.now() + RECONCILE_DELAY_MS);
  push.lastError = `Outcome unknown: ${String(err.message).slice(0, 400)}`;
  push.lastErrorCode = err.code || 'UNKNOWN';
  push.claimedAt = null;
  await push.save();

  log({
    event: 'SHOPIFY_PUSH_AMBIGUOUS',
    orderId: String(push.order),
    attempt: push.attempts,
    code: err.code,
    reconcileAt: push.nextAttemptAt.toISOString(),
  });
}

async function markRetryable(push, err) {
  push.status = 'SCHEDULED';
  push.nextAttemptAt = new Date(Date.now() + backoffMs(push.attempts));
  push.lastError = String(err.message).slice(0, 500);
  push.lastErrorCode = err.code || 'UNKNOWN';
  push.claimedAt = null;
  await push.save();

  log({
    event: 'SHOPIFY_PUSH_RETRY',
    orderId: String(push.order),
    attempt: push.attempts,
    nextAttemptAt: push.nextAttemptAt.toISOString(),
    code: err.code,
  });
}

async function markDead(push, err, status) {
  push.status = status;
  push.lastError = String(err.message).slice(0, 500);
  push.lastErrorCode = err.code || 'UNKNOWN';
  push.claimedAt = null;
  await push.save();

  log({ event: 'SHOPIFY_PUSH_DEAD', orderId: String(push.order), status, code: err.code, error: err.message });

  const order = await Order.findById(push.order).select('total').lean();
  await alertAdmins({
    event: 'SHOPIFY_ORDER_PUSH_FAILED',
    title: 'Paid order did not reach Shopify',
    message:
      `${orderLabel(push.order)} (₹${Number(order?.total || 0).toLocaleString('en-IN')}) was paid for but could not ` +
      `be sent to Shopify after ${push.attempts} attempt(s): ${err.message}. ` +
      `The supplier has not been asked to ship it. Retry it or refund the buyer.`,
    link: `/admin/orders/detail/${push.order}`,
    key: `SHOPIFY_PUSH_FAILED:${push.order}`,
    urgent: true,
  });
}

/**
 * Push one claimed row.
 *
 * Never throws: it is driven by a cron, and one bad order must not stop the
 * queue behind it.
 */
async function pushOne(push, { test = false } = {}) {
  const order = await Order.findById(push.order).lean();

  if (!order) {
    push.status = 'CANCELLED';
    push.cancelledBy = 'system';
    push.cancelledReason = 'the Krozenda order no longer exists';
    push.claimedAt = null;
    await push.save();
    return { outcome: 'order_missing' };
  }

  // Cancelled between scheduling and claiming — do not send it.
  if (order.status === 'CANCELLED') {
    push.status = 'CANCELLED';
    push.cancelledBy = 'system';
    push.cancelledReason = 'the order was cancelled before it was sent';
    push.claimedAt = null;
    await push.save();
    return { outcome: 'order_cancelled' };
  }

  try {
    // Before any repeat attempt, look for an order a previous one may
    // already have created. orderCreate cannot be made idempotent, so this
    // lookup is the only thing stopping one sale becoming two supplier
    // orders. It is reliable HERE and not immediately after the failure,
    // because by now the search index has had time to catch up.
    if (push.attempts > 1 || push.awaitingReconcile) {
      const existing = await shopifyOrderService.findExistingOrder(push.order, push.supplier);
      if (existing) {
        log({ event: 'SHOPIFY_PUSH_ADOPTED_EXISTING', orderId: String(push.order), shopifyOrderId: existing.id });
        await markPushed(push, existing, { test: push.test });
        return { outcome: 'adopted', shopifyOrderId: existing.id };
      }
    }

    const Customer = require('../../Models/Customer');
    const buyer = order.user ? await Customer.findById(order.user).select('name email mobileNumber').lean() : null;

    const shopifyOrder = await shopifyOrderService.createOrder(order, {
      test,
      supplier: push.supplier,
      productIds: push.productIds,
      shippingFee: push.shippingFee,
      buyer,
    });
    await markPushed(push, shopifyOrder, { test });
    return { outcome: 'pushed', shopifyOrderId: shopifyOrder.id };
  } catch (err) {
    // A clean rejection is unambiguous: Shopify looked at the request and
    // refused it, so no order exists and retrying changes nothing.
    if (PERMANENT_CODES.has(err.code)) {
      await markDead(push, err, 'FAILED');
      return { outcome: 'failed', code: err.code };
    }

    if (push.attempts >= MAX_ATTEMPTS) {
      await markDead(push, err, 'ABANDONED');
      return { outcome: 'abandoned', code: err.code };
    }

    // Sent, but no answer: park it and ask Shopify later whether it landed.
    if (err.isTimeout || AMBIGUOUS_CODES.has(err.code)) {
      await markAmbiguous(push, err);
      return { outcome: 'reconcile', code: err.code };
    }

    // A throttle never executed, so it is safe to send again immediately.
    await markRetryable(push, err);
    return { outcome: 'retry', code: err.code };
  }
}

/**
 * Drain the queue. Returns a summary for the job log and the admin screen.
 */
async function drain({ limit = BATCH_SIZE } = {}) {
  const settings = await ShopifySettings.getSettings();
  if (settings.status !== 'CONNECTED') {
    return { skipped: true, reason: 'NOT_CONNECTED', pushed: 0 };
  }
  if (String(process.env.SHOPIFY_DISABLE_OUTBOUND).toLowerCase() === 'true') {
    return { skipped: true, reason: 'OUTBOUND_DISABLED', pushed: 0 };
  }

  const summary = { claimed: 0, pushed: 0, retry: 0, reconcile: 0, failed: 0, abandoned: 0, skipped: false };

  for (let i = 0; i < limit; i += 1) {
    const push = await ShopifyOrderPush.claimNext();
    if (!push) break;
    summary.claimed += 1;

    const result = await pushOne(push, { test: settings.pushAsTestOrders === true });
    if (result.outcome === 'pushed' || result.outcome === 'adopted') summary.pushed += 1;
    else if (result.outcome === 'retry') summary.retry += 1;
    else if (result.outcome === 'reconcile') summary.reconcile += 1;
    else if (result.outcome === 'failed') summary.failed += 1;
    else if (result.outcome === 'abandoned') summary.abandoned += 1;
  }

  return summary;
}

/** Admin: send a FAILED or ABANDONED order again, now. */
async function retry({ orderId, supplier = null }) {
  const push = supplier
    ? await ShopifyOrderPush.findOne({ order: orderId, supplier })
    : await ShopifyOrderPush.findOne({ order: orderId, status: { $in: ['FAILED', 'ABANDONED', 'NEEDS_RECONCILE'] } });
  if (!push) return { ok: false, status: 404, message: 'This order has no Shopify push.' };
  if (push.status === 'PUSHED') {
    return { ok: false, status: 409, message: 'This order is already in Shopify.' };
  }
  if (push.status === 'PUSHING') {
    return { ok: false, status: 409, message: 'This order is being sent right now.' };
  }
  if (push.status === 'NEEDS_RECONCILE' || push.awaitingReconcile) {
    // Forcing a send here could duplicate a supplier order that already
    // exists. Reconciling first answers whether it does.
    const existing = await shopifyOrderService.findExistingOrder(orderId, push.supplier);
    if (existing) {
      await markPushed(push, existing, { test: push.test });
      return { ok: true, result: { outcome: 'adopted', shopifyOrderId: existing.id } };
    }
  }

  push.status = 'SCHEDULED';
  push.attempts = 0;
  push.nextAttemptAt = null;
  push.dueAt = new Date();
  push.claimedAt = null;
  await push.save();

  const result = await pushOne(await ShopifyOrderPush.claimNext(), {});
  return { ok: true, result };
}

/**
 * Admin: cancel the order, asking Shopify first when it already has it.
 *
 * The provider is asked BEFORE the buyer is refunded, and a refusal aborts
 * without refunding. Refunding a buyer for goods already on their way loses
 * the money and the stock.
 */
async function adminCancel({ orderId, reason = 'cancelled by Krozenda' }) {
  const order = await Order.findById(orderId).select('status fulfillmentType').lean();
  if (!order) return { ok: false, status: 404, message: 'Order not found' };
  if (order.status === 'CANCELLED') return { ok: false, status: 409, message: 'This order is already cancelled' };
  if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
    return { ok: false, status: 409, message: 'This order has already shipped and can no longer be cancelled' };
  }

  const pushes = await ShopifyOrderPush.find({ order: orderId });
  const push = pushes[0] || null;

  // Still unsent on EVERY supplier: cancelling is free, nothing to unwind.
  if (pushes.length > 0 && pushes.every((p) => p.status === 'SCHEDULED')) {
    const claimed = await claimForCancel({ orderId, cancelledBy: 'admin', reason });
    if (claimed) {
      return externalOrderRefundService.refundAndCancel({ orderId, cancelledBy: 'admin', reason });
    }
  }

  if (pushes.some((p) => p.status === 'PUSHING')) {
    return {
      ok: false,
      status: 409,
      message: 'This order is being sent to Shopify right now. Try again in a moment.',
    };
  }

  // Cancel at EVERY supplier that already has it. If any refuses, stop and
  // refund nothing: a buyer refunded for a parcel still on its way costs the
  // money and the goods.
  for (const p of pushes.filter((x) => x.shopifyOrderId)) {
    try {
      await shopifyOrderService.cancelOrder(p.shopifyOrderId);
    } catch (err) {
      return {
        ok: false,
        status: 502,
        message: `${p.supplierLabel || p.supplier} did not accept the cancellation: ${err.message}. The buyer has NOT been refunded.`,
      };
    }
  }

  return externalOrderRefundService.refundAndCancel({ orderId, cancelledBy: 'admin', reason });
}

module.exports = {
  schedule,
  groupBySupplier,
  drain,
  pushOne,
  retry,
  adminCancel,
  claimForCancel,
  isCancellable,
  MAX_ATTEMPTS,
};
