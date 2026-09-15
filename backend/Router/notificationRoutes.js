const express = require('express');
const { listNotifications, markAsRead, markAllRead, removeNotification } = require('../Controllers/notificationController');
const { registerUserFcmToken, removeUserFcmToken } = require('../Controllers/pushTokenController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', removeNotification);
router.post('/fcm-token', registerUserFcmToken);
router.delete('/fcm-token', removeUserFcmToken);

module.exports = router;
