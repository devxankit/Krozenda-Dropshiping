const ShopifyOrderPush = require('../../Models/ShopifyOrderPush');
const Order = require('../../Models/Order');

// What each dropshipping supplier was sent, and what Krozenda made on it.
//
// The numbers an admin actually needs, and the ones that are easy to get
// subtly wrong:
//
//   revenue  what the BUYER paid for this supplier's lines (goods + that
//            supplier's apportioned share of delivery)
//   cost     what the SUPPLIER charges for those lines, from the fulfilment
//            mapping's providerCost
//   margin   revenue − cost. Krozenda's gross take before gateway fees.
//
// Only PUSHED rows count toward earnings. A SCHEDULED order has not been
// ordered from anyone yet, and a FAILED one never will be — counting either as
// revenue would report money against goods nobody is shipping.
//
// Money at risk is reported SEPARATELY and never netted into the totals: a
// paid order that failed to reach a supplier is not a loss, it is an open
// obligation that still needs refunding or retrying.

const EARNED_STATUSES = ['PUSHED'];
const AT_RISK_STATUSES = ['FAILED', 'ABANDONED', 'NEEDS_RECONCILE'];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * @param {object} [range] { start, end } — defaults to all time
 */
async function supplierEarnings({ start = null, end = null } = {}) {
  const match = {};
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = new Date(start);
    if (end) match.createdAt.$lt = new Date(end);
  }

  const pushes = await ShopifyOrderPush.find(match).lean();

  // Cancelled orders earn nothing even if they were pushed, so the order's
  // own status has the final say.
  const orders = await Order.find({ _id: { $in: pushes.map((p) => p.order) } })
    .select('status paymentStatus total createdAt')
    .lean();
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  const bySupplier = new Map();
  const ensure = (code, label) => {
    if (!bySupplier.has(code)) {
      bySupplier.set(code, {
        supplier: code,
        label: label || code,
        orders: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        delivery: 0,
        // Lines the provider never priced. Margin is only meaningful when
        // this is zero.
        linesWithoutCost: 0,
        pending: 0,
        pendingValue: 0,
        atRisk: 0,
        atRiskValue: 0,
        cancelled: 0,
      });
    }
    return bySupplier.get(code);
  };

  for (const push of pushes) {
    const row = ensure(push.supplier || 'UNKNOWN', push.supplierLabel);
    const order = orderById.get(String(push.order));
    const value = round2(Number(push.subtotal || 0) + Number(push.shippingFee || 0));

    if (push.status === 'CANCELLED' || order?.status === 'CANCELLED') {
      row.cancelled += 1;
      continue;
    }

    if (AT_RISK_STATUSES.includes(push.status)) {
      // Paid by the buyer, not ordered from the supplier. An open obligation,
      // deliberately kept out of revenue.
      row.atRisk += 1;
      row.atRiskValue = round2(row.atRiskValue + value);
      continue;
    }

    if (!EARNED_STATUSES.includes(push.status)) {
      row.pending += 1;
      row.pendingValue = round2(row.pendingValue + value);
      continue;
    }

    row.orders += 1;
    row.revenue = round2(row.revenue + value);
    row.delivery = round2(row.delivery + Number(push.shippingFee || 0));
    row.cost = round2(row.cost + Number(push.providerCost || 0));
    row.linesWithoutCost += Number(push.linesWithoutCost || 0);
    row.margin = round2(row.revenue - row.cost);
  }

  const suppliers = [...bySupplier.values()].sort((a, b) => b.revenue - a.revenue);

  const totals = suppliers.reduce(
    (acc, s) => ({
      orders: acc.orders + s.orders,
      revenue: round2(acc.revenue + s.revenue),
      cost: round2(acc.cost + s.cost),
      margin: round2(acc.margin + s.margin),
      delivery: round2(acc.delivery + s.delivery),
      pending: acc.pending + s.pending,
      pendingValue: round2(acc.pendingValue + s.pendingValue),
      atRisk: acc.atRisk + s.atRisk,
      atRiskValue: round2(acc.atRiskValue + s.atRiskValue),
      cancelled: acc.cancelled + s.cancelled,
    }),
    {
      orders: 0,
      revenue: 0,
      cost: 0,
      margin: 0,
      delivery: 0,
      pending: 0,
      pendingValue: 0,
      atRisk: 0,
      atRiskValue: 0,
      cancelled: 0,
    }
  );

  totals.linesWithoutCost = suppliers.reduce((sum, s) => sum + s.linesWithoutCost, 0);

  // Margin is reported as UNKNOWN, not as a number, when any line had no cost
  // from the provider. Showing "100%" because the cost happens to be missing
  // is worse than showing nothing: it reads as a fact and would be acted on.
  const finish = (row) => {
    row.costKnown = row.linesWithoutCost === 0;
    row.marginPercent = row.costKnown && row.revenue > 0 ? Math.round((row.margin / row.revenue) * 1000) / 10 : null;
    if (!row.costKnown) row.margin = null;
    return row;
  };

  suppliers.forEach(finish);
  finish(totals);

  return { suppliers, totals };
}

