const mongoose = require('mongoose');

// Platform-wide payment method policy, as one editable singleton — same
// pattern as ShippingSettings/CatalogSettings. These three switches decide
// which payment methods a buyer may choose at checkout: orderController's
// createOrder rejects any paymentMethod whose switch here is off, and the
// checkout screen hides it the same way.

const paymentSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    codEnabled: { type: Boolean, default: true },
    razorpayEnabled: { type: Boolean, default: true },
    walletEnabled: { type: Boolean, default: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentSettingsSchema.statics.getSettings = async function getSettings() {
  const existing = await this.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await this.create({ key: 'GLOBAL' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'GLOBAL' });
    throw err;
  }
};

const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

// Maps a paymentMethod enum value ('COD' | 'RAZORPAY' | 'WALLET') to the
// settings field that gates it — the one place that spelling lives.
PaymentSettings.FIELD_BY_METHOD = {
  COD: 'codEnabled',
  RAZORPAY: 'razorpayEnabled',
  WALLET: 'walletEnabled',
};

module.exports = PaymentSettings;
