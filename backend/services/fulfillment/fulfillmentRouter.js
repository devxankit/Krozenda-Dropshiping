const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');

// Which provider fulfils a product, and therefore which order a cart line
// belongs in.
//
// This replaces utils/dropship.js, which hardcoded 'CJ' in four places and
// answered a yes/no question ("is this dropship?"). The question that actually
// drives checkout is "WHICH provider?", because every provider gets its own
// order, its own delivery charge and its own cancel/return rules. Asking it as
// a boolean is what made adding a second provider a rewrite rather than a
// registry entry.
//
// To add a provider: add one row to PROVIDERS. Nothing else in checkout,
// quoting, cancellation or returns needs to know its name.

// provider code (as stored on Product.fulfillmentProvider and
// ProductFulfillmentMapping.provider) -> the Order.fulfillmentType its lines
// are grouped under. One provider per fulfillmentType: two providers sharing
// one type would land in a single order and then have to be told apart again
// at fulfilment time, which is the bug this table exists to prevent.
//
// A row here turns the provider on across checkout, quoting, cancellation,
// returns, invoicing and analytics at once. Its fulfillmentType must also be
// APPENDED to Order.FULFILLMENT_TYPES, or no such order can be saved.
const PROVIDERS = Object.freeze({
  SHOPIFY: { fulfillmentType: 'SHOPIFY' },
});

const STANDARD = 'STANDARD';

// Not a fulfillmentType and deliberately not in Order.FULFILLMENT_TYPES: a
// marker that a product names a provider nobody has registered.
const UNSUPPORTED = 'UNSUPPORTED';

// Every fulfillmentType that means "somebody outside Krozenda ships this".
const EXTERNAL_FULFILLMENT_TYPES = new Set(Object.values(PROVIDERS).map((p) => p.fulfillmentType));

const PROVIDER_CODES = Object.freeze(Object.keys(PROVIDERS));

/**
 * The provider code flagged on a Product document, or null.
 *
 * Product.fulfillmentProvider is a denormalized browse-time flag; it was added
 * after onboarding went live, so a product onboarded before it may carry only
 * a mapping row. Callers that must not miss one use the map builders below,
 * which check both sources.
 */
function providerOfProduct(product) {
  const code = product?.fulfillmentProvider;
  return code || null;
}

// A provider that is named in the data but not registered above resolves to
// UNSUPPORTED, never to STANDARD.
//
// This is the difference between "nobody fulfils this externally" and "the
// provider that fulfils this is not connected". Collapsing the second into the
// first is a money bug twice over: the line gets quoted a domestic carrier
// rate for a parcel nobody will book, and — because checkout only builds
// groups for types in Order.FULFILLMENT_TYPES — it can drop out of every group
// and be handed to the buyer without being charged for.
//
// Callers must reject UNSUPPORTED. computeCheckoutTotals does, with a 409.
function fulfillmentTypeOfProvider(code) {
  if (!code) return STANDARD;
  return PROVIDERS[code]?.fulfillmentType || UNSUPPORTED;
}

/**
 * @param {Array} products Product documents or plain objects carrying an _id.
 * @returns {Promise<Map<string,string>>} productId -> Order.fulfillmentType.
 *   Products with no external provider are absent, not mapped to STANDARD, so
 *   a caller can tell "no provider" from "not asked about".
 */
async function resolveFulfillmentByProductId(products) {
  const list = (products || []).filter(Boolean);
  const byProduct = new Map();

  const unflagged = [];
  for (const product of list) {
    const code = providerOfProduct(product);
    if (code) {
      byProduct.set(String(product._id || product.id), fulfillmentTypeOfProvider(code));
    } else {
      unflagged.push(product._id || product.id);
    }
  }

  // The flag is only a cache. The mapping row is the record, so an unflagged
  // product is not trusted until the mapping has been checked — the business
  // rules hanging off this answer (online payment only, how many orders the
  // cart becomes, who may cancel) cost real money when they are skipped.
  if (unflagged.length > 0) {
    const mapped = await ProductFulfillmentMapping.find({
      product: { $in: unflagged },
      provider: { $in: PROVIDER_CODES },
    })
      .select('product provider')
      .lean();
    for (const row of mapped) {
      byProduct.set(String(row.product), fulfillmentTypeOfProvider(row.provider));
    }
  }

  return byProduct;
}

/**
 * Same answer from bare ids. A product that has since been deleted still
 * counts through its mapping row, so an old order is still judged correctly.
 */
async function resolveFulfillmentByProductIds(productIds) {
  const ids = (productIds || []).filter(Boolean);
  if (ids.length === 0) return new Map();

  const Product = require('../../Models/Product');
  const products = await Product.find({ _id: { $in: ids } })
    .select('fulfillmentProvider')
    .lean();
  const known = new Set(products.map((p) => String(p._id)));
  const missing = ids.filter((id) => !known.has(String(id))).map((id) => ({ _id: id }));
  return resolveFulfillmentByProductId([...products, ...missing]);
}

/**
 * Is this order fulfilled by somebody other than Krozenda or one of its
 * sellers?
 *
 * Note the shape: every KNOWN fulfillmentType is answered from the field, and
 * only a value the registry has never heard of falls through to the line scan.
 * The old helper tested `=== 'STANDARD'` for its early return instead, so a
 * newly added provider's orders fell through to a line scan that queried for
 * the OLD provider, found nothing, and reported the order as ordinary — which
 * would have sent it down the marketplace cancellation path and refunded a
 * card payment into the buyer's wallet.
 */
async function isExternallyFulfilled(order) {
  const type = order?.fulfillmentType;
  if (type && EXTERNAL_FULFILLMENT_TYPES.has(type)) return true;
  if (type === STANDARD && order?.checkoutGroupId) return false;

  // Written before fulfillmentType existed: judge it by its lines.
  const byProduct = await resolveFulfillmentByProductIds((order?.items || []).map((item) => item.product));
  for (const fulfillmentType of byProduct.values()) {
    if (fulfillmentType !== STANDARD) return true;
  }
  return false;
}

module.exports = {
  PROVIDERS,
  UNSUPPORTED,
  PROVIDER_CODES,
  EXTERNAL_FULFILLMENT_TYPES,
  STANDARD,
  providerOfProduct,
  fulfillmentTypeOfProvider,
  resolveFulfillmentByProductId,
  resolveFulfillmentByProductIds,
  isExternallyFulfilled,
};
