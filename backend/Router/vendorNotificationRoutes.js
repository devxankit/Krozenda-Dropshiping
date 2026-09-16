const express = require('express');
const { listMyNotifications, markAsRead, markAllRead } = require('../Controllers/vendorNotificationController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listMyNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllRead);

module.exports = router;
