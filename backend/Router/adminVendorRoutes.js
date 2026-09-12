const express = require('express');
const {
  listVendors,
  getVendor,
  updateVendorStatus,
  toggleVendorActive,
  reviewVendorDocument,
} = require('../Controllers/adminVendorController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/', requirePermission('admin.people.sellers'), listVendors);
router.get('/:id', requirePermission('admin.people.sellers'), getVendor);
router.patch('/:id/status', requirePermission('admin.kyc.review'), updateVendorStatus);
router.patch('/:id/active', requirePermission('admin.people.sellers'), toggleVendorActive);
router.patch('/:vendorId/documents/:documentId', requirePermission('admin.kyc.review'), reviewVendorDocument);

module.exports = router;
