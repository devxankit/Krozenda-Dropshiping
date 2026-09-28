const mongoose = require('mongoose');

// One row per CJ webhook messageId. CJ retries a push up to 3 times, so the
// unique index is what turns a retry into a no-op instead of a second sync
// (and a second spend of CJ API points). Rows expire after a week — long
// past CJ's retry window.

const cjWebhookEventSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true },
    type: { type: String, default: '' },
    messageType: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('CjWebhookEvent', cjWebhookEventSchema);
