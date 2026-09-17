const mongoose = require('mongoose');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const { getImageUrl, getImageVariants } = require('../utils/imageHelper');

// "Only N left" is shown at or below this, so the buyer sees scarcity before
// they hit the wall at checkout.
const LOW_STOCK_THRESHOLD = 5;
// A cart line can't exceed this regardless of stock — a typo (or a tampered
// request) asking for 1e9 units should be refused, not clamped to whatever
// happens to be in the warehouse.
const MAX_LINE_QUANTITY = 50;
const MAX_MERGE_ITEMS = 100;

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Shared by every mutation below: never let a cart line reference a
// deleted/deactivated product or a quantity beyond real stock. This isn't
// the final word on stock — createOrder re-reserves it atomically at
// checkout — but it stops the cart from lying to the user well before then.
async function loadPurchasableProduct(productId) {
  return Product.findOne({ _id: productId, isActive: true });
}

function clampToStock(qty, product) {
  if (product.stock <= 0) return 0;
  return Math.max(1, Math.min(qty, product.stock, MAX_LINE_QUANTITY));
}

// Why a quantity was reduced, in the buyer's terms. Saying "only 50 in stock"
// when there are 80 in stock and the request simply exceeded the per-line cap
// is both wrong and needlessly alarming.
function clampMessage(requested, applied, product, okMessage) {
  if (applied >= requested) return okMessage;
  if (applied >= product.stock) return `Only ${product.stock} left in stock — quantity adjusted`;
  return `You can order up to ${MAX_LINE_QUANTITY} of an item at a time — quantity adjusted`;
}

// Shaped to match frontend/src/lib/cartStore.js's item shape directly.
//
// `availability`, `stock` and `priceChanged` are the important additions: the
// cart used to report only name/price/quantity, which left the UI no way to
// say "Only 2 left" or "no longer available" — it could only show a line as
// if everything were fine and then fail at checkout. Those states are
// computed here, from live product data, and the client renders them.
function serializeItem(entry) {
  const p = entry.product;
  const price = p.salePrice ?? p.price ?? 0;

  let availability = 'AVAILABLE';
  if (!p.isActive) availability = 'UNAVAILABLE';
  else if (p.stock <= 0) availability = 'OUT_OF_STOCK';
  else if (p.stock < entry.quantity) availability = 'INSUFFICIENT_STOCK';
  else if (p.stock <= LOW_STOCK_THRESHOLD) availability = 'LOW_STOCK';

  return {
    id: p._id.toString(),
    name: p.name,
    variant: entry.variant || '',
    image: p.images?.[0] ? getImageUrl(p.images[0]) : null,
    imageSrcSet: p.images?.[0] ? getImageVariants(p.images[0])?.srcSet ?? null : null,
    price,
    originalPrice: p.price ?? p.salePrice ?? 0,
    quantity: entry.quantity,
    stock: p.stock,
    availability,
    // The price the line was added at, so the UI can say "price changed from
    // X" rather than silently charging the new number.
    addedAtPrice: entry.priceAtAdd ?? null,
    priceChanged: entry.priceAtAdd != null && entry.priceAtAdd !== price,
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

  // Lines whose product was hard-deleted have nothing left to render, so they
  // are dropped. Lines whose product was merely DEACTIVATED are kept and
  // flagged UNAVAILABLE — dropping those silently is how a buyer ended up
  // looking at a cart that no longer matched what they had put in it.
  const entries = (cart?.items || []).filter((entry) => entry.product);
  const items = entries.map(serializeItem);

  const purchasable = items.filter((item) => item.availability !== 'UNAVAILABLE' && item.availability !== 'OUT_OF_STOCK');

  res.json({
    success: true,
    message: 'Cart fetched successfully',
    data: {
      items,
      // Server-computed so the header badge and the cart page can never
      // disagree, and so the client is not the one deciding what the cart
      // is worth.
      summary: {
        itemCount: items.length,
        unitCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: round2(purchasable.reduce((sum, item) => sum + item.price * item.quantity, 0)),
        mrpTotal: round2(purchasable.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)),
        hasIssues: items.some((item) => item.availability !== 'AVAILABLE' || item.priceChanged),
      },
    },
  });
}

