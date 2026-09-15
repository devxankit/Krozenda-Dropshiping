const mongoose = require('mongoose');
const Notification = require('../Models/Notification');
const { serializeNotification } = require('./notificationController');

async function listMyNotifications(req, res) {
  const notifications = await Notification.find({ vendor: req.vendor._id }).sort({ createdAt: -1 }).limit(100);
  const unreadCount = await Notification.countDocuments({ vendor: req.vendor._id, isRead: false });
  res.json({ success: true, data: { items: notifications.map(serializeNotification), unreadCount } });
}

async function markAsRead(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification id' });
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, vendor: req.vendor._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  res.json({ success: true, data: serializeNotification(notification) });
}

async function markAllRead(req, res) {
  await Notification.updateMany({ vendor: req.vendor._id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read' });
}

module.exports = { listMyNotifications, markAsRead, markAllRead };
