const mongoose = require('mongoose');

// Password sign-in attempts per account (see utils/loginThrottle). Kept in
// Mongo rather than process memory so the limit holds across every PM2
// instance, and so a restart does not hand an attacker a fresh budget.
const loginThrottleSchema = new mongoose.Schema({
  // `${audience}:${normalised email}` — keyed on the NAME tried, whether or
  // not an account exists, so the response never tells the two apart.
  key: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  windowStartedAt: { type: Date, required: true },
  lockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});

loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginThrottle', loginThrottleSchema);
