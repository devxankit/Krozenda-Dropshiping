const PaymentSettings = require('../Models/PaymentSettings');

function serializeSettings(settings) {
  return {
    codEnabled: settings.codEnabled,
    razorpayEnabled: settings.razorpayEnabled,
    walletEnabled: settings.walletEnabled,
    updatedAt: settings.updatedAt,
  };
}

// GET /admin/payments/settings
async function getSettings(req, res) {
  const settings = await PaymentSettings.getSettings();
  res.json({ success: true, data: serializeSettings(settings) });
}

function readBoolean(body, key, current) {
  return typeof body[key] === 'boolean' ? body[key] : current;
}

// PUT /admin/payments/settings
async function updateSettings(req, res) {
  const body = req.body || {};
  const settings = await PaymentSettings.getSettings();

  settings.codEnabled = readBoolean(body, 'codEnabled', settings.codEnabled);
  settings.razorpayEnabled = readBoolean(body, 'razorpayEnabled', settings.razorpayEnabled);
  settings.walletEnabled = readBoolean(body, 'walletEnabled', settings.walletEnabled);

  if (!settings.codEnabled && !settings.razorpayEnabled && !settings.walletEnabled) {
    return res.status(400).json({ success: false, message: 'At least one payment method must stay enabled' });
  }

  settings.updatedBy = req.admin?._id || null;
  await settings.save();

  res.json({ success: true, message: 'Payment settings updated', data: serializeSettings(settings) });
}

module.exports = { getSettings, updateSettings };
