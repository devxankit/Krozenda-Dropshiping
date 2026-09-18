const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { toPaise } = require('../utils/money');
const { createNotification } = require('./notificationController');

// Only these forward moves are legal for a single line item — mirrors
// adminOrderController's order-level transition table, applied per item
// since a vendor only owns their own items in a possibly multi-vendor order.
const VALID_FROM_STATUSES = {
  PROCESSING: ['PENDING'],
  SHIPPED: ['PROCESSING'],
  DELIVERED: ['SHIPPED'],
  CANCELLED: ['PENDING', 'PROCESSING'],
};

// Only this vendor's own items are ever returned — a multi-vendor order
// never leaks another seller's line items, pricing or fulfilment state.
function serializeVendorOrder(order, vendorId) {
  const myItems = order.items.filter((item) => item.vendor && item.vendor.toString() === vendorId);
  const myTotal = myItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    id: order._id.toString(),
    orderId: order._id.toString(),
    customer: {
      name: order.user?.name || '',
      mobileNumber: order.user?.mobileNumber || '',
    },
    shippingAddress: order.shippingAddress,
    items: myItems.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      price: toPaise(item.price),
      quantity: item.quantity,
      variant: item.variant || '',
      status: item.status || 'PENDING',
      acceptedAt: item.acceptedAt || null,
      rejectionReason: item.rejectionReason || '',
      courierName: item.courierName || '',
      trackingNumber: item.trackingNumber || '',
      statusHistory: (item.statusHistory || []).map((h) => ({ status: h.status, at: h.at })),
    })),
    itemsValue: toPaise(myTotal),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    // Aggregate status across only this vendor's own items — the order-level
    // `status` field belongs to admin/the buyer's full cart, not one seller.
    status: myItems.every((i) => i.status === 'DELIVERED')
      ? 'DELIVERED'
      : myItems.some((i) => i.status === 'CANCELLED') && myItems.every((i) => ['CANCELLED', 'DELIVERED'].includes(i.status))
        ? 'CANCELLED'
        : myItems.some((i) => i.status === 'SHIPPED')
          ? 'SHIPPED'
          : myItems.some((i) => i.status === 'PROCESSING')
            ? 'PROCESSING'
            : 'PENDING',
    createdAt: order.createdAt,
  };
}

async function listMyOrders(req, res) {
  const { tab, status, search, page = 1, rowsPerPage = 25 } = req.query;
  const vendorId = req.vendor._id.toString();

  const orders = await Order.find({ 'items.vendor': req.vendor._id })
    .populate('user', 'name mobileNumber email')
    .sort({ createdAt: -1 });

  const allSerialized = orders.map((o) => serializeVendorOrder(o, vendorId));

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (o) =>
        o.id.toLowerCase().includes(term) ||
        o.customer.name.toLowerCase().includes(term) ||
        o.items.some((i) => i.name.toLowerCase().includes(term))
    );
  }

  const effectiveStatus = status || (tab && tab !== 'all' ? tab.toUpperCase() : null);
  if (effectiveStatus && Order.STATUSES.includes(effectiveStatus)) {
    items = items.filter((o) => o.status === effectiveStatus);
  }

  const tabCounts = { all: allSerialized.length };
  for (const s of Order.STATUSES) tabCounts[s.toLowerCase()] = allSerialized.filter((o) => o.status === s).length;

  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
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

async function getMyOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOne({ _id: id, 'items.vendor': req.vendor._id }).populate('user', 'name mobileNumber email');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: serializeVendorOrder(order, req.vendor._id.toString()) });
}

// PATCH /vendor/orders/:id/items/:productId/status — moves ONE of the
// vendor's own line items forward; guarded the same way adminOrderController
// guards the whole order, but scoped to the matching array element via the
// positional $ operator so this can never touch another seller's item.
async function updateMyOrderItemStatus(req, res) {
  const { id, productId } = req.params;
  const { status, courierName, trackingNumber, reason } = req.body;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid order or product id' });
  }
  const fromStatuses = VALID_FROM_STATUSES[status];
  if (!fromStatuses) {
    return res.status(400).json({ success: false, message: 'Invalid target status' });
  }

  const order = await Order.findOne({ _id: id, 'items.vendor': req.vendor._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const item = order.items.find(
    (i) => i.product.toString() === productId && i.vendor && i.vendor.toString() === req.vendor._id.toString()
  );
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item not found on this order' });
  }
  if (!fromStatuses.includes(item.status)) {
    return res.status(400).json({ success: false, message: `Item cannot be moved to ${status} from its current state` });
  }
  if (status === 'SHIPPED' && !trackingNumber?.trim()) {
    return res.status(400).json({ success: false, message: 'Tracking number is required to mark an item shipped' });
  }

  // Rejecting a line is the one transition here that costs the buyer
  // something, so it has to come with a reason. "Cancelled" on its own tells
  // them nothing and leaves support guessing.
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (status === 'CANCELLED' && !trimmedReason) {
    return res.status(400).json({
      success: false,
      message: 'Give a reason for cancelling this item — the buyer is told what it is.',
    });
  }

  item.status = status;
  item.statusHistory.push({ status, at: new Date() });
  // PENDING -> PROCESSING is the acceptance. Stamped once, and never
  // overwritten by a later move down the chain.
  if (status === 'PROCESSING' && !item.acceptedAt) item.acceptedAt = new Date();
  if (status === 'CANCELLED') item.rejectionReason = trimmedReason.slice(0, 500);
  if (courierName !== undefined) item.courierName = courierName.trim();
  if (trackingNumber !== undefined) item.trackingNumber = trackingNumber.trim();

  await order.save();

  // Stock was decremented when the order was placed (orderController.
  // reserveStock). A cancelled line has to give it back, or every seller
  // rejection permanently burns inventory that was never shipped. Variant-
  // aware for the same reason releaseStock is: the reservation came off a
  // specific variant and has to go back to it.
  if (status === 'CANCELLED') {
    if (item.variantId) {
      await Product.updateOne(
        { _id: item.product, 'variants._id': item.variantId },
        { $inc: { 'variants.$.stock': item.quantity } }
      );
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
    }
  }

  await createNotification({
    userId: order.user,
    type: 'ORDER',
    title:
      status === 'CANCELLED'
        ? 'Order Item Cancelled'
        : `Order Item ${status === 'SHIPPED' ? 'Shipped' : status.charAt(0) + status.slice(1).toLowerCase()}`,
    message:
      status === 'CANCELLED'
        ? `"${item.name}" was cancelled by the seller: ${trimmedReason}`
        : `"${item.name}" from your order is now ${status.toLowerCase()}.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  const populated = await order.populate('user', 'name mobileNumber email');
  res.json({ success: true, message: 'Item status updated', data: serializeVendorOrder(populated, req.vendor._id.toString()) });
}

module.exports = { listMyOrders, getMyOrder, updateMyOrderItemStatus, serializeVendorOrder };
