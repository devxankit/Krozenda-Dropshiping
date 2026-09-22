const mongoose = require('mongoose');

// One pending reset token per admin/staff email — mirrors Models/VendorPasswordReset.js.
// Each new forgot-password call overwrites the previous row (upsert), and
// the TTL index auto-expires stale tokens so this collection never needs
// manual cleanup.
const adminPasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  tokenHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

adminPasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminPasswordReset', adminPasswordResetSchema);
