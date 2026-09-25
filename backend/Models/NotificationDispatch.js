const mongoose = require('mongoose');

// One row per one-off outbound message that must never go out twice: a
// seller's "new order" WhatsApp, a payment reminder, an abandoned-cart nudge,
// a review request, a low-stock alert. The unique `key` IS the idempotency
// claim — whoever inserts it first sends, everyone else (a webhook retry, a
// second server instance running the same cron tick) sees the duplicate key
// and stays quiet.
//
// Order status WhatsApps keep using Order.whatsappLog and coupon offers keep
// CouponWhatsappLog; this is for everything that has no document of its own
// to hang a log on.
const STATUSES = ['SENDING', 'SENT', 'FAILED', 'SKIPPED'];

const notificationDispatchSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    channel: { type: String, enum: ['WHATSAPP', 'PUSH', 'MULTI'], default: 'MULTI' },
    status: { type: String, enum: STATUSES, default: 'SENDING' },
    messageId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

notificationDispatchSchema.index({ event: 1, createdAt: -1 });

/**
 * Claim `key`. True when this caller won the claim and should send; false
 * when someone already did. Any error other than the duplicate key is
 * rethrown — callers wrap this, it is never allowed to fail a request.
 */
notificationDispatchSchema.statics.claim = async function claim(key, { event, channel = 'MULTI' } = {}) {
  // The unique index IS the lock, so it must exist before the first insert —
  // on a fresh database autoIndex is still building it. init() is memoised.
  await this.init();
  try {
    await this.create({ key, event: event || key.split(':')[0], channel });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
};

notificationDispatchSchema.statics.finish = function finish(key, { status, messageId = null, error = null }) {
  return this.updateOne({ key }, { $set: { status, messageId, error: error ? String(error).slice(0, 300) : null } });
};

const NotificationDispatch = mongoose.model('NotificationDispatch', notificationDispatchSchema);
NotificationDispatch.STATUSES = STATUSES;

module.exports = NotificationDispatch;
