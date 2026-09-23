const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const WalletTransaction = require('../Models/WalletTransaction');
const { serializeOrder, releaseStock, reserveStock, notifyVendorsOfNewOrder } = require('./orderController');
const { createNotification } = require('./notificationController');
const { toPaise } = require('../utils/money');
const accounting = require('../services/accountingPosting');

const STATUS_NOTIFICATION = {
  PROCESSING: { title: 'Order Processing', message: (o) => `Your order #${o._id.toString().slice(-8).toUpperCase()} is now being processed.` },
  SHIPPED: { title: 'Shipment Dispatched', message: (o) => `Your order #${o._id.toString().slice(-8).toUpperCase()} has been shipped.` },
  DELIVERED: { title: 'Order Delivered', message: (o) => `Your order #${o._id.toString().slice(-8).toUpperCase()} has been delivered. Enjoyed it? Leave a review!` },
  CANCELLED: { title: 'Order Cancelled', message: (o) => `Your order #${o._id.toString().slice(-8).toUpperCase()} has been cancelled.` },
};

// Only these forward moves are legal — e.g. DELIVERED can never be walked
// back to PROCESSING, and a terminal state (DELIVERED/CANCELLED) can never
// be left. Keyed by the target status, valued by the statuses it may be
// entered from.
const VALID_FROM_STATUSES = {
  PROCESSING: ['PENDING'],
  SHIPPED: ['PROCESSING'],
  DELIVERED: ['SHIPPED'],
  CANCELLED: ['PENDING', 'PROCESSING', 'SHIPPED'],
};

function withCustomer(o) {
  const serialized = serializeOrder(o);
  return {
    ...serialized,
    items: serialized.items.map((item) => ({ ...item, price: toPaise(item.price) })),
    subtotal: toPaise(serialized.subtotal),
    discountAmount: toPaise(serialized.discountAmount),
    shippingFee: toPaise(serialized.shippingFee),
    total: toPaise(serialized.total),
    customer: {
      id: o.user?._id ? o.user._id.toString() : (o.user ? o.user.toString() : null),
      name: o.user?.name || '',
      mobileNumber: o.user?.mobileNumber || '',
      email: o.user?.email || '',
    },
  };
}

// Admin surface — list (with tab/status/search paging), detail, status
// transition, and admin-initiated order creation. Sub-order/commission/GST/
// shipment concepts don't exist on this platform's Order model, so this
// stays a flat list of orders, each already scoped to one vendor's items.
async function listOrders(req, res) {
  const { tab, status, search, page = 1, rowsPerPage = 25, sort } = req.query;
  const filter = {};

  const effectiveStatus = status || (tab && tab !== 'all' ? tab.toUpperCase() : null);
  if (effectiveStatus && Order.STATUSES.includes(effectiveStatus)) {
    filter.status = effectiveStatus;
  }

  const [orders, tabCountsRaw] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).populate('user', 'name mobileNumber email'),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const tabCounts = { all: 0 };
  for (const s of Order.STATUSES) tabCounts[s.toLowerCase()] = 0;
  for (const row of tabCountsRaw) {
    tabCounts.all += row.count;
    if (row._id) tabCounts[row._id.toLowerCase()] = row.count;
  }

  let items = orders.map(withCustomer);

  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (o) =>
        o.id.toLowerCase().includes(term) ||
        o.customer.name.toLowerCase().includes(term) ||
        o.customer.mobileNumber.toLowerCase().includes(term) ||
        o.customer.email.toLowerCase().includes(term)
    );
  }

  if (sort) {
    const [key, direction] = String(sort).split(':');
    const dir = direction === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const left = key === 'placedAt' ? a.createdAt : a[key];
      const right = key === 'placedAt' ? b.createdAt : b[key];
      if (left === right) return 0;
      return left > right ? dir : -dir;
    });
  }

  const totalItems = items.length;
  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;

  res.json({
    success: true,
    data: {
      items: items.slice(start, start + perPage),
      page: currentPage,
      rowsPerPage: perPage,
      totalItems,
      totalPages,
      tabCounts,
    },
  });
}

// GET /admin/orders/:id — single order with customer details attached.
async function getOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findById(id).populate('user', 'name mobileNumber email');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: withCustomer(order) });
}

