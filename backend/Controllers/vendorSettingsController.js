// Store Settings: bank payout details + notification preferences. Business
// profile (name/logo/address) is covered by vendorAuthController.updateProfile
// — kept separate since that endpoint already owns `vendor.business/address`.
const { sellerRatesFor } = require('../services/commissionResolver');

// The seller's headline rate comes from their CommissionRule (else the
// platform default) — the rule the ledger charges — not the legacy
// Vendor.commissionRatePercent field.
async function serializeSettings(vendor) {
  const rate = (await sellerRatesFor([vendor._id])).get(String(vendor._id));
  return {
    storeName: vendor.business?.businessName || vendor.name,
    commissionRatePercent: rate.ratePercent,
    commissionRateType: rate.type,
    commissionRateValue: rate.value,
    bank: vendor.bank || {},
    notificationPrefs: vendor.notificationPrefs || { orderUpdates: true, promotions: true },
  };
}

async function getMySettings(req, res) {
  res.json({ success: true, data: await serializeSettings(req.vendor) });
}

async function updateMySettings(req, res) {
  const { bank, notificationPrefs } = req.body;
  const vendor = req.vendor;

  if (bank) vendor.bank = { ...vendor.bank.toObject(), ...bank };
  if (notificationPrefs) {
    vendor.notificationPrefs = {
      orderUpdates: notificationPrefs.orderUpdates !== undefined ? Boolean(notificationPrefs.orderUpdates) : vendor.notificationPrefs.orderUpdates,
      promotions: notificationPrefs.promotions !== undefined ? Boolean(notificationPrefs.promotions) : vendor.notificationPrefs.promotions,
    };
  }

  await vendor.save();
  res.json({ success: true, message: 'Settings updated', data: await serializeSettings(vendor) });
}

module.exports = { getMySettings, updateMySettings };
