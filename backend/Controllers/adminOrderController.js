const mongoose = require('mongoose');
const Order = require('../Models/Order');
const { serializeOrder } = require('./orderController');

// Minimal admin surface — just enough to progress an order's status
// (needed before a product becomes reviewable). No dedicated admin screen
// exists yet; the full fulfilment UI (shipments/RTO/returns/invoices) stays
// on its current mock fixtures.
async function listOrders(req, res) {
  const { status } = req.query;
  const filter = {};
  if (status && Order.STATUSES.includes(status)) {
    filter.status = status;
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('user', 'name mobileNumber email');
  res.json({
    success: true,
    data: {
      items: orders.map((o) => ({
        ...serializeOrder(o),
        customer: {
          name: o.user?.name || '',
          mobileNumber: o.user?.mobileNumber || '',
          email: o.user?.email || '',
        },
      })),
    },
  });
}

async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }
  if (!Order.STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  order.status = status;
  if (status === 'DELIVERED') {
    order.deliveredAt = order.deliveredAt || new Date();
  }
  await order.save();

  res.json({ success: true, message: 'Order status updated', data: serializeOrder(order) });
}

module.exports = { listOrders, updateOrderStatus };
