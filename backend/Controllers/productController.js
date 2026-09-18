const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const { getImageUrl, getImageVariants } = require('../utils/imageHelper');
const { readPagination, buildPagination } = require('../utils/pagination');
const { PUBLIC_APPROVAL_FILTER } = require('../utils/publicVisibility');
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

// Images are stored as relative paths and served through getImageUrl, which
// prefixes BACKEND_URL. Removal requests come back from the client carrying
// whatever getImageUrl produced, so we compare on the relative tail rather
// than assuming the prefix round-trips unchanged.
function toRelativePath(url) {
  const index = url.indexOf('/uploads/');
  return index === -1 ? url : url.slice(index);
}

// The B2B/variant fields arrive over multipart/form-data, where arrays and
// objects have to travel JSON-encoded. Same parsing and the same validation
// the seller panel uses (vendorProductController) — deliberately duplicated in
// behaviour, not in rules: both call validateCatalogB2B below, so an admin and
// a seller can never disagree about what a valid GST rate is.
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

const GST_SLABS = [0, 5, 12, 18, 28];

function validateCatalogB2B({ hsnCode, gstRate, moq, priceTiers }) {
  if (gstRate !== undefined && gstRate !== null && gstRate !== '') {
    if (!GST_SLABS.includes(Number(gstRate))) return `GST rate must be one of ${GST_SLABS.join(', ')}%`;
  }
  if (hsnCode && String(hsnCode).trim() && !/^\d{4,8}$/.test(String(hsnCode).trim())) {
    return 'HSN code must be 4 to 8 digits';
  }
  if (moq !== undefined && moq !== null && moq !== '') {
    const n = Number(moq);
    if (!Number.isInteger(n) || n < 1) return 'Minimum order quantity must be a whole number of at least 1';
  }
  if (Array.isArray(priceTiers)) {
    const seen = new Set();
    for (const tier of priceTiers) {
      const minQty = Number(tier?.minQty);
      const price = Number(tier?.price);
      if (!Number.isInteger(minQty) || minQty < 2) return 'Each quantity break needs a whole minimum quantity of 2 or more';
      if (!Number.isFinite(price) || price < 0) return 'Each quantity break needs a valid price';
      if (seen.has(minQty)) return `You have two quantity breaks at ${minQty} units`;
      seen.add(minQty);
    }
  }
  return null;
}

// Replaced wholesale when sent, never merged: the form owns the list, and a
// merge would make removing a variant impossible. An existing variant keeps
// its _id (and therefore its identity on live carts and orders) when the
// client sends it back.
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