// POST /user/cart/merge — called once, right after sign-in, with whatever the
// visitor accumulated while signed out.
//
// The old behaviour was for the client to simply GET the cart and overwrite
// its local state, which threw the guest cart away without a word. Merging is
// additive per the spec (§16): quantities are summed, then capped at real
// stock, and the response says exactly what was capped so the UI can tell the
// buyer instead of quietly giving them less than they asked for.
async function mergeCart(req, res) {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'items must be an array' });
  }
  if (items.length > MAX_MERGE_ITEMS) {
    return res.status(400).json({ success: false, message: `Cannot merge more than ${MAX_MERGE_ITEMS} items at once` });
  }

  // Collapse duplicates the client may have sent for the same product before
  // anything touches the database.
  const requested = new Map();
  for (const raw of items) {
    const productId = raw?.productId ?? raw?.id;
    if (!mongoose.isValidObjectId(productId)) continue;
    const qty = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.round(Number(raw?.quantity) || 1)));
    const key = productId.toString();
    const existing = requested.get(key);
    requested.set(key, {
      quantity: Math.min(MAX_LINE_QUANTITY, (existing?.quantity || 0) + qty),
      variant: raw?.variant ?? existing?.variant ?? '',
    });
  }

  const cart = await getOrCreateCart(req.user._id);

  if (requested.size === 0) {
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Nothing to merge', data: { items: (cart.items || []).filter((e) => e.product).map(serializeItem), adjustments: [] } });
  }

  // One query for every product being merged, rather than one per item.
  const products = await Product.find({ _id: { $in: [...requested.keys()] }, isActive: true }).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const adjustments = [];

  for (const [productId, wanted] of requested) {
    const product = productById.get(productId);
    if (!product) {
      adjustments.push({ productId, reason: 'UNAVAILABLE', requested: wanted.quantity, applied: 0 });
      continue;
    }
    if (product.stock <= 0) {
      adjustments.push({ productId, name: product.name, reason: 'OUT_OF_STOCK', requested: wanted.quantity, applied: 0 });
      continue;
    }

    const existing = cart.items.find((entry) => entry.product.toString() === productId);
    const combined = (existing?.quantity || 0) + wanted.quantity;
    const applied = Math.min(combined, product.stock, MAX_LINE_QUANTITY);

    if (applied < combined) {
      adjustments.push({ productId, name: product.name, reason: 'STOCK_CAPPED', requested: combined, applied });
    }

    if (existing) {
      existing.quantity = applied;
    } else {
      cart.items.push({
        product: productId,
        quantity: applied,
        variant: wanted.variant || '',
        priceAtAdd: product.salePrice ?? product.price ?? 0,
      });
    }
  }

  await cart.save();
  await cart.populate('items.product');

  res.json({
    success: true,
    message: adjustments.length ? 'Cart merged with adjustments' : 'Cart merged',
    data: {
      items: (cart.items || []).filter((entry) => entry.product).map(serializeItem),
      adjustments,
    },
  });
}

async function addCartItem(req, res) {
  const { productId, quantity = 1, variant = '' } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }
  if (product.stock <= 0) {
    return res.status(400).json({ success: false, message: 'This product is out of stock' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => entry.product.toString() === productId);
  const desiredQty = (existing?.quantity || 0) + requestedQty;
  const qty = clampToStock(desiredQty, product);

  if (existing) {
    existing.quantity = qty;
  } else {
    cart.items.push({ product: productId, quantity: qty, variant, priceAtAdd: product.salePrice ?? product.price ?? 0 });
  }

  await cart.save();
  res.json({
    success: true,
    message: clampMessage(desiredQty, qty, product, 'Added to cart'),
  });
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

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }
  if (product.stock <= 0) {
    return res.status(400).json({ success: false, message: 'This product is out of stock' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));
  const qty = clampToStock(requestedQty, product);
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => entry.product.toString() === productId);

  if (existing) {
    existing.quantity = qty;
    if (variant !== undefined) existing.variant = variant;
  } else {
    cart.items.push({ product: productId, quantity: qty, variant: variant || '', priceAtAdd: product.salePrice ?? product.price ?? 0 });
  }

  await cart.save();
  res.json({
    success: true,
    message: clampMessage(requestedQty, qty, product, 'Cart item set'),
  });
}

async function updateCartItem(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }
  if (product.stock <= 0) {
    return res.status(400).json({ success: false, message: 'This product is out of stock' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));
  const qty = clampToStock(requestedQty, product);
  await Cart.updateOne(
    { user: req.user._id, 'items.product': productId },
    { $set: { 'items.$.quantity': qty } }
  );

  res.json({
    success: true,
    message: clampMessage(requestedQty, qty, product, 'Cart updated'),
  });
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

module.exports = { getCart, mergeCart, addCartItem, setCartItem, updateCartItem, removeCartItem, clearCart };
