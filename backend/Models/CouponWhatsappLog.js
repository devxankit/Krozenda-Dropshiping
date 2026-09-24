const mongoose = require('mongoose');

const STATUSES = ['SENDING', 'SENT', 'FAILED'];

// One row per (coupon, customer) WhatsApp offer message — see
// services/couponWhatsappService.js. The unique index doubles as the claim,
// so sending the same coupon to "all customers" twice (or a double click)
// never messages anyone a second time; only FAILED rows are retried.
const couponWhatsappLogSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    phone: { type: String, default: '' },
    template: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'SENDING' },
    messageId: { type: String, default: null },
    error: { type: String, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

couponWhatsappLogSchema.index({ couponId: 1, customerId: 1 }, { unique: true });
couponWhatsappLogSchema.index({ couponId: 1, status: 1 });

const CouponWhatsappLog = mongoose.model('CouponWhatsappLog', couponWhatsappLogSchema);
CouponWhatsappLog.STATUSES = STATUSES;

module.exports = CouponWhatsappLog;
