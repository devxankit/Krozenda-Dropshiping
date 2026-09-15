const express = require('express');
const { registerVendorFcmToken, removeVendorFcmToken } = require('../Controllers/pushTokenController');
const { listMyNotifications, markAsRead, markAllRead } = require('../Controllers/vendorNotificationController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.post('/fcm-token', registerVendorFcmToken);
router.delete('/fcm-token', removeVendorFcmToken);

router.get('/', listMyNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllRead);

module.exports = router;
