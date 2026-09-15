const mongoose = require('mongoose');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

const LOW_STOCK_THRESHOLD = 10;

function serializeInventoryRow(p) {
  return {
    id: p._id.toString(),
    name: p.name,
    sku: p.sku || '',
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    stock: p.stock,
    isLowStock: p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD,
    isOutOfStock: p.stock <= 0,
    updatedAt: p.updatedAt,
  };
}

async function listMyInventory(req, res) {
  const { tab, search, page = 1, rowsPerPage = 25 } = req.query;
  const vendorId = req.vendor._id;

  const all = await Product.find({ vendor: vendorId }).sort({ stock: 1 }).lean();
  const allSerialized = all.map(serializeInventoryRow);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }
  if (tab === 'low_stock') items = items.filter((p) => p.isLowStock);
  else if (tab === 'out_of_stock') items = items.filter((p) => p.isOutOfStock);

  const tabCounts = {
    all: allSerialized.length,
    low_stock: allSerialized.filter((p) => p.isLowStock).length,
    out_of_stock: allSerialized.filter((p) => p.isOutOfStock).length,
  };

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

// PATCH /vendor/inventory/:id — set stock to an absolute value (the panel's
// "Update Stock" action), not a delta — matches admin's inventory pattern.
async function adjustMyStock(req, res) {
  const { id } = req.params;
  const { stock } = req.body;

  const stockNum = Number(stock);
  if (!Number.isFinite(stockNum) || stockNum < 0) {
    return res.status(400).json({ success: false, message: 'Enter a valid stock quantity' });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await Product.findOneAndUpdate(
    { _id: id, vendor: req.vendor._id },
    { $set: { stock: Math.round(stockNum) } },
    { new: true }
  );
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  res.json({ success: true, message: 'Stock updated', data: serializeInventoryRow(product) });
}

module.exports = { listMyInventory, adjustMyStock };
