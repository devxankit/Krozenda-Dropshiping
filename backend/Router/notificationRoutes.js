const express = require('express');
const { listNotifications, markAsRead, markAllRead, removeNotification } = require('../Controllers/notificationController');
const { registerUserFcmToken, removeUserFcmToken } = require('../Controllers/pushTokenController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

// Literal paths first: `/fcm-token` has to be matched before `/:id`, or a
// DELETE lands on removeNotification with "fcm-token" as the id.
router.post('/fcm-token', registerUserFcmToken);
router.delete('/fcm-token', removeUserFcmToken);

router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', removeNotification);

module.exports = router;
