// THE price and stock resolver. One function decides what a line costs, and
// everything that needs to know — cart, checkout, order creation, the
// storefront's product detail, the seller's own previews — calls it.
//
// Why this file exists at all: before variants and quantity breaks, price was
// `product.salePrice ?? product.price`, and that expression was written out by
// hand in cartController (four times), orderController and productController.
// Adding a second source of truth for price to any one of those would have
// made a cart line, the order it became, and the invoice for it disagree —
// which is the one class of bug that costs real money.
//
// Resolution order, highest priority first:
//
//   1. A QUANTITY BREAK on the parent product. Buy 50, pay the 50+ rate. This
//      outranks everything because it is the whole point of B2B pricing: it is
//      a negotiated rate, not a promotion.
//   2. The VARIANT's own sale price, then its list price. A variant that sets
//      neither inherits the parent's.
//   3. The PRODUCT's sale price, then its list price.
//
// Note what tiers do NOT do: they never raise a price. If a variant or a sale
// price is already lower than the tier the quantity qualifies for, the lower
// one wins — a bulk buyer is never worse off for buying more.

const MIN_QUANTITY = 1;

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Find a variant on a product by its subdocument id.
 * Returns null for a missing id, an unknown id, or an inactive variant —
 * callers treat all three the same way, as "no such variant".
 */
function findVariant(product, variantId) {
  if (!variantId || !product?.variants?.length) return null;
  const wanted = String(variantId);
  const variant = product.variants.find((v) => String(v._id) === wanted);
  if (!variant || variant.isActive === false) return null;
  return variant;
}

/**
 * The best quantity break this line qualifies for, or null.
 * Tiers are stored sorted ascending (see Product's pre-save hook), so the LAST
 * qualifying tier is the deepest discount.
 */
function resolveTier(product, quantity) {
  const tiers = product?.priceTiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return null;

  let best = null;
  for (const tier of tiers) {
    if (quantity >= tier.minQty && isPositiveNumber(tier.price)) best = tier;
  }
  return best;
}

/**
 * The unit price for one line, in RUPEES (the unit the Product model and the
 * rest of this backend store).
 *
 * @returns {{ unitPrice: number, listPrice: number, source: string, tier: object|null }}
 *   `listPrice` is what the line would cost with no tier and no sale — it is
 *   what the UI strikes through. `source` names which rule won, so a screen or
 *   a test can say why a number is what it is rather than asserting on a bare
 *   figure.
 */
function resolveUnitPrice(product, { variantId = null, quantity = 1 } = {}) {
  const qty = Math.max(MIN_QUANTITY, Math.trunc(quantity) || MIN_QUANTITY);
  const variant = findVariant(product, variantId);

  // The undiscounted price of the thing being bought.
  const listPrice = isPositiveNumber(variant?.price) ? variant.price : product?.price ?? 0;

  // Best price available before tiers.
  const saleCandidates = [
    isPositiveNumber(variant?.salePrice) ? variant.salePrice : null,
    isPositiveNumber(variant?.price) ? variant.price : null,
    isPositiveNumber(product?.salePrice) ? product.salePrice : null,
    isPositiveNumber(product?.price) ? product.price : null,
  ].filter((p) => p !== null);

  const basePrice = saleCandidates.length > 0 ? saleCandidates[0] : 0;
  let source = variant
    ? isPositiveNumber(variant.salePrice)
      ? 'VARIANT_SALE'
      : 'VARIANT'
    : isPositiveNumber(product?.salePrice)
      ? 'PRODUCT_SALE'
      : 'PRODUCT';

  const tier = resolveTier(product, qty);

  // A tier never raises a price — see the header.
  if (tier && tier.price < basePrice) {
    return { unitPrice: tier.price, listPrice, source: 'PRICE_TIER', tier };
  }

  return { unitPrice: basePrice, listPrice, source, tier: null };
}

/**
 * How many of this thing can actually be sold.
 * A variant draws down its OWN stock; a product with no variant selected draws
 * down the parent's. Mixing the two is what would let a seller oversell a
 * colour that ran out while the parent still showed stock.
 */
function resolveStock(product, variantId = null) {
  const variant = findVariant(product, variantId);
  if (variant) return variant.stock ?? 0;
  return product?.stock ?? 0;
}

/**
 * Does this product require a variant to be chosen?
 * True once it has at least one active variant — at that point "the product"
 * is not a buyable thing, only one of its variants is.
 */
function requiresVariant(product) {
  return Boolean(product?.variants?.some((v) => v.isActive !== false));
}

/**
 * Validate a requested quantity against the product's minimum order quantity.
 * Returns null when fine, or a buyer-facing message when not.
 *
 * MOQ applies to the LINE, not the cart: two different variants of the same
 * product each have to clear it on their own, because each is a separate line
 * a seller has to pick, pack and ship.
 */
function checkMoq(product, quantity) {
  const moq = product?.moq ?? 1;
  if (moq <= 1) return null;
  if (quantity >= moq) return null;
  return `This item has a minimum order quantity of ${moq}.`;
}

/**
 * The display label for a line: the variant's name, or empty for a simple
 * product. Snapshotted onto cart and order lines so it survives the variant
 * being renamed or removed later.
 */
function variantLabel(product, variantId) {
  return findVariant(product, variantId)?.name || '';
}

/**
 * Tax for one line. Returns integer paise so it can go straight into the
 * ledger, which stores paise natively (see utils/money).
 *
 * GST in India is INCLUSIVE in the listed retail price, so this back-computes
 * the tax component rather than adding to the total — a product priced at
 * ₹118 at 18% is ₹100 plus ₹18 of tax, not ₹118 plus ₹21.24. Getting that
 * backwards overstates every invoice.
 */
function resolveLineTax(product, lineTotalRupees) {
  const rate = product?.gstRate;
  if (!isPositiveNumber(rate) || rate === 0) {
    return { taxableValuePaise: Math.round((lineTotalRupees || 0) * 100), taxPaise: 0, rate: 0 };
  }

  const grossPaise = Math.round((lineTotalRupees || 0) * 100);
  const taxableValuePaise = Math.round(grossPaise / (1 + rate / 100));
  return { taxableValuePaise, taxPaise: grossPaise - taxableValuePaise, rate };
}

module.exports = {
  findVariant,
  resolveTier,
  resolveUnitPrice,
  resolveStock,
  requiresVariant,
  checkMoq,
  variantLabel,
  resolveLineTax,
};
