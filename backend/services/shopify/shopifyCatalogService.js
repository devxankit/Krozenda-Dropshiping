const { graphql } = require('./shopifyClient');
const { withAuth } = require('./shopifyAuthService');

// Reading Shopify's catalogue. Writes nothing — browsing must never have a
// side effect on either side.

// Everything the import needs, for ONE product. Never used across a page —
// see LIST_FIELDS below for why.
//
// 100 variants and 25 images per product: enough for anything a dropshipping
// app produces, and bounded so the query cost stays predictable. A product
// that exceeds them is reported rather than silently truncated, because a
// half-imported variant set sells the wrong thing.
const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  descriptionHtml
  productType
  vendor
  status
  tags
  totalInventory
  createdAt
  updatedAt
  featuredMedia { ... on MediaImage { image { url width height } } }
  media(first: 25) { nodes { ... on MediaImage { image { url width height altText } } } }
  options { name values }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      barcode
      price
      compareAtPrice
      inventoryQuantity
      availableForSale
      selectedOptions { name value }
      image { url }
      inventoryItem {
        id
        tracked
        measurement { weight { value unit } }
        unitCost { amount currencyCode }
        inventoryLevels(first: 5) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } }
      }
    }
  }
`;

// The LIGHT shape, for browsing.
//
// Shopify prices a query on the fields REQUESTED, not the ones that exist, and
// caps a single query at 1000 points. Asking for 100 variants and 25 images
// per product across a page costs well over that and is rejected outright —
// which is exactly what happened the first time this ran.
//
// A browse screen does not need every variant; it needs enough to decide
// whether to import. So: a count, a handful of variants for the price range,
// and one image. The full shape is fetched per product at import time, where
// one product's worth of cost is affordable.
const LIST_FIELDS = `
  id
  title
  handle
  status
  productType
  vendor
  totalInventory
  updatedAt
  featuredMedia { ... on MediaImage { image { url } } }
  variantsCount { count }
  variants(first: 5) {
    nodes {
      id
      sku
      price
      inventoryQuantity
      inventoryItem { unitCost { amount } }
    }
  }
`;

const LIST_QUERY = `
  query ShopifyProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes { ${LIST_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SINGLE_QUERY = `
  query ShopifyProduct($id: ID!) {
    product(id: $id) { ${PRODUCT_FIELDS} }
  }
`;

const COUNT_QUERY = `
  query ShopifyProductCount { productsCount { count } }
`;

function run(query, variables, estimatedCost) {
  return withAuth(({ accessToken, shopDomain, apiVersion }) =>
    graphql({ query, variables, accessToken, shopDomain, apiVersion, estimatedCost })
  );
}

/**
 * One page of products, newest-changed first.
 *
 * @param {object} args
 * @param {number} [args.limit]  1..100
 * @param {string} [args.cursor] endCursor from a previous page
 * @param {string} [args.search] Shopify search syntax, e.g. "status:active"
 */
async function listProducts({ limit = 25, cursor = null, search = '' } = {}) {
  // Capped at 50, not 100: even the light shape costs roughly 8 points per
  // product, so a full 100 would approach the 1000-point single-query ceiling
  // again. 50 leaves headroom for Shopify to price it differently than we do.
  const first = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const data = await run(
    LIST_QUERY,
    { first, after: cursor || null, query: search || null },
    Math.max(20, first * 8)
  );
  return {
    products: data?.products?.nodes || [],
    hasNextPage: Boolean(data?.products?.pageInfo?.hasNextPage),
    cursor: data?.products?.pageInfo?.endCursor || null,
  };
}

async function getProduct(shopifyProductId) {
  const data = await run(SINGLE_QUERY, { id: shopifyProductId }, 20);
  return data?.product || null;
}

async function countProducts() {
  const data = await run(COUNT_QUERY, {}, 5);
  return data?.productsCount?.count ?? null;
}

/**
 * Every product, page by page.
 *
 * Deliberately a generator rather than an array: a store with thousands of
 * products would otherwise be held in memory in full before a single one is
 * imported, and the import could not report progress until it was done.
 */
async function* iterateAllProducts({ search = '', pageSize = 50 } = {}) {
  let cursor = null;
  do {
    const page = await listProducts({ limit: pageSize, cursor, search });
    for (const product of page.products) yield product;
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
}

module.exports = { listProducts, getProduct, countProducts, iterateAllProducts, PRODUCT_FIELDS, LIST_FIELDS };
