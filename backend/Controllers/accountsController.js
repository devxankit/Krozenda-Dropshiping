const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const VendorPayout = require('../Models/VendorPayout');
const GatewayTransaction = require('../Models/GatewayTransaction');
const { toPaise } = require('../utils/money');

// Accounts MVP — a small, standalone order-level financial dashboard plus a
// vendor payout log and a gateway settlement/refund log. Deliberately NOT
// connected to the existing accounting system (AccountingTransaction,
// Settlement, Payout, CommissionRule, WalletTransaction, AccountingConfig,
// AccountingAuditLog and their controllers) — this is a separate, simpler
// surface built on Order + two new models only.
//
// Money is stored in the database in rupees like the rest of this backend
// (see backend/utils/money.js), and scaled up to integer paise only on the
// way out here, matching adminOrderController's convention — the admin panel
// always renders paise (see frontend formatMoney).

function dateRangeFilter(query) {
  const filter = {};
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!Number.isNaN(start.getTime())) filter.createdAt.$gte = start;
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }
  return filter;
}

async function getDashboardSummary(req, res) {
  try {
    const range = dateRangeFilter(req.query);
    const paidMatch = { paymentStatus: 'PAID', ...range };

    const [orderTotals, vendorCostAgg, refundAgg, pendingPayoutRows] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: null, totalRevenue: { $sum: '$total' }, orderCount: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        { $group: { _id: null, totalVendorCost: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      ]),
      GatewayTransaction.aggregate([
        { $match: { type: 'REFUND', ...(range.createdAt ? { occurredAt: range.createdAt } : {}) } },
        { $group: { _id: null, totalRefunds: { $sum: '$amount' } } },
      ]),
      // Pending payouts: not scoped to the date range — it's a running
      // obligation, not a per-window figure.
      computePendingPayouts(),
    ]);

    const totalRevenue = orderTotals[0]?.totalRevenue || 0;
    const orderCount = orderTotals[0]?.orderCount || 0;
    const totalVendorCost = vendorCostAgg[0]?.totalVendorCost || 0;
    const totalRefunds = refundAgg[0]?.totalRefunds || 0;
    // No fee field exists on Order — kept at 0 rather than inventing one.
    const totalGatewayFee = 0;
    const netProfit = totalRevenue - totalVendorCost - totalGatewayFee - totalRefunds;
    const pendingPayoutTotal = pendingPayoutRows.reduce((sum, row) => sum + Math.max(0, row.pending), 0);

    res.json({
      success: true,
      data: {
        totalRevenue: toPaise(totalRevenue),
        totalVendorCost: toPaise(totalVendorCost),
        totalGatewayFee: toPaise(totalGatewayFee),
        totalRefunds: toPaise(totalRefunds),
        netProfit: toPaise(netProfit),
        pendingPayoutTotal: toPaise(pendingPayoutTotal),
        orderCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load dashboard summary' });
  }
}

// Shared by getVendorPayoutSummary and the dashboard's pendingPayoutTotal.
// Returns [{ vendorId, owed, paid, pending }] for every vendor with any
// PAID order line, sorted by pending balance desc.
async function computePendingPayouts(vendorId) {
  const orderMatch = { paymentStatus: 'PAID' };
  if (vendorId) orderMatch['items.vendor'] = new mongoose.Types.ObjectId(vendorId);

  const [owedRows, paidRows] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $unwind: '$items' },
      ...(vendorId ? [{ $match: { 'items.vendor': new mongoose.Types.ObjectId(vendorId) } }] : []),
      { $match: { 'items.vendor': { $ne: null } } },
      { $group: { _id: '$items.vendor', owed: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    ]),
    VendorPayout.aggregate([
      ...(vendorId ? [{ $match: { vendor: new mongoose.Types.ObjectId(vendorId) } }] : []),
      { $group: { _id: '$vendor', paid: { $sum: '$amount' } } },
    ]),
  ]);

  const paidByVendor = new Map(paidRows.map((row) => [String(row._id), row.paid]));
  const rows = owedRows.map((row) => {
    const owed = row.owed || 0;
    const paid = paidByVendor.get(String(row._id)) || 0;
    return { vendorId: row._id, owed, paid, pending: owed - paid };
  });

  // Vendors that have been paid but currently have no PAID-order lines in
  // range still deserve a row (pending will be negative/zero).
  paidRows.forEach((row) => {
    if (!rows.some((r) => String(r.vendorId) === String(row._id))) {
      rows.push({ vendorId: row._id, owed: 0, paid: row.paid, pending: -row.paid });
    }
  });

  return rows.sort((a, b) => b.pending - a.pending);
}

