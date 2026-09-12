const mongoose = require('mongoose');
const Cart = require('../Models/Cart');
const { getImageUrl } = require('../utils/imageHelper');

// Shaped to match frontend/src/lib/cartStore.js's item shape directly.
function serializeItem(entry) {
  const p = entry.product;
  return {
    id: p._id.toString(),
    name: p.name,
    variant: entry.variant || '',
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    price: p.salePrice ?? p.price ?? 0,
    originalPrice: p.price ?? p.salePrice ?? 0,
    quantity: entry.quantity,
  };
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
}

async function getCart(req, res) {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

  const items = (cart?.items || []).filter((entry) => entry.product).map(serializeItem);

  res.json({ success: true, data: { items } });
}

async function addCartItem(req, res) {
  const { productId, quantity = 1, variant = '' } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => entry.product.toString() === productId);

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({ product: productId, quantity: qty, variant });
  }

  await cart.save();
  res.json({ success: true, message: 'Added to cart' });
}

// Idempotent upsert — sets (not increments) a line item's quantity,
// creating it if it isn't there yet. This is what the frontend's debounced
// cart sync calls: after a burst of clicks settles, it sends the final
// local quantity once, and this endpoint reconciles the server to match
// regardless of whether the item already existed.
async function setCartItem(req, res) {
  const { productId } = req.params;
  const { quantity, variant } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => entry.product.toString() === productId);

  if (existing) {
    existing.quantity = qty;
    if (variant !== undefined) existing.variant = variant;
  } else {
    cart.items.push({ product: productId, quantity: qty, variant: variant || '' });
  }

  await cart.save();
  res.json({ success: true, message: 'Cart item set' });
}

async function updateCartItem(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  await Cart.updateOne(
    { user: req.user._id, 'items.product': productId },
    { $set: { 'items.$.quantity': qty } }
  );

  res.json({ success: true, message: 'Cart updated' });
}

async function removeCartItem(req, res) {
  const { productId } = req.params;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: productId } } });

  res.json({ success: true, message: 'Removed from cart' });
}

async function clearCart(req, res) {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json({ success: true, message: 'Cart cleared' });
}

module.exports = { getCart, addCartItem, setCartItem, updateCartItem, removeCartItem, clearCart };
