const express = require('express');
const { listCustomers, createCustomer, updateCustomerStatus } = require('../Controllers/customerController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin);

const uploadImage = [upload.single('image'), processImage('users', { width: 500, height: 500, fit: 'cover' }), handleUploadError];

router.get('/', requirePermission('admin.people.customers'), listCustomers);
router.post('/', requirePermission('admin.people.customers'), ...uploadImage, createCustomer);
router.patch('/:id/status', requirePermission('admin.people.customers'), updateCustomerStatus);

module.exports = router;
