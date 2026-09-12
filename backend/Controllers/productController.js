const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

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

function serializeProduct(p) {
  return {
    id: p._id.toString(),
    _id: p._id.toString(),
    name: p.name,
    sku: p.sku || '',
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
    isFlashsale: p.isFlashsale === true,
    isTrending: p.isTrending === true,
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

async function createProduct(req, res) {
  const {
    name,
    sku,
    category,
    brand,
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
  } = req.body;

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
    sku: sku && sku.trim() ? sku.trim() : null,
    category,
    brand: brand || null,
    price: priceNum,
    salePrice: salePriceNum,
    discountPercent: toNumber(discountPercent, 0),
    stock: Math.max(0, Math.round(toNumber(stock, 0))),
    weight: toNumber(weight),
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
  } = req.body;

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
    product.sku = trimmed || null;
  }

  if (category) {
    product.category = category;
  }

  if (brand !== undefined) {
    product.brand = brand || null;
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

async function deleteProduct(req, res) {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  await product.deleteOne();

  res.json({
    success: true,
    message: 'Product deleted successfully',
    data: { id: product._id.toString() },
  });
}

async function listPublicProducts(req, res) {
  const { flashSale, trending, category, brand, limit = 20 } = req.query;

  const query = { isActive: true };

  if (flashSale === 'true' || flashSale === true) {
    query.isFlashsale = true;
  }

  if (trending === 'true' || trending === true) {
    query.isTrending = true;
  }

  if (category) {
    query.category = category;
  }

  if (brand) {
    query.brand = brand;
  }

  let products = await Product.find(query)
    .populate('category', 'name')
    .populate('brand', 'name logo')
    .sort({ createdAt: -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
    .lean();

  if (products.length === 0 && (query.isFlashsale || query.isTrending)) {
    products = await Product.find({ isActive: true })
      .populate('category', 'name')
      .populate('brand', 'name logo')
      .sort({ createdAt: -1 })
      .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
      .lean();
  }

  res.json({
    success: true,
    data: {
      items: products.map(serializeProduct),
      total: products.length,
    },
  });
}

module.exports = {
  listProducts,
  listPublicProducts,
  createProduct,
  updateProduct,
  updateProductStatus,
  updateProductFlashSaleStatus,
  updateProductTrendingStatus,
  deleteProduct,
};
