const CatalogSettings = require('../Models/CatalogSettings');

// Admin's "Own stock" switch (sidebar toggle in the admin panel). It is the
// same flag as CatalogSettings.sellerOnlyMode, read the other way round:
//   own stock ON  (sellerOnlyMode false) — admin can add categories, brands and
//                 products, and admin's own products are sold on the storefront.
//   own stock OFF (sellerOnlyMode true)  — admin creation is blocked (see
//                 createCategory/createBrand/createProduct) AND admin's own
//                 products are withheld from buyers; only seller and
//                 dropshipping (CJ) products remain.
//
// "Own stock" is not stored on the product, it is derived: no vendor and not
// CJ-fulfilled. Same rule as inventoryController's bucket and
// adminReviewController's product type.

function isOwnStockProduct(product) {
  return Boolean(product) && !product.vendor && product.fulfillmentProvider !== 'CJ';
}

async function isOwnStockVisibleToCustomers() {
  const settings = await CatalogSettings.getSettings();
  return settings.sellerOnlyMode !== true;
}

// Spread into a Product query (or an aggregate $match) to drop own-stock
// products. $nor rather than $or so it never collides with a query's own
// $or (search uses one). `vendor: null` also matches a missing field, and
// `$ne: 'CJ'` matches products that predate fulfillmentProvider.
const EXCLUDE_OWN_STOCK = Object.freeze({
  $nor: [{ vendor: null, fulfillmentProvider: { $ne: 'CJ' } }],
});

module.exports = { isOwnStockProduct, isOwnStockVisibleToCustomers, EXCLUDE_OWN_STOCK };
