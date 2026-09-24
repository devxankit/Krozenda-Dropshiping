const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');

// Which products are fulfilled by CJ Dropshipping.
//
// The business rules that hang off this answer (online payment only, no
// cancellation, no return — and a mixed cart split into two orders) cost
// real money when they are skipped, so the answer is taken from BOTH places
// it can live: the Product.fulfillmentProvider flag, and the CJ mapping row.
// The flag was added after CJ onboarding went live, so products onboarded
// before it may carry only the mapping (see backfill-cj-fulfillment-flag.js).

function isFlaggedDropship(product) {
  return product?.fulfillmentProvider === 'CJ';
}

/**
 * @param {Array} products  Product documents or plain objects with an _id.
 * @returns {Promise<Set<string>>} ids (as strings) of the CJ-fulfilled ones.
 */
async function findDropshipProductIds(products) {
  const list = (products || []).filter(Boolean);
  const ids = new Set(list.filter(isFlaggedDropship).map((p) => String(p._id || p.id)));

  const unflagged = list.filter((p) => !isFlaggedDropship(p)).map((p) => p._id || p.id);
  if (unflagged.length > 0) {
    const mapped = await ProductFulfillmentMapping.find({ product: { $in: unflagged }, provider: 'CJ' }).distinct(
      'product'
    );
    mapped.forEach((id) => ids.add(String(id)));
  }

  return ids;
}

/**
 * Same answer as findDropshipProductIds, from bare ids. Products that have
 * since been deleted still count through their mapping row.
 */
async function findDropshipIdsByProductIds(productIds) {
  const ids = (productIds || []).filter(Boolean);
  if (ids.length === 0) return new Set();

  const Product = require('../Models/Product');
  const products = await Product.find({ _id: { $in: ids } }).select('fulfillmentProvider').lean();
  const known = new Set(products.map((p) => String(p._id)));
  const missing = ids.filter((id) => !known.has(String(id))).map((id) => ({ _id: id }));
  return findDropshipProductIds([...products, ...missing]);
}

/**
 * Is this ORDER a dropship one? New orders say so outright; an order written
 * before `fulfillmentType` existed is judged by its lines.
 */
async function isDropshipOrder(order) {
  if (order?.fulfillmentType === 'DROPSHIP') return true;
  if (order?.fulfillmentType === 'STANDARD' && order.checkoutGroupId) return false;

  const dropship = await findDropshipIdsByProductIds((order?.items || []).map((item) => item.product));
  return dropship.size > 0;
}

module.exports = { findDropshipProductIds, findDropshipIdsByProductIds, isDropshipOrder, isFlaggedDropship };
