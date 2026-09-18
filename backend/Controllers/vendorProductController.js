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

// The B2B/variant fields arrive over multipart/form-data, where everything is
// a string — so arrays and objects come in JSON-encoded and are parsed here,
// once, rather than in each of create and update.
//
// A parse failure returns `fallback` rather than throwing: a malformed
// `priceTiers` should leave the tiers alone, not 500 the whole save.
function parseJsonField(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// The GST slabs that exist in India. An invented rate produces an invoice that
// is wrong by law, so this refuses rather than rounding to the nearest one.
const GST_SLABS = [0, 5, 12, 18, 28];

// Returns an error message, or null. Shared by create and update so the two
// cannot drift.
function validateTaxAndB2B({ hsnCode, gstRate, moq, priceTiers }) {
  if (gstRate !== undefined && gstRate !== null && gstRate !== '') {
    const rate = Number(gstRate);
    if (!GST_SLABS.includes(rate)) {
      return `GST rate must be one of ${GST_SLABS.join(', ')}%`;
    }
  }

  if (hsnCode && String(hsnCode).trim() && !/^\d{4,8}$/.test(String(hsnCode).trim())) {
    return 'HSN code must be 4 to 8 digits';
  }

  if (moq !== undefined && moq !== null && moq !== '') {
    const n = Number(moq);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return 'Minimum order quantity must be a whole number of at least 1';
    }
  }

  if (Array.isArray(priceTiers)) {
    const seen = new Set();
    for (const tier of priceTiers) {
      const minQty = Number(tier?.minQty);
      const price = Number(tier?.price);
      if (!Number.isInteger(minQty) || minQty < 2) {
        return 'Each quantity break needs a whole minimum quantity of 2 or more';
      }
      if (!Number.isFinite(price) || price < 0) {
        return 'Each quantity break needs a valid price';
      }
      // Two tiers at the same quantity have no defined winner, so the resolver
      // would pick whichever happened to sort last. Refuse instead.
      if (seen.has(minQty)) return `You have two quantity breaks at ${minQty} units`;
      seen.add(minQty);
    }
  }

  return null;
}

// Variants are replaced wholesale when the field is sent, not merged: the
// seller's form owns the whole list, and a merge would make removing one
// impossible. Existing variants keep their _id (and therefore their identity
// on open carts and orders) when the client sends it back.
function normaliseVariants(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((v) => v && String(v.name || '').trim())
    .map((v) => ({
      ...(v.id && mongoose.isValidObjectId(v.id) ? { _id: v.id } : {}),
      name: String(v.name).trim(),
      attributes: v.attributes && typeof v.attributes === 'object' ? v.attributes : {},
      sku: String(v.sku || '').trim(),
      price: toNumber(v.price),
      salePrice: toNumber(v.salePrice),
      stock: Math.max(0, Math.round(toNumber(v.stock, 0))),
      image: v.image || null,
      isActive: v.isActive !== false,
    }));
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
    // All three or none - utils/packaging treats a partial set as absent,
    // because a partial set cannot produce a volumetric weight.
    dimensions: p.dimensions
      ? {
          lengthCm: p.dimensions.lengthCm ?? null,
          breadthCm: p.dimensions.breadthCm ?? null,
          heightCm: p.dimensions.heightCm ?? null,
        }
      : null,

    // Tax
    hsnCode: p.hsnCode || '',
    gstRate: p.gstRate ?? null,

    // B2B
    moq: p.moq ?? 1,
    priceTiers: (p.priceTiers || []).map((t) => ({ minQty: t.minQty, price: t.price })),

    // Variants. `stock` above stays the parent's number and is only what a
    // product with NO variants sells from; a product with variants sells from
    // each variant's own stock, which is why variantStock is reported
    // separately rather than folded into one figure.
    variants: (p.variants || []).map((v) => ({
      id: v._id.toString(),
      name: v.name,
      attributes: v.attributes ? Object.fromEntries(v.attributes) : {},
      sku: v.sku || '',
      barcode: v.barcode || '',
      price: v.price ?? null,
      salePrice: v.salePrice ?? null,
      stock: v.stock ?? 0,
      image: v.image ? getImageUrl(v.image) : null,
      isActive: v.isActive !== false,
    })),
    variantStock: (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0),

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
  const {
    name, sku, category, brand, price, salePrice, discountPercent, stock,
    weight, description, hsnCode, gstRate, moq,
  } = req.body;

  const priceTiers = parseJsonField(req.body.priceTiers, []);
  const variants = normaliseVariants(parseJsonField(req.body.variants, [])) || [];
  const dimensions = parseJsonField(req.body.dimensions, null);

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

  const b2bError = validateTaxAndB2B({ hsnCode, gstRate, moq, priceTiers });
  if (b2bError) {
    return res.status(400).json({ success: false, message: b2bError });
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
    dimensions: dimensions
      ? {
          lengthCm: toNumber(dimensions.lengthCm),
          breadthCm: toNumber(dimensions.breadthCm),
          heightCm: toNumber(dimensions.heightCm),
        }
      : null,
    hsnCode: String(hsnCode || '').trim(),
    gstRate: toNumber(gstRate),
    moq: Math.max(1, Math.round(toNumber(moq, 1))),
    priceTiers: (priceTiers || []).map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) })),
    variants,
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
  const {
    name, sku, category, brand, price, salePrice, discountPercent, stock,
    weight, description, isActive, removeImages, hsnCode, gstRate, moq,
  } = req.body;

  // Undefined means "not sent, leave alone"; an empty array means "the seller
  // removed them all". parseJsonField preserves that distinction by defaulting
  // to undefined rather than [].
  const priceTiers = parseJsonField(req.body.priceTiers, undefined);
  const variants = normaliseVariants(parseJsonField(req.body.variants, undefined));
  const dimensions = parseJsonField(req.body.dimensions, undefined);

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

  const b2bError = validateTaxAndB2B({ hsnCode, gstRate, moq, priceTiers });
  if (b2bError) {
    return res.status(400).json({ success: false, message: b2bError });
  }

  if (dimensions !== undefined) {
    product.dimensions = dimensions
      ? {
          lengthCm: toNumber(dimensions.lengthCm),
          breadthCm: toNumber(dimensions.breadthCm),
          heightCm: toNumber(dimensions.heightCm),
        }
      : null;
  }
  if (hsnCode !== undefined) product.hsnCode = String(hsnCode || '').trim();
  if (gstRate !== undefined) product.gstRate = toNumber(gstRate);
  if (moq !== undefined) product.moq = Math.max(1, Math.round(toNumber(moq, product.moq)));
  if (priceTiers !== undefined) {
    product.priceTiers = (priceTiers || []).map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }));
  }
  if (variants !== undefined && variants !== null) {
    product.variants = variants;
  }
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
