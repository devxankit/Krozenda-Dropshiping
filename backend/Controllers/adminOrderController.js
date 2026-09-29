const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const { serializeOrder, releaseStock, reserveStock, notifyVendorsOfNewOrder } = require('./orderController');
const { createNotification } = require('./notificationController');
const { toPaise } = require('../utils/money');
const accounting = require('../services/accountingPosting');
const dropshipOrderService = require('../services/dropshipOrderService');
const { refundCancelledOrderToWallet } = require('../services/orderCancellationService');
const { isDropshipOrder } = require('../utils/dropship');

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
// Forward order of a line; CANCELLED is not on it.
const LINE_STAGES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function withCustomer(o) {
  const serialized = serializeOrder(o);
  return {
    ...serialized,
    // Line state for the admin: its own status, and whether its delivery is
    // only the seller's word (held from payout until confirmed — see
    // adminFulfilmentController.confirmSubOrderDelivery, keyed by subOrderId).
    items: serialized.items.map((item, index) => {
      const line = o.items[index] || {};
      return {
        ...item,
        price: toPaise(item.price),
        status: line.status || 'PENDING',
        deliveryConfirmedBy: line.deliveryConfirmedBy || null,
        awaitingDeliveryConfirmation: line.status === 'DELIVERED' && line.deliveryConfirmedBy === 'SELLER',
        subOrderId: `${o._id}:${line.product}:${line.variantId || ''}`,
      };
    }),
    subtotal: toPaise(serialized.subtotal),
    discountAmount: toPaise(serialized.discountAmount),
    shippingFee: toPaise(serialized.shippingFee),
    platformFee: toPaise(serialized.platformFee || 0),
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

  // Lines a seller marked delivered themselves, waiting for an admin (or
  // the carrier) to confirm before they can be paid out.
  const AWAITING_CONFIRMATION = { items: { $elemMatch: { status: 'DELIVERED', deliveryConfirmedBy: 'SELLER' } } };
  const effectiveStatus = status || (tab && tab !== 'all' ? tab.toUpperCase() : null);
  if (tab === 'delivery_unconfirmed') {
    Object.assign(filter, AWAITING_CONFIRMATION);
  } else if (effectiveStatus && Order.STATUSES.includes(effectiveStatus)) {
    filter.status = effectiveStatus;
  }

  // Search: order id fragment, or the buyer's name / mobile / email. Buyers
  // are matched first (small set), then their orders — rather than loading
  // every order with its buyer and filtering in memory, which is what this
  // did before (load test: timeouts under 10 admins).
  const term = String(search || '').trim().slice(0, 100);
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    const buyerIds = await Customer.find({ $or: [{ name: re }, { mobileNumber: re }, { email: re }] }).distinct('_id');
    filter.$or = [
      { user: { $in: buyerIds } },
      { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: escaped, options: 'i' } } },
    ];
  }

  // Sortable on the order's own fields; anything else is newest first.
  const SORT_FIELDS = { placedAt: 'createdAt', createdAt: 'createdAt', total: 'total', subtotal: 'subtotal', status: 'status', paymentStatus: 'paymentStatus', paymentMethod: 'paymentMethod' };
  const [sortKey, direction] = String(sort || '').split(':');
  const sortSpec = SORT_FIELDS[sortKey]
    ? { [SORT_FIELDS[sortKey]]: direction === 'asc' ? 1 : -1, _id: direction === 'asc' ? 1 : -1 }
    : { createdAt: -1, _id: -1 };

  const perPage = Math.min(100, Math.max(1, Number(rowsPerPage) || 25));
  const currentPage = Math.min(500, Math.max(1, Number(page) || 1));

  const [orders, totalItems, tabCountsRaw, awaitingConfirmation] = await Promise.all([
    Order.find(filter)
      .sort(sortSpec)
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .populate('user', 'name mobileNumber email'),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.countDocuments(AWAITING_CONFIRMATION),
  ]);

  const tabCounts = { all: 0 };
  for (const s of Order.STATUSES) tabCounts[s.toLowerCase()] = 0;
  for (const row of tabCountsRaw) {
    tabCounts.all += row.count;
    if (row._id) tabCounts[row._id.toLowerCase()] = row.count;
  }
  tabCounts.delivery_unconfirmed = awaitingConfirmation;

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  res.json({
    success: true,
    data: {
      items: orders.map(withCustomer),
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
    // Seller lines get their commission terms frozen on, as at checkout.
    const [draft] = await accounting.attachCommissionSnapshots([{
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
    }]);
    order = await Order.create(draft);
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

  // A dropshipping order is cancelled at CJ first and refunded to the buyer's
  // original payment — never to the wallet, which cannot pay for dropship
  // items. That flow lives in dropshipOrderService.
  if (status === 'CANCELLED') {
    const target = await Order.findById(id).select('fulfillmentType checkoutGroupId items.product').lean();
    if (target && (await isDropshipOrder(target))) {
      const result = await dropshipOrderService.adminCancel({ orderId: id });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, message: result.message });
      }
      const cancelled = await Order.findById(id).populate('user', 'name mobileNumber email');
      return res.json({ success: true, message: 'Order cancelled and refunded', data: withCustomer(cancelled) });
    }
  }

  const update = { $push: { statusHistory: { status, at: new Date() } } };
  const setFields = { status };
  if (status === 'DELIVERED') setFields.deliveredAt = new Date();
  if (status === 'CANCELLED') {
    setFields.cancelledBy = 'admin';
    // The lines go with the order (see the buyer cancel in orderController).
    setFields['items.$[live].status'] = 'CANCELLED';
  }
  // Moving the order forward moves its lines that are behind with it. Before,
  // the lines stayed where they were: an order marked DELIVERED kept PENDING
  // lines, which the seller panel showed as open and settlement never paid.
  const behind = LINE_STAGES.includes(status) ? LINE_STAGES.slice(0, LINE_STAGES.indexOf(status)) : [];
  if (behind.length > 0) setFields['items.$[behind].status'] = status;
  // An admin marking the order delivered confirms every live line's delivery
  // — including lines a seller had already marked delivered themselves.
  if (status === 'DELIVERED') setFields['items.$[delivered].deliveryConfirmedBy'] = 'ADMIN';
  update.$set = setFields;

  const arrayFilters =
    status === 'CANCELLED'
      ? [{ 'live.status': { $nin: ['CANCELLED', 'DELIVERED'] } }]
      : behind.length > 0 || status === 'DELIVERED'
        ? [
            ...(behind.length > 0 ? [{ 'behind.status': { $in: behind } }] : []),
            ...(status === 'DELIVERED' ? [{ 'delivered.status': { $ne: 'CANCELLED' } }] : []),
          ]
        : null;
  const order = await Order.findOneAndUpdate(
    { _id: id, status: { $in: fromStatuses } },
    update,
    arrayFilters ? { new: true, arrayFilters } : { new: true }
  );

  if (!order) {
    const exists = await Order.exists({ _id: id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? `Order cannot be moved to ${status} from its current state` : 'Order not found',
    });
  }

  // Delivered COD: the buyer has paid the courier (see Order's
  // markCodPaidOnDelivery — a findOneAndUpdate skips save hooks).
  if (status === 'DELIVERED' && order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING') {
    await Order.updateOne({ _id: order._id, paymentStatus: 'PENDING' }, { $set: { paymentStatus: 'PAID' } });
    order.paymentStatus = 'PAID';
  }

  if (status === 'CANCELLED') {
    // Only lines still live: a line cancelled on its own already gave its stock back.
    await releaseStock(order.items.filter((item) => item.status !== 'CANCELLED'));
    // Stop the courier as well.
    await require('../services/shipping/shipmentService').cancelShipmentsForOrder({
      orderId: order._id,
      reason: 'Cancelled by admin',
      actor: 'ADMIN',
    });
    if (order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD') {
      // What is still owed: lines cancelled on their own were refunded already.
      await refundCancelledOrderToWallet(order);

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
    await dropshipOrderService.releaseCouponIfWholeCheckoutCancelled({ ...order.toObject(), status: 'CANCELLED' });
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

// DELETE /admin/orders/:id — super admin. Only a cancelled order no money
// ever moved for; see services/orderDeletionService for the full rule.
async function deleteOrder(req, res) {
  const result = await require('../services/orderDeletionService').deleteOrder({ orderId: req.params.id });
  if (!result.ok) return res.status(result.status).json({ success: false, code: result.code, message: result.message });
  res.json({ success: true, message: 'Order deleted', data: result.deleted });
}

module.exports = { listOrders, getOrder, createOrder, updateOrderStatus, deleteOrder };
