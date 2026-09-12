const mongoose = require('mongoose');
const Wishlist = require('../Models/Wishlist');
const { getImageUrl } = require('../utils/imageHelper');

// Shaped to match frontend/src/lib/wishlistStore.js's item shape directly,
// so a hydrate response can be dropped straight into the store.
function serializeItem(entry) {
  const p = entry.product;
  return {
    id: p._id.toString(),
    name: p.name,
    subtitle: p.category?.name || p.brand?.name || '',
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    price: p.salePrice ?? p.price ?? 0,
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
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
    path: 'items.product',
    populate: [
      { path: 'category', select: 'name' },
      { path: 'brand', select: 'name' },
    ],
  });

  const items = (wishlist?.items || [])
    .filter((entry) => entry.product)
    .map(serializeItem);

  res.json({ success: true, data: { items } });
}

async function addWishlistItem(req, res) {
  const { productId } = req.params;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const wishlist = await getOrCreateWishlist(req.user._id);
  const exists = wishlist.items.some((entry) => entry.product.toString() === productId);

  if (!exists) {
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