function serializeProduct(p) {
  return {
    id: p._id.toString(),
    _id: p._id.toString(),
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
    vendor: p.vendor ? p.vendor.toString() : null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    discountPercent: p.discountPercent || 0,
    stock: p.stock,
    weight: p.weight ?? null,
    dimensions: p.dimensions
      ? {
          lengthCm: p.dimensions.lengthCm ?? null,
          breadthCm: p.dimensions.breadthCm ?? null,
          heightCm: p.dimensions.heightCm ?? null,
        }
      : null,

    hsnCode: p.hsnCode || '',
    gstRate: p.gstRate ?? null,
    moq: p.moq ?? 1,
    priceTiers: (p.priceTiers || []).map((t) => ({ minQty: t.minQty, price: t.price })),
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
    isFlashsale: p.isFlashsale === true,
    isTrending: p.isTrending === true,
    approvalStatus: p.approvalStatus || 'APPROVED',
    rejectionReason: p.rejectionReason || '',
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listProducts(req, res) {
  const products = await Product.find()
    .populate('category', 'name')
    .populate('brand', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const items = products.map(serializeProduct);

  const stats = {
    total: items.length,
    active: items.filter((p) => p.isActive).length,
    inactive: items.filter((p) => !p.isActive).length,
    outOfStock: items.filter((p) => p.stock <= 0).length,
    flashSale: items.filter((p) => p.isFlashsale).length,
    trending: items.filter((p) => p.isTrending).length,
  };

  res.json({ success: true, data: { items, stats } });
}

// GET /admin/catalog/products/barcode/:code
//
// The other half of "scan and see the details": a warehouse screen reads a
// code off a scanner (which behaves exactly like a keyboard — it types the
// digits and an Enter) and looks it up here, the same way a person would
// type a SKU into search, except the code is unambiguous and requires no
// typing at all.
async function getProductByBarcode(req, res) {
  const { code } = req.params;

  if (!isValidEan13(code)) {
    return res.status(400).json({ success: false, message: 'Not a valid barcode' });
  }

  const product = await Product.findOne({ barcode: code })
    .populate('category', 'name')
    .populate('brand', 'name');

  if (!product) {
    return res.status(404).json({ success: false, message: 'No product carries this barcode' });
  }

  res.json({ success: true, message: 'Product found', data: serializeProduct(product) });
}

// GET /admin/catalog/products/:id/barcode.png
//
// The printable half: a PNG of the product's own barcode, for the "Print
// barcode" button on the product page and for a label printer. Generated on
// request rather than stored — a 13-digit code renders in a few milliseconds,
// so caching the image would only be caching something cheaper to make than
// to fetch.
async function getProductBarcodeImage(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await Product.findById(id).select('barcode').lean();
  if (!product || !product.barcode) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const png = await renderBarcodePng(product.barcode);
  // The barcode never changes once assigned (see Models/Product.js), so this
  // response can be cached hard — a browser or CDN never needs to re-fetch it.
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(png);
}

async function createProduct(req, res) {
  const {
    name,
    sku,
    category,
    brand,
    vendor,
    price,
    salePrice,
    discountPercent,
    stock,
    weight,
    description,
    isActive,
    isFlashsale,
    isFlashSale,
    isTrending,
    hsnCode,
    gstRate,
    moq,
  } = req.body;

  const priceTiers = parseJsonField(req.body.priceTiers, []);
  const variants = normaliseVariants(parseJsonField(req.body.variants, [])) || [];
  const dimensions = parseJsonField(req.body.dimensions, null);

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required' });
  }

  if (!category) {
    return res.status(400).json({ success: false, message: 'Category is required' });
  }

  const priceNum = toNumber(price);
  if (priceNum === null || priceNum < 0) {
    return res.status(400).json({ success: false, message: 'Enter a valid price' });
  }

  const salePriceNum = toNumber(salePrice);
  if (salePriceNum !== null && salePriceNum > priceNum) {
    return res.status(400).json({ success: false, message: 'Sale price cannot be higher than the regular price' });
  }

  const b2bError = validateCatalogB2B({ hsnCode, gstRate, moq, priceTiers });
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
  const flashSaleVal = isFlashsale !== undefined ? isFlashsale : isFlashSale;

  const product = await Product.create({
    name: name.trim(),
    // Omitted (not `null`) when blank — see Models/Product.js for why.
    ...(sku && sku.trim() ? { sku: sku.trim() } : {}),
    category,
    brand: brand || null,
    vendor: vendor && mongoose.isValidObjectId(vendor) ? vendor : null,
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
    isActive: toBool(isActive, true),
    isFlashsale: toBool(flashSaleVal, false),
    isTrending: toBool(isTrending, false),
  });

  await product.populate([
    { path: 'category', select: 'name' },
    { path: 'brand', select: 'name' },
  ]);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: serializeProduct(product),
  });
}

