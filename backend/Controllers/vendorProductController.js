const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const CatalogSettings = require('../Models/CatalogSettings');
const { getImageUrl } = require('../utils/imageHelper');
const { isValidEan13, renderBarcodePng } = require('../utils/barcode');

function toBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRelativePath(url) {
  const index = url.indexOf('/uploads/');
  return index === -1 ? url : url.slice(index);
}

function serializeProduct(p) {
  return {
    id: p._id.toString(),
    name: p.name,
    sku: p.sku || '',
    barcode: p.barcode || '',
    category:
      p.category && p.category.name
        ? { id: p.category._id.toString(), name: p.category.name }
        : p.category
          ? { id: p.category.toString(), name: '' }
          : null,
    brand:
      p.brand && p.brand.name
        ? { id: p.brand._id.toString(), name: p.brand.name }
        : p.brand
          ? { id: p.brand.toString(), name: '' }
          : null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    discountPercent: p.discountPercent || 0,
    stock: p.stock,
    weight: p.weight ?? null,
    images: (p.images || []).map((img) => getImageUrl(img)),
    description: p.description || '',
    isActive: p.isActive !== false,
    approvalStatus: p.approvalStatus || 'APPROVED',
    rejectionReason: p.rejectionReason || '',
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// The MVP list contract every ListScreen expects: paged items + tabCounts.
async function listMyProducts(req, res) {
  const { tab, status, search, page = 1, rowsPerPage = 25 } = req.query;
  const vendorId = req.vendor._id;

  const all = await Product.find({ vendor: vendorId })
    .populate('category', 'name')
    .populate('brand', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const allSerialized = all.map(serializeProduct);
  let items = allSerialized;

  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }

  const effectiveStatus = status || tab;
  if (effectiveStatus && effectiveStatus !== 'all') {
    if (effectiveStatus === 'active') items = items.filter((p) => p.isActive && p.approvalStatus === 'APPROVED');
    else if (effectiveStatus === 'inactive') items = items.filter((p) => !p.isActive);
    else if (effectiveStatus === 'out_of_stock') items = items.filter((p) => p.stock <= 0);
    else if (effectiveStatus === 'pending') items = items.filter((p) => p.approvalStatus === 'PENDING');
    else if (effectiveStatus === 'rejected') items = items.filter((p) => p.approvalStatus === 'REJECTED');
  }

  const tabCounts = {
    all: allSerialized.length,
    active: allSerialized.filter((p) => p.isActive && p.approvalStatus === 'APPROVED').length,
    inactive: allSerialized.filter((p) => !p.isActive).length,
    out_of_stock: allSerialized.filter((p) => p.stock <= 0).length,
    pending: allSerialized.filter((p) => p.approvalStatus === 'PENDING').length,
    rejected: allSerialized.filter((p) => p.approvalStatus === 'REJECTED').length,
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

// GET /vendor/products/barcode/:code
//
// Scoped to `vendor: req.vendor._id` — a seller's warehouse scan can only
// ever resolve to something IN THEIR OWN catalog. The barcode itself is
// globally unique, so nothing stops the query from finding another seller's
// product; this is what stops the RESPONSE from ever showing it to them.
async function getMyProductByBarcode(req, res) {
  const { code } = req.params;

  if (!isValidEan13(code)) {
    return res.status(400).json({ success: false, message: 'Not a valid barcode' });
  }

  const product = await Product.findOne({ barcode: code, vendor: req.vendor._id })
    .populate('category', 'name')
    .populate('brand', 'name');

  if (!product) {
    return res.status(404).json({ success: false, message: 'No product in your catalog carries this barcode' });
  }

  res.json({ success: true, message: 'Product found', data: serializeProduct(product) });
}

// GET /vendor/products/:id/barcode.png — see productController's twin for
// why this is rendered on request rather than cached on disk.
async function getMyProductBarcodeImage(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await Product.findOne({ _id: id, vendor: req.vendor._id }).select('barcode').lean();
  if (!product || !product.barcode) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const png = await renderBarcodePng(product.barcode);
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(png);
}

async function getMyProduct(req, res) {
  const { id } = req.params;
  const product = await Product.findOne({ _id: id, vendor: req.vendor._id })
    .populate('category', 'name')
    .populate('brand', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: serializeProduct(product) });
}

// A seller may only pick from the admin-created catalog — no ad-hoc category
// or brand creation from this side, so the marketplace taxonomy stays
// controlled centrally (per platform rules: sellers get product CRUD, not
// category/brand CRUD).
async function createMyProduct(req, res) {
  const { name, sku, category, brand, price, salePrice, discountPercent, stock, weight, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required' });
  }
  if (!category || !mongoose.isValidObjectId(category)) {
    return res.status(400).json({ success: false, message: 'Select a valid category' });
  }

  const priceNum = toNumber(price);
  if (priceNum === null || priceNum < 0) {
    return res.status(400).json({ success: false, message: 'Enter a valid price' });
  }

  const salePriceNum = toNumber(salePrice);
  if (salePriceNum !== null && salePriceNum > priceNum) {
    return res.status(400).json({ success: false, message: 'Sale price cannot be higher than the regular price' });
  }

  if (sku && sku.trim()) {
    const existing = await Product.findOne({ sku: sku.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: `SKU ${sku.trim()} is already in use` });
    }
  }

  const images = (req.files || []).map((file) => file.url);

  const { autoApprovalEnabled } = await CatalogSettings.getSettings();

  const product = await Product.create({
    name: name.trim(),
    ...(sku && sku.trim() ? { sku: sku.trim() } : {}),
    category,
    brand: brand && mongoose.isValidObjectId(brand) ? brand : null,
    vendor: req.vendor._id,
    price: priceNum,
    salePrice: salePriceNum,
    discountPercent: toNumber(discountPercent, 0),
    stock: Math.max(0, Math.round(toNumber(stock, 0))),
    weight: toNumber(weight),
    images,
    description: description || '',
    isActive: autoApprovalEnabled,
    approvalStatus: autoApprovalEnabled ? 'APPROVED' : 'PENDING',
  });

  await product.populate([{ path: 'category', select: 'name' }, { path: 'brand', select: 'name' }]);

  res.status(201).json({
    success: true,
    message: autoApprovalEnabled ? 'Product created and live' : 'Product submitted for admin approval',
    data: serializeProduct(product),
  });
}

async function updateMyProduct(req, res) {
  const { id } = req.params;
  const { name, sku, category, brand, price, salePrice, discountPercent, stock, weight, description, isActive, removeImages } = req.body;

  const product = await Product.findOne({ _id: id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (name && name.trim()) product.name = name.trim();

  if (sku !== undefined) {
    const trimmed = sku.trim();
    if (trimmed) {
      const existing = await Product.findOne({ sku: trimmed, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `SKU ${trimmed} is already in use` });
      }
    }
    product.sku = trimmed || undefined;
  }

  if (category && mongoose.isValidObjectId(category)) product.category = category;
  if (brand !== undefined) product.brand = brand && mongoose.isValidObjectId(brand) ? brand : null;

  if (price !== undefined) {
    const priceNum = toNumber(price);
    if (priceNum !== null) product.price = priceNum;
  }
  if (salePrice !== undefined) product.salePrice = toNumber(salePrice);
  if (discountPercent !== undefined) product.discountPercent = toNumber(discountPercent, 0);
  if (product.salePrice != null && product.salePrice > product.price) {
    return res.status(400).json({ success: false, message: 'Sale price cannot be higher than the regular price' });
  }

  if (stock !== undefined) product.stock = Math.max(0, Math.round(toNumber(stock, product.stock)));
  if (weight !== undefined) product.weight = toNumber(weight);
  if (description !== undefined) product.description = description;
  if (isActive !== undefined && product.approvalStatus === 'APPROVED') {
    product.isActive = toBool(isActive, product.isActive);
  }

  let images = product.images || [];
  if (removeImages) {
    let toRemove = [];
    try {
      toRemove = JSON.parse(removeImages);
    } catch {
      toRemove = [];
    }
    const removeSet = new Set(toRemove.map(toRelativePath));
    images = images.filter((img) => !removeSet.has(toRelativePath(img)));
  }
  const newImages = (req.files || []).map((file) => file.url);
  product.images = [...images, ...newImages];

  await product.save();
  await product.populate([{ path: 'category', select: 'name' }, { path: 'brand', select: 'name' }]);

  res.json({ success: true, message: 'Product updated successfully', data: serializeProduct(product) });
}

async function deleteMyProduct(req, res) {
  const { id } = req.params;
  const product = await Product.findOne({ _id: id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  await product.deleteOne();
  await Promise.all([
    Cart.updateMany({ 'items.product': product._id }, { $pull: { items: { product: product._id } } }),
    Wishlist.updateMany({ 'items.product': product._id }, { $pull: { items: { product: product._id } } }),
  ]);

  res.json({ success: true, message: 'Product deleted successfully', data: { id: product._id.toString() } });
}

module.exports = {
  listMyProducts,
  getMyProduct,
  getMyProductByBarcode,
  getMyProductBarcodeImage,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct,
  serializeProduct,
};
