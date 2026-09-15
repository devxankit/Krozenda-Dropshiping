const mongoose = require('mongoose');
const Notification = require('../Models/Notification');

function serializeNotification(n) {
  return {
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    message: n.message,
    actionType: n.actionType,
    actionRefId: n.actionRefId ? n.actionRefId.toString() : null,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

// Called from other controllers (order placement/status changes, wallet
// top-up) — not itself a route. Best-effort: a notification failing to
// write should never fail the order/payment flow that triggered it. Pass
// exactly one of userId/vendorId — see Notification's pre-validate guard.
async function createNotification({ userId, vendorId, type = 'SYSTEM', title, message, actionType = 'NONE', actionRefId = null }) {
  try {
    await Notification.create({
      user: userId || null,
      vendor: vendorId || null,
      type,
      title,
      message,
      actionType,
      actionRefId,
    });
  } catch (err) {
    console.error('[createNotification] failed:', err.message);
  }
}

async function listNotifications(req, res) {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: { items: notifications.map(serializeNotification) } });
}

async function markAsRead(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification id' });
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  res.json({ success: true, data: serializeNotification(notification) });
}

async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read' });
}

async function removeNotification(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification id' });
  }

  await Notification.deleteOne({ _id: id, user: req.user._id });
  res.json({ success: true, message: 'Notification removed', data: { id } });
}

module.exports = { createNotification, listNotifications, markAsRead, markAllRead, removeNotification, serializeNotification };
