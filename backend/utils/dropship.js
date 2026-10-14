const {
  providerOfProduct,
  resolveFulfillmentByProductId,
  resolveFulfillmentByProductIds,
  isExternallyFulfilled,
  STANDARD,
} = require('../services/fulfillment/fulfillmentRouter');

// Compatibility shim. The real logic now lives in
// services/fulfillment/fulfillmentRouter.js, which answers "which provider?"
// instead of "is it dropship?" — see the comment at the top of that file.
//
// These four exports are kept so the callers that only need the old yes/no
// answer (cancellation, returns, auto-cancel, admin order screens) did not all
// have to change in the same commit as the checkout refactor. They are a thin
// translation and hold no logic of their own; new code should require the
// router directly.

function toIdSet(byProduct) {
  const ids = new Set();
  for (const [productId, fulfillmentType] of byProduct.entries()) {
    if (fulfillmentType !== STANDARD) ids.add(productId);
  }
  return ids;
}

function isFlaggedDropship(product) {
  return providerOfProduct(product) !== null;
}

async function findDropshipProductIds(products) {
  return toIdSet(await resolveFulfillmentByProductId(products));
}

async function findDropshipIdsByProductIds(productIds) {
  return toIdSet(await resolveFulfillmentByProductIds(productIds));
}

const isDropshipOrder = isExternallyFulfilled;

module.exports = { findDropshipProductIds, findDropshipIdsByProductIds, isDropshipOrder, isFlaggedDropship };
