const mongoose = require('mongoose');
const Wishlist = require('../Models/Wishlist');
const { getImageUrl, getImageVariants } = require('../utils/imageHelper');
const { readPagination, buildPagination } = require('../utils/pagination');
const { isOwnStockProduct, isOwnStockVisibleToCustomers } = require('../utils/ownStock');

const LOW_STOCK_THRESHOLD = 5;
// A wishlist that can grow without bound is a payload that can grow without
// bound — and every entry costs a populate.
const MAX_WISHLIST_ITEMS = 200;

// Shaped to match frontend/src/lib/wishlistStore.js's item shape directly,
// so a hydrate response can be dropped straight into the store.
function serializeItem(entry, { hideOwnStock = false } = {}) {
  const p = entry.product;

  // A wishlisted product that was later deactivated or sold out must say so,
  // rather than rendering as an ordinary card that fails on "Move to Cart".
  let availability = 'AVAILABLE';
  if (!p.isActive) availability = 'UNAVAILABLE';
  // Admin switched "Own stock" off, so admin's own products can't be bought.
  else if (hideOwnStock && isOwnStockProduct(p)) availability = 'UNAVAILABLE';
  else if (p.stock <= 0) availability = 'OUT_OF_STOCK';
  else if (p.stock <= LOW_STOCK_THRESHOLD) availability = 'LOW_STOCK';

  return {
    id: p._id.toString(),
    name: p.name,
    subtitle: p.category?.name || p.brand?.name || '',
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    imageSrcSet: p.images?.[0] ? getImageVariants(p.images[0])?.srcSet ?? null : null,
    price: p.salePrice ?? p.price ?? 0,
    originalPrice: p.price ?? p.salePrice ?? 0,
    discountPercent: p.discountPercent || 0,
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    availableStock: p.stock,
    availability,
    // Kept for the existing callers that render this string directly.
    stock: p.stock > 0 ? 'In Stock' : 'Out of Stock',
  };
}

async function getOrCreateWishlist(userId) {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [] });
  }
  return wishlist;
}

async function getWishlist(req, res) {
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
    path: 'items.product',
    select: 'name images price salePrice discountPercent stock isActive rating reviewsCount category brand vendor fulfillmentProvider',
    populate: [
      { path: 'category', select: 'name' },
      { path: 'brand', select: 'name' },
    ],
  });

  // Hard-deleted products leave a dangling ref with nothing to render; keeping
  // them would crash the card. Deactivated ones are kept and flagged so the
  // buyer learns why they can't buy it any more.
  const all = (wishlist?.items || []).filter((entry) => entry.product);
  const total = all.length;
  const hideOwnStock = !(await isOwnStockVisibleToCustomers());
  const items = all.slice(skip, skip + limit).map((entry) => serializeItem(entry, { hideOwnStock }));

  res.json({
    success: true,
    message: 'Wishlist fetched successfully',
    data: { items, total },
    pagination: buildPagination({ page, limit, total }),
  });
}

async function addWishlistItem(req, res) {
  const { productId } = req.params;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const wishlist = await getOrCreateWishlist(req.user._id);
  const exists = wishlist.items.some((entry) => entry.product.toString() === productId);

  if (!exists) {
    if (wishlist.items.length >= MAX_WISHLIST_ITEMS) {
      return res.status(400).json({
        success: false,
        code: 'WISHLIST_FULL',
        message: `Your wishlist is full (${MAX_WISHLIST_ITEMS} items). Remove something to add more.`,
      });
    }
    wishlist.items.push({ product: productId });
    await wishlist.save();
  }

  res.json({ success: true, message: 'Added to wishlist' });
}

async function removeWishlistItem(req, res) {
  const { productId } = req.params;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  await Wishlist.updateOne({ user: req.user._id }, { $pull: { items: { product: productId } } });

  res.json({ success: true, message: 'Removed from wishlist' });
}

module.exports = { getWishlist, addWishlistItem, removeWishlistItem };
