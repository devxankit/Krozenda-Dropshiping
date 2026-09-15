const mongoose = require('mongoose');

// One pending reset code per vendor email — mirrors Models/OtpRequest.js.
// Each new forgot-password call overwrites the previous row (upsert), and
// the TTL index auto-expires stale codes so this collection never needs
// manual cleanup.
const vendorPasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

vendorPasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VendorPasswordReset', vendorPasswordResetSchema);
