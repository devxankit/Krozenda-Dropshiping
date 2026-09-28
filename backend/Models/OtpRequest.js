const mongoose = require('mongoose');

// One row per mobile number. It outlives the OTP it carries: the row is the
// rate-limit window (resend cooldown + sends per hour), so it is kept for the
// whole window and only the code inside it is cleared on use or lockout.
//
//   otpHash / otpExpiresAt   the live code, if any (null once used or locked)
//   lastSentAt               resend cooldown
//   windowStartedAt/sendCount sends allowed per window
//   expiresAt                TTL for the row itself = end of the window
//
// Rows written before the window existed carry only expiresAt (the OTP's own
// expiry); verifyOtp falls back to it.
const otpRequestSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true, index: true },
  otpHash: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  otpExpiresAt: { type: Date, default: null },
  lastSentAt: { type: Date, default: null },
  windowStartedAt: { type: Date, default: null },
  sendCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpRequest', otpRequestSchema);
