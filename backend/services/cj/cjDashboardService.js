const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const CjOrder = require('../../Models/CjOrder');
const CjDispute = require('../../Models/CjDispute');
const CjSyncLog = require('../../Models/CjSyncLog');
const cjAccountService = require('./cjAccountService');

// Phase 8 — the admin CJ dashboard's summary cards (master plan §24). Pure
// read/aggregation, no writes — every number here is derived from documents
// the other CJ services already maintain.

const ORDER_PENDING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'];
const ORDER_IN_TRANSIT_STATUSES = ['PROCESSING', 'SHIPPED', 'IN_TRANSIT'];

async function getSummary() {
  const [
    totalProducts,
    outOfStockProducts,
    totalOrders,
    pendingFulfillment,
    inTransit,
    delivered,
    disputeCount,
    refundedDisputeCount,
    syncFailuresLast24h,
    balance,
  ] = await Promise.all([
    ProductFulfillmentMapping.countDocuments({ provider: 'CJ' }),
    ProductFulfillmentMapping.aggregate([
      { $match: { provider: 'CJ' } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { 'p.stock': { $lte: 0 } } },
      { $count: 'count' },
    ]).then((r) => r[0]?.count || 0),
    CjOrder.countDocuments({}),
    CjOrder.countDocuments({ status: { $in: ORDER_PENDING_STATUSES } }),
    CjOrder.countDocuments({ status: { $in: ORDER_IN_TRANSIT_STATUSES } }),
    CjOrder.countDocuments({ status: 'DELIVERED' }),
    CjDispute.countDocuments({}),
    CjDispute.countDocuments({ status: 'APPROVED' }),
    CjSyncLog.countDocuments({ status: 'FAILED', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    cjAccountService.getBalance().catch(() => null), // balance is a live CJ call — dashboard must still render if CJ is unreachable
  ]);

  return {
    products: {
      total: totalProducts,
      active: totalProducts - outOfStockProducts,
      outOfStock: outOfStockProducts,
    },
    orders: {
      total: totalOrders,
      pendingFulfillment,
      inTransit,
      delivered,
    },
    returns: {
      disputes: disputeCount,
      refundsApproved: refundedDisputeCount,
    },
    sync: {
      failuresLast24h: syncFailuresLast24h,
    },
    balance,
  };
}

module.exports = { getSummary };
