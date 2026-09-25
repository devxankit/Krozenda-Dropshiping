const mongoose = require('mongoose');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const { isOwnStockProduct, isOwnStockVisibleToCustomers } = require('../utils/ownStock');
const { getImageUrl, getImageVariants } = require('../utils/imageHelper');
const {
  checkMoq,
  findVariant,
  requiresVariant,
  resolveStock,
  resolveUnitPrice,
  variantLabel,
} = require('../utils/pricing');

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
  const product = await Product.findOne({ _id: productId, isActive: true });
  // Admin's "Own stock" switch is off: admin's own products can't be bought.
  if (product && isOwnStockProduct(product) && !(await isOwnStockVisibleToCustomers())) return null;
  return product;
}

// Stock is resolved per VARIANT when one is chosen — a colour that ran out
// must not be orderable just because the parent product still shows stock.
function clampToStock(qty, product, variantId = null) {
  const stock = resolveStock(product, variantId);
  if (stock <= 0) return 0;
  return Math.max(1, Math.min(qty, stock, MAX_LINE_QUANTITY));
}

// A cart line is (product, variant). Passing null for variantId matches the
// simple-product line, which is what every pre-variant line is.
function sameLine(entry, productId, variantId) {
  if (entry.product.toString() !== String(productId)) return false;
  const entryVariant = entry.variantId ? entry.variantId.toString() : null;
  return entryVariant === (variantId ? String(variantId) : null);
}

// Everything a mutation has to agree on before it touches the cart: the
// product exists, the variant (if any) is real, stock is not zero, and the
// quantity clears the MOQ. Returns { error } or { product, variant }.
function validateLine(product, variantId, quantity) {
  if (requiresVariant(product) && !variantId) {
    return { error: { status: 400, message: 'Choose an option before adding this item' } };
  }
  if (variantId && !findVariant(product, variantId)) {
    return { error: { status: 400, message: 'That option is no longer available' } };
  }
  if (resolveStock(product, variantId) <= 0) {
    return { error: { status: 400, message: 'This product is out of stock' } };
  }

  // MOQ is a seller's rule about the smallest sellable quantity, so it is a
  // refusal, not something to silently clamp up to — a buyer must not find an
  // extra 9 units in their cart because they asked for one.
  const moqError = checkMoq(product, quantity);
  if (moqError) return { error: { status: 400, message: moqError } };

  return { product, variant: findVariant(product, variantId) };
}

function readVariantId(source) {
  const raw = source?.variantId;
  if (!raw) return null;
  return mongoose.isValidObjectId(raw) ? String(raw) : null;
}

// Why a quantity was reduced, in the buyer's terms. Saying "only 50 in stock"
// when there are 80 in stock and the request simply exceeded the per-line cap
// is both wrong and needlessly alarming.
function clampMessage(requested, applied, product, okMessage, variantId = null) {
  if (applied >= requested) return okMessage;
  const stock = resolveStock(product, variantId);
  if (applied >= stock) return `Only ${stock} left in stock — quantity adjusted`;
  return `You can order up to ${MAX_LINE_QUANTITY} of an item at a time — quantity adjusted`;
}

// Shaped to match frontend/src/lib/cartStore.js's item shape directly.
//
// `availability`, `stock` and `priceChanged` are the important additions: the
// cart used to report only name/price/quantity, which left the UI no way to
// say "Only 2 left" or "no longer available" — it could only show a line as
// if everything were fine and then fail at checkout. Those states are
// computed here, from live product data, and the client renders them.
function serializeItem(entry, { hideOwnStock = false } = {}) {
  const p = entry.product;
  const variantId = entry.variantId ? entry.variantId.toString() : null;
  const variant = findVariant(p, variantId);

  // Priced through the shared resolver, at THIS line's quantity — which is
  // what makes a quantity break show up in the cart the moment the buyer
  // crosses it, rather than only at checkout.
  const { unitPrice, listPrice, source, tier } = resolveUnitPrice(p, { variantId, quantity: entry.quantity });
  const stock = resolveStock(p, variantId);

  let availability = 'AVAILABLE';
  if (!p.isActive) availability = 'UNAVAILABLE';
  // Admin switched "Own stock" off after this went into the cart.
  else if (hideOwnStock && isOwnStockProduct(p)) availability = 'UNAVAILABLE';
  // A variant that was removed or deactivated after it went into the cart.
  else if (variantId && !variant) availability = 'UNAVAILABLE';
  else if (stock <= 0) availability = 'OUT_OF_STOCK';
  else if (stock < entry.quantity) availability = 'INSUFFICIENT_STOCK';
  else if (stock <= LOW_STOCK_THRESHOLD) availability = 'LOW_STOCK';

  return {
    id: p._id.toString(),
    name: p.name,
    variantId,
    // The live label when the variant still exists, otherwise the snapshot
    // taken when it was added — so a removed option still reads sensibly.
    variant: variant?.name || entry.variant || '',
    image: variant?.image
      ? getImageUrl(variant.image)
      : p.images?.[0]
        ? getImageUrl(p.images[0])
        : null,
    imageSrcSet: p.images?.[0] ? getImageVariants(p.images[0])?.srcSet ?? null : null,
    price: unitPrice,
    originalPrice: listPrice,
    quantity: entry.quantity,
    stock,
    availability,
    // A dropshipping item: online payment only, no cancellation, no return.
    // Flag-based here for speed; checkout re-derives it authoritatively
    // (utils/dropship), so a stale flag can never let COD through.
    isDropship: p.fulfillmentProvider === 'CJ',
    // B2B context the cart UI needs to explain its own numbers.
    moq: p.moq ?? 1,
    priceSource: source,
    // Present only when a quantity break is actually applied, so the UI can
    // say "bulk price applied" without re-deriving the rule.
    appliedTier: tier ? { minQty: tier.minQty, price: tier.price } : null,
    // The next break available, so the cart can say "add 4 more for ₹80 each".
    nextTier: nextTierFor(p, entry.quantity),
    addedAtPrice: entry.priceAtAdd ?? null,
    priceChanged: entry.priceAtAdd != null && entry.priceAtAdd !== unitPrice,
  };
}