// POST /admin/orders — admin places an order on a customer's behalf (phone
// orders, manual corrections, etc). Prices are always re-read from the live
// Product record, never trusted from the request, same rule as the
// customer-facing checkout in orderController.
async function createOrder(req, res) {
  const { userId, items: requestedItems, shippingAddress, paymentMethod, shippingFee } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Select a valid customer' });
  }
  if (!Order.PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Select a valid payment method' });
  }
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    return res.status(400).json({ success: false, message: 'Add at least one item' });
  }
  const requiredAddressFields = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'];
  if (!shippingAddress || requiredAddressFields.some((f) => !shippingAddress[f])) {
    return res.status(400).json({ success: false, message: 'Fill in the full delivery address' });
  }

  const user = await Customer.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  const items = [];
  for (const entry of requestedItems) {
    if (!mongoose.isValidObjectId(entry.productId) || !(Number(entry.quantity) > 0)) {
      return res.status(400).json({ success: false, message: 'Invalid item in order' });
    }
    const product = await Product.findOne({ _id: entry.productId, isActive: true });
    if (!product) {
      return res.status(400).json({ success: false, message: 'One of the selected products is unavailable' });
    }
    items.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0] || null,
      price: product.salePrice ?? product.price ?? 0,
      quantity: Number(entry.quantity),
      variant: entry.variant || '',
      vendor: product.vendor || null,
    });
  }

  const reservation = await reserveStock(items);
  if (!reservation.ok) {
    return res.status(409).json({ success: false, message: `"${reservation.productName}" does not have enough stock.` });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = Number(shippingFee) > 0 ? Number(shippingFee) : 0;
  const total = Math.max(0, subtotal + shipping);

  let order;
  try {
    order = await Order.create({
      user: userId,
      items,
      shippingAddress: {
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        country: shippingAddress.country || 'India',
      },
      subtotal,
      discountAmount: 0,
      couponCode: null,
      shippingFee: shipping,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      status: 'PENDING',
    });
  } catch (err) {
    await releaseStock(items);
    throw err;
  }

  await createNotification({
    userId,
    type: 'ORDER',
    title: 'Order Placed',
    message: `An order for ${items.length} item(s) worth ₹${total.toLocaleString('en-IN')} was placed for you.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  await notifyVendorsOfNewOrder(items, order._id);

  const populated = await order.populate('user', 'name mobileNumber email');
  res.status(201).json({ success: true, message: 'Order created', data: withCustomer(populated) });
}

// PATCH /admin/orders/:id/status — transition is validated and applied
// atomically (the status-guarded findOneAndUpdate below), so two concurrent
// requests (or a slow double-click) can't both succeed and, on CANCELLED,
// can't both restore stock / refund the wallet twice.
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }
  const fromStatuses = VALID_FROM_STATUSES[status];
  if (!fromStatuses) {
    return res.status(400).json({ success: false, message: 'Invalid target status' });
  }

  const update = { $push: { statusHistory: { status, at: new Date() } } };
  const setFields = { status };
  if (status === 'DELIVERED') setFields.deliveredAt = new Date();
  if (status === 'CANCELLED') setFields.cancelledBy = 'admin';
  update.$set = setFields;

  const order = await Order.findOneAndUpdate(
    { _id: id, status: { $in: fromStatuses } },
    update,
    { new: true }
  );

  if (!order) {
    const exists = await Order.exists({ _id: id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? `Order cannot be moved to ${status} from its current state` : 'Order not found',
    });
  }

  if (status === 'CANCELLED') {
    await releaseStock(order.items);
    if (order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD') {
      const refundedCustomer = await Customer.findOneAndUpdate(
        { _id: order.user },
        { $inc: { walletBalance: order.total } },
        { new: true }
      );
      await WalletTransaction.create({
        user: order.user,
        type: 'CREDIT',
        amount: order.total,
        balanceAfter: refundedCustomer.walletBalance,
        source: 'ORDER_REFUND',
        orderId: order._id,
        status: 'SUCCESS',
      });
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });

      // Reverse the posted sale. Never fatal — the buyer's wallet has already
      // been credited, and every posting path is idempotent, so a failure
      // here is picked up by the reconciler the next time an Accounting
      // screen is opened.
      try {
        await accounting.postOrderCancellationRefund({
          order: { ...order.toObject(), paymentStatus: 'REFUNDED' },
          createdBy: req.admin?._id || null,
        });
      } catch (err) {
        console.error('Accounting posting failed (admin cancellation), will be reconciled on next read:', err.message);
      }
    }
  }

  const notif = STATUS_NOTIFICATION[status];
  if (notif) {
    await createNotification({
      userId: order.user,
      type: 'ORDER',
      title: notif.title,
      message: notif.message(order),
      actionType: 'ORDER',
      actionRefId: order._id,
    });
  }

  const populated = await order.populate('user', 'name mobileNumber email');
  res.json({ success: true, message: 'Order status updated', data: withCustomer(populated) });
}

module.exports = { listOrders, getOrder, createOrder, updateOrderStatus };
