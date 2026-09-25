const mongoose = require('mongoose');
const Notification = require('../Models/Notification');
const Customer = require('../Models/Customer');
const Vendor = require('../Models/Vendor');
const { readPagination, buildPagination } = require('../utils/pagination');
const { notifyUser, notifyVendor } = require('../utils/realtime');
const { sendToTokens } = require('../utils/pushHelper');
const { linkForNotification } = require('../utils/notificationLinks');

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
//
// THREE deliveries, in order of how much they can be relied on:
//
//   1. The row. Durable, and the only one that survives the recipient being
//      offline. Everything else is an optimisation on top of it.
//   2. A websocket emit, so an open panel updates without polling. Silently
//      does nothing when there is no socket server (tests, scripts).
//   3. An FCM push, so a seller with the tab closed still hears about an
//      order. Skipped when Firebase is not configured, and skipped when the
//      recipient has turned that category of notification off.
//
// 2 and 3 are fire-and-forget by design: a dead push token must never fail
// the order that triggered it.
//
// `link` overrides where tapping the push lands (default: derived from
// actionType/actionRefId). Resolves to the push result ({ successCount, ... })
// or null — callers that count deliveries (admin campaigns) read it, everyone
// else ignores it.
async function createNotification({ userId, vendorId, type = 'SYSTEM', title, message, actionType = 'NONE', actionRefId = null, link = null }) {
  let saved;
  try {
    saved = await Notification.create({
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
    return null;
  }

  const payload = serializeNotification(saved);

  try {
    if (vendorId) notifyVendor(vendorId, payload);
    else if (userId) notifyUser(userId, payload);
  } catch (err) {
    console.error('[createNotification] realtime emit failed:', err.message);
  }

  // Awaited rather than floated: an unawaited rejection here would surface as
  // an unhandledRejection and take the process down under the handler in
  // index.js. The whole call is wrapped, so it still cannot fail the caller.
  try {
    return await pushFor({ userId, vendorId, type, title, message, actionType, actionRefId, link });
  } catch (err) {
    console.error('[createNotification] push failed:', err.message);
    return null;
  }
}

// Which prefs gate which notification type. A seller who turned promotions off
// still gets told about an order — order updates are operational, not
// marketing, and conflating them is how sellers miss orders. OFFER is the
// stored type for marketing (Notification.TYPES has no PROMOTION).
function allowsPush(prefs, type) {
  if (!prefs) return true;
  if (type === 'OFFER' || type === 'PROMOTION') return prefs.promotions !== false;
  if (type === 'ORDER') return prefs.orderUpdates !== false;
  return true;
}

async function pushFor({ userId, vendorId, type, title, message, actionType, actionRefId, link }) {
  const Model = vendorId ? Vendor : Customer;
  const id = vendorId || userId;
  if (!id) return null;

  const recipient = await Model.findById(id).select('fcmTokens notificationPrefs').lean();
  if (!recipient?.fcmTokens?.length) return null;
  if (!allowsPush(recipient.notificationPrefs, type)) return null;

  const audience = vendorId ? 'vendor' : 'user';
  const tokens = recipient.fcmTokens.map((entry) => entry.token).filter(Boolean);
  const result = await sendToTokens(tokens, {
    title,
    body: message,
    data: {
      type,
      actionType,
      actionRefId: actionRefId ? String(actionRefId) : '',
      audience,
    },
    link: link || linkForNotification({ audience, type, actionType, actionRefId }),
  });

  // Uninstalled apps and revoked permissions leave tokens behind that will
  // never deliver again. Pruning them here keeps the send list from growing
  // without bound on a long-lived account.
  if (result.staleTokens.length > 0) {
    await Model.updateOne({ _id: id }, { $pull: { fcmTokens: { token: { $in: result.staleTokens } } } });
  }
  return result;
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

module.exports = { createNotification, allowsPush, listNotifications, markAsRead, markAllRead, removeNotification, serializeNotification };
