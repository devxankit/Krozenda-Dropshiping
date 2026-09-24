const CjOrder = require('../Models/CjOrder');
const Order = require('../Models/Order');
const cjOrderService = require('../services/cj/cjOrderService');
const dropshipOrderService = require('../services/dropshipOrderService');

// GET /admin/cj/orders?status=&pageNum=&pageSize=
async function listOrders(req, res) {
  const { status } = req.query;
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
  const filter = status ? { status } : {};

  const [rows, total] = await Promise.all([
    CjOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate('krozendaOrderId', 'status paymentStatus createdAt'),
    CjOrder.countDocuments(filter),
  ]);

  res.json({ success: true, data: { list: rows, pageNum, pageSize, total } });
}

// GET /admin/cj/orders/:id
async function getOrder(req, res) {
  const order = await CjOrder.findById(req.params.id).populate('krozendaOrderId');
  if (!order) return res.status(404).json({ success: false, message: 'CJ order not found' });
  res.json({ success: true, data: order });
}

// POST /admin/cj/orders/:id/refresh-status
async function refreshStatus(req, res) {
  const order = await CjOrder.findById(req.params.id);
  const identifier = order?.cjOrderId || order?.krozendaSubOrderId;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'This CJ order has no identifier yet' });
  }

  try {
    const updated = await cjOrderService.refreshOrderStatus(identifier);
    res.json({ success: true, message: 'Status refreshed', data: updated });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message });
  }
}

// POST /admin/cj/orders/:id/cancel
//
// Cancels the whole thing, not just CJ's side: the CJ order, then the buyer's
// Krozenda order, and refunds the buyer to their original payment. Cancelling
// only at CJ used to leave a paid order that would never arrive.
async function cancelOrder(req, res) {
  const order = await CjOrder.findById(req.params.id);
  if (!order?.cjOrderId) {
    return res.status(400).json({ success: false, message: 'This CJ order has no cjOrderId yet' });
  }

  const parent = order.krozendaOrderId ? await Order.findById(order.krozendaOrderId).select('status').lean() : null;
  if (parent && parent.status !== 'CANCELLED') {
    const result = await dropshipOrderService.adminCancel({ orderId: order.krozendaOrderId });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, message: 'CJ order cancelled and the buyer refunded', data: await CjOrder.findById(order._id) });
  }

  // The buyer's order is already cancelled (or gone): only CJ's side is left.
  try {
    const updated = await cjOrderService.cancelOrder(order.cjOrderId);
    res.json({ success: true, message: 'CJ order cancelled', data: updated });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message });
  }
}

module.exports = { listOrders, getOrder, refreshStatus, cancelOrder };