async function updateProduct(req, res) {
  const { id } = req.params;
  const {
    name,
    sku,
    category,
    brand,
    vendor,
    price,
    salePrice,
    discountPercent,
    stock,
    weight,
    description,
    isActive,
    isFlashsale,
    isFlashSale,
    isTrending,
    removeImages,
    hsnCode,
    gstRate,
    moq,
  } = req.body;

  // Undefined means "not sent, leave alone"; an empty array means "cleared".
  // parseJsonField keeps that distinction by defaulting to undefined.
  const priceTiers = parseJsonField(req.body.priceTiers, undefined);
  const variants = normaliseVariants(parseJsonField(req.body.variants, undefined));
  const dimensions = parseJsonField(req.body.dimensions, undefined);

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (name && name.trim()) {
    product.name = name.trim();
  }

  if (sku !== undefined) {
    const trimmed = sku.trim();
    if (trimmed) {
      const existing = await Product.findOne({ sku: trimmed, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `SKU ${trimmed} is already in use` });
      }
    }
    // undefined (not null) when cleared, so the sparse unique index treats
    // it as genuinely absent rather than colliding with every other
    // no-SKU product on a shared `sku: null`.
    product.sku = trimmed || undefined;
  }

  if (category) {
    product.category = category;
  }

  if (brand !== undefined) {
    product.brand = brand || null;
  }

  if (vendor !== undefined) {
    product.vendor = vendor && mongoose.isValidObjectId(vendor) ? vendor : null;
  }

  if (price !== undefined) {
    const priceNum = toNumber(price);
    if (priceNum !== null) product.price = priceNum;
  }

  if (salePrice !== undefined) {
    product.salePrice = toNumber(salePrice);
  }

  if (discountPercent !== undefined) {
    product.discountPercent = toNumber(discountPercent, 0);
  }

  if (product.salePrice != null && product.salePrice > product.price) {
    return res.status(400).json({ success: false, message: 'Sale price cannot be higher than the regular price' });
  }

  if (stock !== undefined) {
    product.stock = Math.max(0, Math.round(toNumber(stock, product.stock)));
  }

  if (weight !== undefined) {
    product.weight = toNumber(weight);
  }

  const b2bError = validateCatalogB2B({ hsnCode, gstRate, moq, priceTiers });
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

  if (description !== undefined) {
    product.description = description;
  }

  if (isActive !== undefined) {
    product.isActive = toBool(isActive, product.isActive);
  }

  const flashSaleVal = isFlashsale !== undefined ? isFlashsale : isFlashSale;
  if (flashSaleVal !== undefined) {
    product.isFlashsale = toBool(flashSaleVal, product.isFlashsale);
  }

  if (isTrending !== undefined) {
    product.isTrending = toBool(isTrending, product.isTrending);
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
  await product.populate([
    { path: 'category', select: 'name' },
    { path: 'brand', select: 'name' },
  ]);

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: serializeProduct(product),
  });
}

async function updateProductStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const product = await Product.findById(id)
    .populate('category', 'name')
    .populate('brand', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  product.isActive = toBool(isActive, product.isActive);
  await product.save();

  res.json({
    success: true,
    message: `Product ${product.isActive ? 'activated' : 'deactivated'}`,
    data: serializeProduct(product),
  });
}