/**
 * The payment states an admin has to act on.
 *
 * Each of these is money that is somewhere it should not be, and each has a
 * different remedy — which is why they are counted separately rather than
 * rolled into one "problems" number.
 */
async function paymentExceptions() {
  const [unsent, pushedUnpaid, paidNotPushed, cancelledButSent] = await Promise.all([
    // Buyer paid; no supplier has been asked to ship. Retry or refund.
    ShopifyOrderPush.find({ status: { $in: AT_RISK_STATUSES } })
      .select('order supplier supplierLabel status subtotal shippingFee lastError attempts')
      .lean(),

    // Sent to a supplier on an order whose payment is not settled. Should be
    // impossible — the push is only scheduled for a paid order — so if it
    // appears, something upstream is wrong.
    Order.find({ fulfillmentType: 'SHOPIFY', paymentStatus: { $nin: ['PAID', 'REFUNDED'] } })
      .select('_id total paymentStatus status createdAt')
      .lean(),

    // Paid and sitting in the cancel window longer than any window should
    // last — a push the cron never picked up.
    ShopifyOrderPush.find({
      status: 'SCHEDULED',
      dueAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) },
    })
      .select('order supplier supplierLabel dueAt subtotal shippingFee')
      .lean(),

    // Cancelled in Krozenda but already with a supplier: the parcel may still
    // ship, so the refund needs chasing at the provider.
    ShopifyOrderPush.find({ status: 'PUSHED' })
      .select('order supplier supplierLabel shopifyOrderName subtotal shippingFee')
      .lean()
      .then(async (rows) => {
        if (rows.length === 0) return [];
        const cancelled = await Order.find({
          _id: { $in: rows.map((r) => r.order) },
          status: 'CANCELLED',
        })
          .select('_id total paymentStatus')
          .lean();
        const ids = new Set(cancelled.map((o) => String(o._id)));
        return rows.filter((r) => ids.has(String(r.order)));
      }),
  ]);

  return {
    notReachedSupplier: {
      count: unsent.length,
      value: round2(unsent.reduce((s, r) => s + Number(r.subtotal || 0) + Number(r.shippingFee || 0), 0)),
      rows: unsent,
      meaning: 'The buyer paid, but no supplier has been asked to ship. Retry the push, or cancel and refund.',
    },
    paymentNotSettled: {
      count: pushedUnpaid.length,
      rows: pushedUnpaid,
      meaning: 'An externally fulfilled order whose payment never settled. It should never have been placed.',
    },
    stuckInCancelWindow: {
      count: paidNotPushed.length,
      value: round2(paidNotPushed.reduce((s, r) => s + Number(r.subtotal || 0) + Number(r.shippingFee || 0), 0)),
      rows: paidNotPushed,
      meaning: 'Past its send time but still unsent — the push job may not be running.',
    },
    cancelledAfterSending: {
      count: cancelledButSent.length,
      rows: cancelledButSent,
      meaning: 'Cancelled in Krozenda after the supplier already had it. Confirm the supplier cancelled it too.',
    },
  };
}

module.exports = { supplierEarnings, paymentExceptions };
