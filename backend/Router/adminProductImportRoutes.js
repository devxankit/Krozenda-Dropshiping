const express = require('express');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { createProductImportRouter } = require('./productImportRoutes');

// Admin CSV import. Runs in PREVIEW mode: valid rows become Draft,
// platform-owned products (vendor: null) flagged importPreview, shown in the
// product list and made live by POST /approve-products.
const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.products'));
router.use(
  createProductImportRouter({
    scopeFrom: (req) => ({
      ownerType: 'ADMIN',
      mode: 'PREVIEW',
      vendorId: null,
      actorId: req.admin._id,
      actorName: req.admin.name || req.admin.email || 'Admin',
    }),
  })
);

module.exports = router;
