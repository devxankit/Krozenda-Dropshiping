const Order = require('../Models/Order');
const { toPaise } = require('../utils/money');

// There is no payout/settlement ledger on this platform yet (admin has no
// "mark as paid" flow) — so this is honestly computed from delivered items
// only, not backed by a real transfer record. `paidAmount` stays 0 until a
// payout system exists; everything earned so far shows as pending.
async function getMyEarningsSummary(req, res) {
  const vendorId = req.vendor._id;
  const commissionRate = req.vendor.commissionRatePercent ?? 10;

  const rows = await Order.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.vendor': vendorId } },
    {
      $group: {
        _id: '$items.status',
        gross: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r]));
  const deliveredGross = byStatus.DELIVERED?.gross || 0;
  const pendingGross = Object.entries(byStatus)
    .filter(([status]) => status !== 'DELIVERED' && status !== 'CANCELLED')
    .reduce((sum, [, r]) => sum + r.gross, 0);

  const commission = Math.round((deliveredGross * commissionRate) / 100);
  const netEarnings = deliveredGross - commission;

  res.json({
    success: true,
    data: {
      commissionRatePercent: commissionRate,
      totalSales: toPaise(deliveredGross),
      totalCommission: toPaise(commission),
      netEarnings: toPaise(netEarnings),
      pendingAmount: toPaise(netEarnings), // no payout ledger yet — see comment above
      paidAmount: 0,
      inTransitOrderValue: toPaise(pendingGross),
      deliveredOrdersCount: byStatus.DELIVERED?.count || 0,
    },
  });
}

// Delivered order items, one row per line item, as the "earning entries"
// list — the closest honest equivalent of a transaction history without a
// real settlement ledger.
async function listMyEarningsEntries(req, res) {
  const vendorId = req.vendor._id;
  const commissionRate = req.vendor.commissionRatePercent ?? 10;

  const orders = await Order.find({ 'items.vendor': vendorId, 'items.status': 'DELIVERED' }).sort({ createdAt: -1 });

  const items = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (item.vendor?.toString() !== vendorId.toString() || item.status !== 'DELIVERED') continue;
      const gross = item.price * item.quantity;
      const commission = Math.round((gross * commissionRate) / 100);
      items.push({
        id: `${order._id.toString()}-${item.product.toString()}`,
        orderId: order._id.toString(),
        productName: item.name,
        quantity: item.quantity,
        grossAmount: toPaise(gross),
        commission: toPaise(commission),
        netAmount: toPaise(gross - commission),
        deliveredAt: order.deliveredAt,
      });
    }
  }

  res.json({ success: true, data: { items } });
}

module.exports = { getMyEarningsSummary, listMyEarningsEntries };
