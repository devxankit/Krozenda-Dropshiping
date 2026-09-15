const mongoose = require('mongoose');

// One pending OTP per mobile number — each new send-otp call overwrites the
// previous one (upsert), and the TTL index below auto-expires stale rows so
// this collection never needs manual cleanup.
const otpRequestSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true, index: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpRequest', otpRequestSchema);