async function listVendorPayouts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (req.query.vendor) filter.vendor = req.query.vendor;

    const [items, totalItems] = await Promise.all([
      VendorPayout.find(filter)
        .populate('vendor', 'name email')
        .sort({ paidAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VendorPayout.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((p) => ({
          id: p._id.toString(),
          vendor: p.vendor ? { id: p.vendor._id.toString(), name: p.vendor.name, email: p.vendor.email } : null,
          amount: toPaise(p.amount),
          paidAt: p.paidAt,
          method: p.method,
          note: p.note || '',
          createdAt: p.createdAt,
        })),
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list vendor payouts' });
  }
}

async function createVendorPayout(req, res) {
  try {
    const { vendor, amount, method, note, paidAt } = req.body;
    if (!vendor) return res.status(400).json({ success: false, message: 'vendor is required' });
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0' });
    }

    const vendorDoc = await Vendor.findById(vendor).select('_id');
    if (!vendorDoc) return res.status(400).json({ success: false, message: 'Vendor not found' });

    const payout = await VendorPayout.create({
      vendor,
      amount: numericAmount,
      method: VendorPayout.METHODS.includes(method) ? method : 'OTHER',
      note: note || '',
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      createdBy: req.admin?._id || req.admin?.id || null,
    });

    res.status(201).json({
      success: true,
      data: {
        id: payout._id.toString(),
        vendor: payout.vendor.toString(),
        amount: toPaise(payout.amount),
        paidAt: payout.paidAt,
        method: payout.method,
        note: payout.note,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create vendor payout' });
  }
}

async function getVendorPayoutSummary(req, res) {
  try {
    const rows = await computePendingPayouts(req.query.vendorId);
    const vendorIds = rows.map((r) => r.vendorId).filter(Boolean);
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('name email').lean();
    const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

    res.json({
      success: true,
      data: {
        items: rows.map((row) => ({
          vendor: vendorMap.has(String(row.vendorId))
            ? { id: String(row.vendorId), name: vendorMap.get(String(row.vendorId)).name, email: vendorMap.get(String(row.vendorId)).email }
            : { id: String(row.vendorId), name: 'Unknown vendor', email: '' },
          totalOwed: toPaise(row.owed),
          totalPaid: toPaise(row.paid),
          pendingBalance: toPaise(row.pending),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load vendor payout summary' });
  }
}

async function listTransactions(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (req.query.type && GatewayTransaction.TYPES.includes(req.query.type)) filter.type = req.query.type;
    const range = dateRangeFilter({ startDate: req.query.startDate, endDate: req.query.endDate });
    if (range.createdAt) filter.occurredAt = range.createdAt;

    const [items, totalItems] = await Promise.all([
      GatewayTransaction.find(filter)
        .populate('order', 'total')
        .sort({ occurredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GatewayTransaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((t) => ({
          id: t._id.toString(),
          order: t.order ? { id: t.order._id.toString(), total: toPaise(t.order.total) } : null,
          type: t.type,
          amount: toPaise(t.amount),
          gateway: t.gateway,
          referenceId: t.referenceId || '',
          occurredAt: t.occurredAt,
          note: t.note || '',
        })),
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list transactions' });
  }
}

async function createTransaction(req, res) {
  try {
    const { order, type, amount, gateway, referenceId, note, occurredAt } = req.body;
    if (!order) return res.status(400).json({ success: false, message: 'order is required' });
    if (!GatewayTransaction.TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of ${GatewayTransaction.TYPES.join(', ')}` });
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0' });
    }

    const orderDoc = await Order.findById(order).select('_id');
    if (!orderDoc) return res.status(400).json({ success: false, message: 'Order not found' });

    const txn = await GatewayTransaction.create({
      order,
      type,
      amount: numericAmount,
      gateway: gateway || 'RAZORPAY',
      referenceId: referenceId || '',
      note: note || '',
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: txn._id.toString(),
        order: txn.order.toString(),
        type: txn.type,
        amount: toPaise(txn.amount),
        gateway: txn.gateway,
        referenceId: txn.referenceId,
        occurredAt: txn.occurredAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create transaction' });
  }
}

// Ledger — one row per order with its full financial breakdown. Read-only;
// reuses the same per-order vendor-cost math as getDashboardSummary above,
// just kept per-order instead of summed, plus a $lookup against
// GatewayTransaction for that order's refunds.
async function listLedger(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const range = dateRangeFilter(req.query);
    const match = { paymentStatus: 'PAID', ...range };

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          vendorCost: {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: { $multiply: ['$$item.price', '$$item.quantity'] },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'gatewaytransactions',
          let: { orderId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$order', '$$orderId'] }, { $eq: ['$type', 'REFUND'] }] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ],
          as: 'refundAgg',
        },
      },
      {
        $addFields: {
          refunds: { $ifNull: [{ $arrayElemAt: ['$refundAgg.total', 0] }, 0] },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                total: 1,
                vendorCost: 1,
                refunds: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Order.aggregate(pipeline);
    const rows = result?.rows || [];
    const totalItems = result?.totalCount?.[0]?.count || 0;
    // No fee field exists on Order — kept at 0, same as the dashboard.
    const gatewayFee = 0;

    res.json({
      success: true,
      data: {
        items: rows.map((row) => {
          const profit = row.total - row.vendorCost - gatewayFee - row.refunds;
          return {
            id: row._id.toString(),
            createdAt: row.createdAt,
            total: toPaise(row.total),
            vendorCost: toPaise(row.vendorCost),
            gatewayFee: toPaise(gatewayFee),
            refunds: toPaise(row.refunds),
            profit: toPaise(profit),
          };
        }),
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load ledger' });
  }
}

module.exports = {
  getDashboardSummary,
  listVendorPayouts,
  createVendorPayout,
  getVendorPayoutSummary,
  listTransactions,
  createTransaction,
  listLedger,
};
