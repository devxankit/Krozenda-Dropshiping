const CjOrder = require('../Models/CjOrder');
const Order = require('../Models/Order');
const cjOrderService = require('../services/cj/cjOrderService');

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
async function cancelOrder(req, res) {
  const order = await CjOrder.findById(req.params.id);
  if (!order?.cjOrderId) {
    return res.status(400).json({ success: false, message: 'This CJ order has no cjOrderId yet' });
  }

  try {
    const updated = await cjOrderService.cancelOrder(order.cjOrderId);
    res.json({ success: true, message: 'CJ order cancelled', data: updated });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message });
  }
}

module.exports = { listOrders, getOrder, refreshStatus, cancelOrder };
