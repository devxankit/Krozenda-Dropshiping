const express = require('express');
const {
  getSettings,
  connect,
  testConnection,
  disconnect,
  setVisibility,
} = require('../Controllers/adminShopifySettingsController');
const {
  browseCatalogue,
  catalogueCount,
  getCatalogueProduct,
  importFromCatalogue,
  listImported,
  updateImportedProduct,
  bulkUpdateImported,
  removeImportedProduct,
  updateFulfilmentSettings,
  listOrderPushes,
  retryOrderPush,
  runPushNow,
  getWebhookHealth,
  registerWebhooks,
  unregisterWebhooks,
  syncImportedProducts,
  getSupplierEarnings,
  getPaymentExceptions,
} = require('../Controllers/adminShopifyCatalogController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

// Admin > Shopify. Mounted at /admin/shopify.
//
// Reading the connection and changing it are separate permissions on purpose:
// support staff need to see whether Shopify is healthy, but handing them the
// credential form means handing them the ability to point the whole catalog at
// a different store.

const router = express.Router();

router.use(protectAdmin);

router.get('/settings', requirePermission('admin.shopify.view'), getSettings);
router.post('/settings/connect', requirePermission('admin.shopify.settings'), connect);
router.post('/settings/test-connection', requirePermission('admin.shopify.settings'), testConnection);
router.post('/settings/disconnect', requirePermission('admin.shopify.settings'), disconnect);
router.put('/settings/visibility', requirePermission('admin.shopify.settings'), setVisibility);
router.put('/settings/fulfilment', requirePermission('admin.shopify.settings'), updateFulfilmentSettings);

// Order pushes. A FAILED row here is a paid order no supplier has been asked
// to ship, so this is an operational screen, not a log.
// Webhooks. Nothing subscribed means nothing comes back from Shopify, so
// this is a health screen rather than a settings one.
router.get('/webhooks', requirePermission('admin.shopify.settings'), getWebhookHealth);
router.post('/webhooks/register', requirePermission('admin.shopify.settings'), registerWebhooks);
router.delete('/webhooks', requirePermission('admin.shopify.settings'), unregisterWebhooks);

router.post('/products/sync', requirePermission('admin.shopify.sync'), syncImportedProducts);

// Money: what each supplier was sent and what Krozenda made on it, plus
// every state where money is somewhere it should not be.
router.get('/suppliers', requirePermission('admin.shopify.orders'), getSupplierEarnings);
router.get('/payment-exceptions', requirePermission('admin.shopify.orders'), getPaymentExceptions);

router.get('/order-pushes', requirePermission('admin.shopify.orders'), listOrderPushes);
router.post('/order-pushes/run-now', requirePermission('admin.shopify.orders'), runPushNow);
router.post('/order-pushes/:orderId/retry', requirePermission('admin.shopify.orders'), retryOrderPush);

// Browsing Shopify is a read of someone else's catalogue; importing writes to
// Krozenda's. Separate permissions, because the people who curate a catalogue
// are not always the people trusted to add to it.
router.get('/catalogue', requirePermission('admin.shopify.catalogue'), browseCatalogue);
router.get('/catalogue/count', requirePermission('admin.shopify.catalogue'), catalogueCount);
router.get('/catalogue/:id', requirePermission('admin.shopify.catalogue'), getCatalogueProduct);
router.post('/catalogue/import', requirePermission('admin.shopify.products'), importFromCatalogue);

router.get('/products', requirePermission('admin.shopify.products'), listImported);
router.post('/products/bulk', requirePermission('admin.shopify.products'), bulkUpdateImported);
router.patch('/products/:productId', requirePermission('admin.shopify.products'), updateImportedProduct);
router.delete('/products/:productId', requirePermission('admin.shopify.products'), removeImportedProduct);

module.exports = router;
