const mongoose = require('mongoose');

// Platform-wide catalog moderation policy, as one editable singleton —
// same pattern as ShippingSettings. The single field that decides behaviour
// is `autoApprovalEnabled`: when on, a seller-submitted category, brand or
// product is marked APPROVED immediately instead of sitting in the admin
// approval queue; when off (the default), everything a seller submits stays
// PENDING until an admin decides it.

const catalogSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    autoApprovalEnabled: { type: Boolean, default: false },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

catalogSettingsSchema.statics.getSettings = async function getSettings() {
  const existing = await this.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await this.create({ key: 'GLOBAL' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'GLOBAL' });
    throw err;
  }
};

module.exports = mongoose.model('CatalogSettings', catalogSettingsSchema);
