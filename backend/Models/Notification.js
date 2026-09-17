const mongoose = require('mongoose');

const TYPES = ['ORDER', 'WALLET', 'OFFER', 'SYSTEM'];

const notificationSchema = new mongoose.Schema(
  {
    // Exactly one of user/vendor is set — see the pre-validate guard below.
    // vendor notifications reuse this same collection/shape rather than a
    // separate model, since listing/read/unread logic is identical.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    type: { type: String, enum: TYPES, default: 'SYSTEM' },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    // Lets the UI deep-link "View Order" / "Check Wallet" etc. straight to
    // the thing this notification is about, without parsing the message.
    actionType: { type: String, enum: ['ORDER', 'WALLET', 'NONE'], default: 'NONE' },
    actionRefId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ vendor: 1, createdAt: -1 });
notificationSchema.index({ vendor: 1, isRead: 1 });

notificationSchema.pre('validate', function guardOwner(next) {
  if (Boolean(this.user) === Boolean(this.vendor)) {
    return next(new Error('Notification must belong to exactly one of user or vendor'));
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);
Notification.TYPES = TYPES;

module.exports = Notification;
