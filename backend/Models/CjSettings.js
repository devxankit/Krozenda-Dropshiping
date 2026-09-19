const mongoose = require('mongoose');

// CJ Dropshipping connection settings — one editable singleton, same pattern
// as PaymentSettings/CatalogSettings. CJ is an admin-only platform account
// (no per-seller credentials), so there is exactly one row.
//
// The API key is the long-lived credential CJ issues to the account; access
// and refresh tokens are short-lived and rotated by cjAuthService. All three
// are stored encrypted (secretBox) — never returned to the frontend in
// plaintext, see adminCjController's serializer.

const cjSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    environment: { type: String, enum: ['SANDBOX', 'LIVE'], default: 'LIVE' },

    encryptedApiKey: { type: String, default: '', select: false },
    encryptedEmail: { type: String, default: '', select: false },
    encryptedAccessToken: { type: String, default: '', select: false },
    encryptedRefreshToken: { type: String, default: '', select: false },
    accessTokenExpiresAt: { type: Date, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },

    webhookSecret: { type: String, default: '', select: false },

    status: {
      type: String,
      enum: ['DISCONNECTED', 'CONNECTED', 'FAILED'],
      default: 'DISCONNECTED',
    },
    lastConnectionCheckAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },

    defaultMarkupPercent: { type: Number, default: 30, min: 0 },
    defaultMarkupType: { type: String, enum: ['PERCENT', 'FLAT'], default: 'PERCENT' },
    defaultMarkupValue: { type: Number, default: 30, min: 0 },
    priceRounding: {
      type: String,
      enum: ['ROUND', '9_ENDING', 'NONE'],
      default: 'ROUND',
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

cjSettingsSchema.statics.getSettings = async function getSettings() {
  const existing = await this.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await this.create({ key: 'GLOBAL' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'GLOBAL' });
    throw err;
  }
};

// Re-select fields marked `select: false` — needed anywhere the encrypted
// credentials must actually be read (auth service), not just displayed.
cjSettingsSchema.statics.getSettingsWithSecrets = async function getSettingsWithSecrets() {
  await this.getSettings();
  return this.findOne({ key: 'GLOBAL' }).select(
    '+encryptedApiKey +encryptedEmail +encryptedAccessToken +encryptedRefreshToken +webhookSecret'
  );
};

const CjSettings = mongoose.model('CjSettings', cjSettingsSchema);

module.exports = CjSettings;