async function updateProductFlashSaleStatus(req, res) {
  const { id } = req.params;
  const { isFlashsale, isFlashSale } = req.body;
  const val = isFlashsale !== undefined ? isFlashsale : isFlashSale;

  const product = await Product.findById(id)
    .populate('category', 'name')
    .populate('brand', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  product.isFlashsale = val !== undefined ? toBool(val, false) : !product.isFlashsale;
  await product.save();

  res.json({
    success: true,
    message: `Product ${product.isFlashsale ? 'marked as Flash Sale' : 'removed from Flash Sale'}`,
    data: serializeProduct(product),
  });
}

async function updateProductTrendingStatus(req, res) {
  const { id } = req.params;
  const { isTrending } = req.body;

  const product = await Product.findById(id)
    .populate('category', 'name')
    .populate('brand', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  product.isTrending = isTrending !== undefined ? toBool(isTrending, false) : !product.isTrending;
  await product.save();

  res.json({
    success: true,
    message: `Product ${product.isTrending ? 'marked as Trending' : 'removed from Trending'}`,
    data: serializeProduct(product),
  });
}

// PATCH /admin/catalog/products/:id/approval — admin moves a seller-submitted
// product (approvalStatus PENDING) to APPROVED (goes live, activated) or
// REJECTED (stays hidden, with a reason the seller can see and fix).
async function decideProductApproval(req, res) {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
  }

  const product = await Product.findById(id).populate('category', 'name').populate('brand', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  product.approvalStatus = decision;
  product.rejectionReason = decision === 'REJECTED' ? (rejectionReason || '').trim() : '';
  product.isActive = decision === 'APPROVED';
  await product.save();

  res.json({
    success: true,
    message: `Product ${decision === 'APPROVED' ? 'approved and live' : 'rejected'}`,
    data: serializeProduct(product),
  });
}

async function deleteProduct(req, res) {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  await product.deleteOne();

  // Otherwise every buyer's cart/wishlist keeps an unbounded, permanently
  // dangling reference to a product that no longer exists — harmless
  // (already filtered out at read time) but grows forever.
  await Promise.all([
    Cart.updateMany({ 'items.product': product._id }, { $pull: { items: { product: product._id } } }),
    Wishlist.updateMany({ 'items.product': product._id }, { $pull: { items: { product: product._id } } }),
  ]);

  res.json({
    success: true,
    message: 'Product deleted successfully',
    data: { id: product._id.toString() },
  });
}

// A product card needs a name, a price, an image and a badge — not the full
// description, not every image in the gallery, not the vendor/approval
// bookkeeping. Listing rows are serialized through this instead of
// serializeProduct so the payload stays proportional to what is rendered.
function serializeProductCard(p) {
  const salePrice = p.salePrice ?? null;
  const effective = salePrice ?? p.price;
  const discountPercent =
    p.discountPercent ||
    (p.price > effective && p.price > 0 ? Math.round(((p.price - effective) / p.price) * 100) : 0);

  return {
    id: p._id.toString(),
    name: p.name,
    sku: p.sku || '',
    category:
      p.category && p.category.name ? { id: p.category._id.toString(), name: p.category.name } : null,
    brand: p.brand && p.brand.name ? { id: p.brand._id.toString(), name: p.brand.name } : null,
    price: p.price,
    salePrice,
    discountPercent,
    stock: p.stock,

    // Enough for a card to say "4 options" and "from Rs X" without shipping
    // the whole variant list to a grid of sixty tiles. The detail endpoint
    // carries the rest.
    variantCount: (p.variants || []).filter((v) => v.isActive !== false).length,
    // The cheapest a buyer could pay at quantity 1, across all variants. Null
    // when there are no variants, so the card falls back to `salePrice`/`price`.
    fromPrice: (() => {
      const active = (p.variants || []).filter((v) => v.isActive !== false);
      if (active.length === 0) return null;
      const prices = active.map((v) => v.salePrice ?? v.price ?? salePrice ?? p.price ?? 0);
      return Math.min(...prices);
    })(),
    moq: p.moq ?? 1,
    // True when a quantity break exists, so a card can carry a "bulk pricing"
    // badge without the tiers themselves.
    hasBulkPricing: (p.priceTiers || []).length > 0,

    // Just the card image. The gallery belongs to the detail endpoint.
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    // Responsive candidates for the same image, so a 400px tile downloads a
    // 400px file instead of the 1000px canonical one. Null when the upload
    // predates the derivative pipeline — the client then just uses `image`.
    imageSrcSet: p.images?.[0] ? getImageVariants(p.images[0])?.srcSet ?? null : null,
    isFlashsale: p.isFlashsale === true,
    isTrending: p.isTrending === true,
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
  };
}

// Only these fields ever leave the DB for a listing. `description` alone was
// most of the old payload, and `images` pulled every gallery entry for every
// card just to render one thumbnail.
const CARD_PROJECTION =
  'name sku category brand price salePrice discountPercent stock images isFlashsale isTrending rating reviewsCount createdAt';

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { effectivePrice: 1, _id: 1 },
  price_desc: { effectivePrice: -1, _id: 1 },
  rating: { rating: -1, reviewsCount: -1 },
  discount: { discountPercent: -1 },
  popular: { reviewsCount: -1, rating: -1 },
};

// `?category=not-an-id` used to reach Mongoose verbatim and come back as an
// unhandled CastError — a 500 on a URL a user can type or share. An id that
// isn't an id now simply matches nothing.
function objectIdFilter(value) {
  const values = (Array.isArray(value) ? value : String(value).split(','))
    .map((v) => String(v).trim())
    .filter((v) => mongoose.isValidObjectId(v));
  if (values.length === 0) return null; // present but entirely invalid -> match nothing
  return values.length === 1 ? values[0] : { $in: values };
}

async function listPublicProducts(req, res) {
  const {
    flashSale,
    trending,
    category,
    brand,
    vendor,
    search,
    minPrice,
    maxPrice,
    rating,
    inStock,
    minDiscount,
    sort,
  } = req.query;

  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const emptyPage = () =>
    res.json({
      success: true,
      message: 'Products fetched successfully',
      data: { items: [], total: 0 },
      pagination: buildPagination({ page, limit, total: 0 }),
    });

  // approvalStatus is in the filter on purpose: a vendor-submitted product
  // sitting in PENDING (or one an admin REJECTED) is not part of the public
  // catalog, and this listing previously showed both.
  //
  // It is a $nin rather than an equality check because documents predating the
  // approval workflow carry no approvalStatus at all — see utils/publicVisibility.
  const query = { isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER };

  if (flashSale === 'true' || flashSale === true) query.isFlashsale = true;
  if (trending === 'true' || trending === true) query.isTrending = true;

  for (const [field, raw] of [['category', category], ['brand', brand], ['vendor', vendor]]) {
    if (raw === undefined || raw === '') continue;
    const filter = objectIdFilter(raw);
    // Caller asked for ids that cannot exist — answer honestly with an empty
    // page rather than dropping the filter and returning the whole catalog.
    if (filter === null) return emptyPage();
    query[field] = filter;
  }

  if (search && String(search).trim()) {
    // Escaped before building a RegExp so user input can't inject regex
    // metacharacters (ReDoS / unexpected matches via unescaped `.`, `*`, ...).
    const escaped = String(search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    // SKU is searched too: buyers paste product/SKU codes into search far more
    // often than a name-only match allowed for.
    query.$or = [{ name: re }, { sku: re }];
  }

  if (inStock === 'true' || inStock === true) query.stock = { $gt: 0 };

  const minDiscountNum = Number(minDiscount);
  if (Number.isFinite(minDiscountNum) && minDiscountNum > 0) {
    query.discountPercent = { $gte: minDiscountNum };
  }

  const minRating = Number(rating);
  if (Number.isFinite(minRating) && minRating > 0) query.rating = { $gte: minRating };

  const min = Number(minPrice);
  const max = Number(maxPrice);
  const hasPriceFilter = Number.isFinite(min) || Number.isFinite(max);
  // min > max is a filter that can never match anything; saying so costs one
  // round trip instead of a pointless scan.
  if (hasPriceFilter && Number.isFinite(min) && Number.isFinite(max) && min > max) return emptyPage();

  const sortSpec = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;
  const needsEffectivePrice = hasPriceFilter || sort === 'price_asc' || sort === 'price_desc';

  let rows;
  let total;

  if (needsEffectivePrice) {
    // Price filtering and price sorting both have to run on the price the
    // buyer actually pays (salePrice when set, else price), which is a
    // computed value and so needs a pipeline. The computation is deliberately
    // placed AFTER the cheap indexed $match, so it only ever runs over the
    // already-narrowed set rather than the whole collection.
    const priceBounds = {};
    if (Number.isFinite(min)) priceBounds.$gte = min;
    if (Number.isFinite(max)) priceBounds.$lte = max;

    const basePipeline = [
      { $match: query },
      { $addFields: { effectivePrice: { $ifNull: ['$salePrice', '$price'] } } },
      ...(hasPriceFilter ? [{ $match: { effectivePrice: priceBounds } }] : []),
    ];

    const [pageRows, countRows] = await Promise.all([
      Product.aggregate([
        ...basePipeline,
        { $sort: sortSpec },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $lookup: {
            from: 'brands',
            localField: 'brand',
            foreignField: '_id',
            as: 'brand',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      ]),
      Product.aggregate([...basePipeline, { $count: 'total' }]),
    ]);

    rows = pageRows;
    total = countRows[0]?.total || 0;
  } else {
    // The common path: a plain indexed find with a projection, and a populate
    // narrowed to the one label field each card shows.
    //
    // Note on N+1: Mongoose's populate already batches (one extra query per
    // populated path, not per document), so this was never N+1 — the win here
    // is payload size and index usage, not query count. The `select` is what
    // stops every card dragging the full description and gallery along with
    // it, and the compound index on { isActive, approvalStatus, ... } is what
    // lets the sort be served by the index instead of sorted in memory.
    const [pageRows, count] = await Promise.all([
      Product.find(query)
        .select(CARD_PROJECTION)
        .populate('category', 'name')
        .populate('brand', 'name')
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);
    rows = pageRows;
    total = count;
  }

  // NOTE: there used to be a fallback here that, when a flash-sale/trending
  // query matched nothing, quietly returned the newest products instead. That
  // put ordinary catalog items under a "Flash Sale — ends at midnight" header
  // at their normal price. An empty promotion is now reported as empty and the
  // storefront hides the rail.
  res.json({
    success: true,
    message: 'Products fetched successfully',
    data: {
      items: rows.map(serializeProductCard),
      // Kept for callers already reading `data.total`; `pagination` is the
      // shape new code should use.
      total,
    },
    pagination: buildPagination({ page, limit, total }),
  });
}

// The buyer-facing shape of one product. Deliberately NOT serializeProduct:
// that one is the admin/vendor serializer and carries `vendor` (an internal
// id), `approvalStatus` and `rejectionReason` — moderation bookkeeping that a
// shopper has no business receiving (see audit §57, vendor private data).
function serializePublicProduct(p) {
  return {
    id: p._id.toString(),
    name: p.name,
    sku: p.sku || '',
    category:
      p.category && p.category.name ? { id: p.category._id.toString(), name: p.category.name } : null,
    brand:
      p.brand && p.brand.name
        ? { id: p.brand._id.toString(), name: p.brand.name, logo: p.brand.logo ? getImageUrl(p.brand.logo) : null }
        : null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    discountPercent: p.discountPercent || 0,
    stock: p.stock,
    weight: p.weight ?? null,

    // Tax, shown on the PDP because a B2B buyer prices on the ex-tax figure.
    // GST is inclusive in the listed price here - see utils/pricing.
    hsnCode: p.hsnCode || '',
    gstRate: p.gstRate ?? null,

    // B2B. moq of 1 is "no minimum", which is every product that has not set
    // one, so a client can render this unconditionally.
    moq: p.moq ?? 1,
    priceTiers: (p.priceTiers || [])
      .map((t) => ({ minQty: t.minQty, price: t.price }))
      .sort((a, b) => a.minQty - b.minQty),

    // Buyable options. An empty array means the product itself is the thing
    // being bought; a non-empty one means the buyer MUST choose before the
    // cart will accept it (cartController enforces that, this only reports it).
    variants: (p.variants || [])
      .filter((v) => v.isActive !== false)
      .map((v) => ({
        id: v._id.toString(),
        name: v.name,
        attributes: v.attributes ? Object.fromEntries(v.attributes) : {},
        // Null means "same as the parent" - the client falls back to the
        // product's own price rather than showing nothing.
        price: v.price ?? null,
        salePrice: v.salePrice ?? null,
        stock: v.stock ?? 0,
        image: v.image ? getImageUrl(v.image) : null,
      })),

    images: (p.images || []).map((img) => getImageUrl(img)),
    // Parallel to `images`, index for index.
    imageSrcSets: (p.images || []).map((img) => getImageVariants(img)?.srcSet ?? null),
    description: p.description || '',
    isFlashsale: p.isFlashsale === true,
    isTrending: p.isTrending === true,
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    createdAt: p.createdAt,
  };
}

async function getPublicProduct(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await Product.findOne({ _id: id, isActive: true, approvalStatus: PUBLIC_APPROVAL_FILTER })
    .populate('category', 'name')
    .populate('brand', 'name logo')
    .lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  res.json({ success: true, message: 'Product fetched successfully', data: serializePublicProduct(product) });
}

// GET /catalog/products/:id/related — a separate call on purpose so the detail
// page can paint price/stock/Add-to-Cart first and fill this rail in after
// (audit §12: critical content first, secondary content progressively).
async function listRelatedProducts(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await Product.findById(id).select('category brand').lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const { limit } = readPagination(req.query, { defaultLimit: 10, maxLimit: 20 });

  // `_id: { $ne: id }` is the whole point of this filter: the product being
  // viewed must never appear in its own "similar products" rail (audit §56).
  const base = {
    _id: { $ne: product._id },
    isActive: true,
    approvalStatus: PUBLIC_APPROVAL_FILTER,
    stock: { $gt: 0 },
  };

  // Same category first, then same brand to top up when the category is thin —
  // rather than one $or query, which would rank brand matches above category
  // matches at random.
  const primary = await Product.find({ ...base, category: product.category })
    .select(CARD_PROJECTION)
    .populate('category', 'name')
    .populate('brand', 'name')
    .sort({ reviewsCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  let items = primary;

  if (items.length < limit && product.brand) {
    const seen = new Set(items.map((p) => p._id.toString()));
    const topUp = await Product.find({
      ...base,
      brand: product.brand,
      _id: { $nin: [product._id, ...items.map((p) => p._id)] },
    })
      .select(CARD_PROJECTION)
      .populate('category', 'name')
      .populate('brand', 'name')
      .sort({ reviewsCount: -1, createdAt: -1 })
      .limit(limit - items.length)
      .lean();
    items = [...items, ...topUp.filter((p) => !seen.has(p._id.toString()))];
  }

  res.json({
    success: true,
    message: 'Related products fetched successfully',
    data: { items: items.map(serializeProductCard), total: items.length },
  });
}

module.exports = {
  listProducts,
  listPublicProducts,
  serializeProductCard,
  getPublicProduct,
  listRelatedProducts,
  createProduct,
  getProductByBarcode,
  getProductBarcodeImage,
  updateProduct,
  updateProductStatus,
  updateProductFlashSaleStatus,
  updateProductTrendingStatus,
  decideProductApproval,
  deleteProduct,
};