// The cheapest break the buyer has NOT yet reached. Nudging with it is the
// whole point of showing tiers in a cart rather than only on the product page.
function nextTierFor(product, quantity) {
  const tiers = (product?.priceTiers || []).filter((t) => t.minQty > quantity);
  if (tiers.length === 0) return null;
  const next = tiers.reduce((best, t) => (t.minQty < best.minQty ? t : best));
  return { minQty: next.minQty, price: next.price, addMore: next.minQty - quantity };
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
  const hideOwnStock = !(await isOwnStockVisibleToCustomers());
  const items = entries.map((entry) => serializeItem(entry, { hideOwnStock }));

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
  // Keyed by (product, variant) for the same reason a cart line is: a guest
  // who added Red/L and Blue/M has two lines, and collapsing them onto the
  // product would merge one into the other and lose a choice they made.
  const requested = new Map();
  for (const raw of items) {
    const productId = raw?.productId ?? raw?.id;
    if (!mongoose.isValidObjectId(productId)) continue;
    const variantId = readVariantId(raw);
    const qty = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.round(Number(raw?.quantity) || 1)));
    const key = `${productId}:${variantId || ''}`;
    const existing = requested.get(key);
    requested.set(key, {
      productId: productId.toString(),
      variantId,
      quantity: Math.min(MAX_LINE_QUANTITY, (existing?.quantity || 0) + qty),
      variant: raw?.variant ?? existing?.variant ?? '',
    });
  }

  const cart = await getOrCreateCart(req.user._id);
  const hideOwnStock = !(await isOwnStockVisibleToCustomers());

  if (requested.size === 0) {
    await cart.populate('items.product');
    return res.json({ success: true, message: 'Nothing to merge', data: { items: (cart.items || []).filter((e) => e.product).map((e) => serializeItem(e, { hideOwnStock })), adjustments: [] } });
  }

  // One query for every product being merged, rather than one per item.
  const products = await Product.find({
    _id: { $in: [...new Set([...requested.values()].map((r) => r.productId))] },
    isActive: true,
  }).lean();
  // Left out of the map, a hidden own-stock product is reported UNAVAILABLE
  // below like any deactivated one.
  const productById = new Map(
    products.filter((p) => !(hideOwnStock && isOwnStockProduct(p))).map((p) => [p._id.toString(), p])
  );

  const adjustments = [];

  for (const wanted of requested.values()) {
    const { productId, variantId } = wanted;
    const product = productById.get(productId);
    if (!product) {
      adjustments.push({ productId, variantId, reason: 'UNAVAILABLE', requested: wanted.quantity, applied: 0 });
      continue;
    }
    // A variant the guest cart holds that has since been removed.
    if (variantId && !findVariant(product, variantId)) {
      adjustments.push({ productId, variantId, name: product.name, reason: 'UNAVAILABLE', requested: wanted.quantity, applied: 0 });
      continue;
    }

    const stock = resolveStock(product, variantId);
    if (stock <= 0) {
      adjustments.push({ productId, variantId, name: product.name, reason: 'OUT_OF_STOCK', requested: wanted.quantity, applied: 0 });
      continue;
    }

    const existing = cart.items.find((entry) => sameLine(entry, productId, variantId));
    const combined = (existing?.quantity || 0) + wanted.quantity;
    const applied = Math.min(combined, stock, MAX_LINE_QUANTITY);

    // A merge is not a place to refuse a line over MOQ: the guest already
    // built this cart, and dropping it on sign-in is exactly the silent loss
    // this endpoint exists to prevent. It is reported instead, and checkout
    // enforces it — see createOrder.
    const moqError = checkMoq(product, applied);
    if (moqError) {
      adjustments.push({ productId, variantId, name: product.name, reason: 'BELOW_MOQ', requested: combined, applied, moq: product.moq });
    } else if (applied < combined) {
      adjustments.push({ productId, variantId, name: product.name, reason: 'STOCK_CAPPED', requested: combined, applied });
    }

    if (existing) {
      existing.quantity = applied;
    } else {
      cart.items.push({
        product: productId,
        quantity: applied,
        variantId,
        variant: variantLabel(product, variantId) || wanted.variant || '',
        priceAtAdd: resolveUnitPrice(product, { variantId, quantity: applied }).unitPrice,
      });
    }
  }

  await cart.save();
  await cart.populate('items.product');

  res.json({
    success: true,
    message: adjustments.length ? 'Cart merged with adjustments' : 'Cart merged',
    data: {
      items: (cart.items || []).filter((entry) => entry.product).map((entry) => serializeItem(entry, { hideOwnStock })),
      adjustments,
    },
  });
}

