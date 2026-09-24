const { toPaise, allocateProportional } = require('./money');

// Per-line money on an order, in integer paise.
//
// Every order written since the split-order change snapshots each line's own
// share of the coupon discount (Order item `discountAmount`), spread only
// over the lines the coupon applied to. Older orders only have the order-level
// figure; for those the best available answer is to spread it over every line
// by value, which is what the ledger always did.

function lineGrossPaise(item) {
  return toPaise(item.price) * item.quantity;
}

function lineDiscountsPaise(order) {
  const items = order?.items || [];
  if (items.length > 0 && items.every((item) => item.discountAmount !== null && item.discountAmount !== undefined)) {
    return items.map((item) => toPaise(item.discountAmount));
  }
  return allocateProportional(toPaise(order?.discountAmount), items.map(lineGrossPaise));
}

/**
 * What the buyer actually paid for one line, shipping aside — the most a
 * return of that line can ever refund.
 */
function linePaidPaise(order, index) {
  const item = order.items[index];
  return Math.max(0, lineGrossPaise(item) - lineDiscountsPaise(order)[index]);
}

/**
 * The index of the order line for (product, variant). With no variant given,
 * matches only when the product appears on exactly one line — two colours of
 * one product are two lines, and guessing between them would refund the
 * wrong one.
 */
function findLineIndex(order, productId, variantId = null) {
  const items = order?.items || [];
  const sameProduct = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => String(item.product) === String(productId));

  if (variantId) {
    const match = sameProduct.find(({ item }) => item.variantId && String(item.variantId) === String(variantId));
    return match ? match.index : -1;
  }
  return sameProduct.length === 1 ? sameProduct[0].index : -1;
}

module.exports = { lineGrossPaise, lineDiscountsPaise, linePaidPaise, findLineIndex };
