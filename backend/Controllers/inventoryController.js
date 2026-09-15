const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Order = require('../Models/Order');

// Orders in these states still hold their line items against the shelf —
// they haven't shipped yet, so that stock isn't free to sell again.
const OPEN_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED'];
const SALES_WINDOW_DAYS = 30;

const TAB_MATCHERS = {
  all: () => true,
  own_stock: (r) => r.bucket === 'own_stock',
  vendor: (r) => r.bucket === 'vendor',
  low: (r) => r.daysCover !== null && r.daysCover <= 7,
  out: (r) => r.onHand === 0,
};

function ownerName(vendor) {
  if (!vendor) return 'Admin';
  return vendor.businessName || vendor.name || 'Vendor';
}

function toRow(product, reserved, soldLast30) {
  const onHand = product.stock;
  const avgDaily = soldLast30 / SALES_WINDOW_DAYS;

  return {
    id: product._id.toString(),
    name: product.name,
    sku: product.sku || '—',
    bucket: product.vendor ? 'vendor' : 'own_stock',
    owner: ownerName(product.vendor),
    onHand,
    reserved,
    available: Math.max(0, onHand - reserved),
    daysCover: avgDaily > 0 ? Math.round(onHand / avgDaily) : null,
  };
}

// GET /admin/catalog/inventory — every product as a stock row, own-stock and
// vendor-owned counted the same way, with reserved (open orders) and days of
// cover (30-day delivered sales rate) computed on the fly.
async function listInventory(req, res, next) {
  try {
    const { tab = 'all', search, page = 1, rowsPerPage = 25, sort } = req.query;

    const products = await Product.find({}).populate('vendor', 'businessName name').lean();
    const productIds = products.map((p) => p._id);
    const since = new Date(Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [reservedAgg, soldAgg] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $in: OPEN_STATUSES }, 'items.product': { $in: productIds } } },
        { $unwind: '$items' },
        { $match: { 'items.product': { $in: productIds } } },
        { $group: { _id: '$items.product', qty: { $sum: '$items.quantity' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'DELIVERED', deliveredAt: { $gte: since }, 'items.product': { $in: productIds } } },
        { $unwind: '$items' },
        { $match: { 'items.product': { $in: productIds } } },
        { $group: { _id: '$items.product', qty: { $sum: '$items.quantity' } } },
      ]),
    ]);

    const reservedMap = new Map(reservedAgg.map((row) => [row._id.toString(), row.qty]));
    const soldMap = new Map(soldAgg.map((row) => [row._id.toString(), row.qty]));

    let rows = products.map((product) => {
      const id = product._id.toString();
      return toRow(product, reservedMap.get(id) || 0, soldMap.get(id) || 0);
    });

    const tabCounts = Object.fromEntries(
      Object.entries(TAB_MATCHERS).map(([key, matcher]) => [key, rows.filter(matcher).length])
    );

    rows = rows.filter(TAB_MATCHERS[tab] || TAB_MATCHERS.all);

    const term = (search || '').trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (row) => row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
      );
    }

    if (sort) {
      const [key, direction] = String(sort).split(':');
      const dir = direction === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        if (a[key] === b[key]) return 0;
        return a[key] > b[key] ? dir : -dir;
      });
    }

    const totalItems = rows.length;
    const perPage = Number(rowsPerPage) || 25;
    const currentPage = Number(page) || 1;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const start = (currentPage - 1) * perPage;

    res.json({
      success: true,
      data: {
        items: rows.slice(start, start + perPage),
        page: currentPage,
        rowsPerPage: perPage,
        totalItems,
        totalPages,
        tabCounts,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/catalog/inventory/:id/adjust — own-stock only; a vendor's
// count is theirs to report, not ours to overwrite.
async function adjustInventory(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const nextOnHand = Math.round(Number(req.body.onHand));
    const reason = String(req.body.reason || '').trim();

    if (!Number.isFinite(nextOnHand) || nextOnHand < 0) {
      return res.status(400).json({ success: false, message: 'On-hand cannot be negative' });
    }
    if (reason.length < 3) {
      return res.status(400).json({ success: false, message: 'Say why the count changed' });
    }

    const product = await Product.findById(id).populate('vendor', 'businessName name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.vendor) {
      return res.status(403).json({ success: false, message: 'Vendor stock cannot be adjusted from here' });
    }

    const [reservedRow] = await Order.aggregate([
      { $match: { status: { $in: OPEN_STATUSES }, 'items.product': product._id } },
      { $unwind: '$items' },
      { $match: { 'items.product': product._id } },
      { $group: { _id: null, qty: { $sum: '$items.quantity' } } },
    ]);
    const reserved = reservedRow?.qty || 0;

    if (nextOnHand < reserved) {
      return res.status(400).json({
        success: false,
        message: `${reserved} units are already reserved by open orders`,
      });
    }

    product.stock = nextOnHand;
    await product.save();

    res.json({
      success: true,
      message: 'Stock updated',
      data: toRow(product.toObject(), reserved, 0),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listInventory, adjustInventory };