async function addCartItem(req, res) {
  const { productId, quantity = 1 } = req.body;
  const variantId = readVariantId(req.body);

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => sameLine(entry, productId, variantId));
  const desiredQty = (existing?.quantity || 0) + requestedQty;

  // Checked against the TOTAL the line will hold, not the increment: adding
  // one unit at a time to a product with an MOQ of 5 should succeed on the
  // fifth press, not fail on every one of them.
  const check = validateLine(product, variantId, desiredQty);
  if (check.error) {
    return res.status(check.error.status).json({ success: false, message: check.error.message });
  }

  const qty = clampToStock(desiredQty, product, variantId);
  const { unitPrice } = resolveUnitPrice(product, { variantId, quantity: qty });

  if (existing) {
    existing.quantity = qty;
  } else {
    cart.items.push({
      product: productId,
      quantity: qty,
      variantId,
      variant: variantLabel(product, variantId),
      priceAtAdd: unitPrice,
    });
  }

  await cart.save();
  res.json({
    success: true,
    message: clampMessage(desiredQty, qty, product, 'Added to cart', variantId),
  });
}

// Idempotent upsert — sets (not increments) a line item's quantity,
// creating it if it isn't there yet. This is what the frontend's debounced
// cart sync calls: after a burst of clicks settles, it sends the final
// local quantity once, and this endpoint reconciles the server to match
// regardless of whether the item already existed.
async function setCartItem(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;
  const variantId = readVariantId(req.body);

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));

  const check = validateLine(product, variantId, requestedQty);
  if (check.error) {
    return res.status(check.error.status).json({ success: false, message: check.error.message });
  }

  const qty = clampToStock(requestedQty, product, variantId);
  const { unitPrice } = resolveUnitPrice(product, { variantId, quantity: qty });
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => sameLine(entry, productId, variantId));

  if (existing) {
    existing.quantity = qty;
    existing.variant = variantLabel(product, variantId) || existing.variant;
  } else {
    cart.items.push({
      product: productId,
      quantity: qty,
      variantId,
      variant: variantLabel(product, variantId),
      priceAtAdd: unitPrice,
    });
  }

  await cart.save();
  res.json({
    success: true,
    message: clampMessage(requestedQty, qty, product, 'Cart item set', variantId),
  });
}

async function updateCartItem(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;
  const variantId = readVariantId(req.body);

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await loadPurchasableProduct(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'This product is no longer available' });
  }

  const requestedQty = Math.max(1, Math.round(Number(quantity) || 1));

  const check = validateLine(product, variantId, requestedQty);
  if (check.error) {
    return res.status(check.error.status).json({ success: false, message: check.error.message });
  }

  const qty = clampToStock(requestedQty, product, variantId);

  // Loaded and saved rather than updated by positional operator: `items.$`
  // matches on product alone, which would update the WRONG line once the same
  // product is in the cart as two different variants.
  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((entry) => sameLine(entry, productId, variantId));
  if (!existing) {
    return res.status(404).json({ success: false, message: 'That item is not in your cart' });
  }
  existing.quantity = qty;
  await cart.save();

  res.json({
    success: true,
    message: clampMessage(requestedQty, qty, product, 'Cart updated', variantId),
  });
}

async function removeCartItem(req, res) {
  const { productId } = req.params;
  // Accepted from the query as well as the body: DELETE requests from the
  // browser's fetch do not always carry one.
  const variantId = readVariantId(req.body) || readVariantId(req.query);

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  // With no variant named, this removes EVERY line for the product, which is
  // what "remove this item" means on a simple product and what the pre-variant
  // clients still expect. With one named, only that line goes.
  const pull = variantId
    ? { items: { product: productId, variantId } }
    : { items: { product: productId } };

  await Cart.updateOne({ user: req.user._id }, { $pull: pull });

  res.json({ success: true, message: 'Removed from cart' });
}

async function clearCart(req, res) {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json({ success: true, message: 'Cart cleared' });
}

module.exports = { getCart, mergeCart, addCartItem, setCartItem, updateCartItem, removeCartItem, clearCart };
