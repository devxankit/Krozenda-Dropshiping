const mongoose = require('mongoose');
const Notification = require('../Models/Notification');
const { readPagination, buildPagination } = require('../utils/pagination');

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

// Was a flat `.limit(100)` with no way to reach anything older, and no unread
// count — so the header badge had to derive one from whichever 100 rows it
// happened to receive.
async function listNotifications(req, res) {
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({
    success: true,
    message: 'Notifications fetched successfully',
    data: { items: notifications.map(serializeNotification), total, unreadCount },
    pagination: buildPagination({ page, limit, total }),
  });
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
