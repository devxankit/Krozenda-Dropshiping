const mongoose = require('mongoose');

// One row per Razorpay order created for a checkout (POST
// /user/orders/razorpay-order). An Order is only written AFTER payment is
// verified, so without this there is no trace of a buyer who reached the
// payment screen and then failed or gave up — which is exactly who a
// "complete your payment" reminder is for (Jobs/engagementJob).
//
// `failedAt` is set by the Razorpay payment.failed webhook; `capturedAt` by
// payment.captured when no order exists for the payment yet (money taken, no
// order — the job alerts admins if that is still true a few minutes later);
// `remindedAt` / `captureAlertedAt` by the job. Rows expire after 7 days.
const checkoutAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },
    remindedAt: { type: Date, default: null },
    capturedAt: { type: Date, default: null },
    razorpayPaymentId: { type: String, default: null },
    captureAlertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

checkoutAttemptSchema.index({ remindedAt: 1, createdAt: 1 });
checkoutAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('CheckoutAttempt', checkoutAttemptSchema);
