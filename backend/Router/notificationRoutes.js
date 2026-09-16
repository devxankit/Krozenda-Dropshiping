const express = require('express');
const { listNotifications, markAsRead, markAllRead, removeNotification } = require('../Controllers/notificationController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', removeNotification);

module.exports = router;
