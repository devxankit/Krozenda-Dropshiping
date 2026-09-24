const CjSettings = require('../Models/CjSettings');
const cjAuthService = require('../services/cj/cjAuthService');
const cjPointsGuard = require('../services/cj/cjPointsGuard');

// Never echo the encrypted blobs or plaintext credentials to the frontend —
// only enough for the settings screen to show connection health (master plan
// §4/§25: CJ credentials never reach the browser).
function serializeSettings(settings) {
  return {
    environment: settings.environment,
    status: settings.status,
    hasCredentials: !!settings.encryptedApiKey,
    lastConnectionCheckAt: settings.lastConnectionCheckAt,
    lastSuccessAt: settings.lastSuccessAt,
    lastFailureAt: settings.lastFailureAt,
    failureReason: settings.failureReason,
    webhookConfigured: !!settings.webhookSecret,
    defaultMarkupPercent: settings.defaultMarkupPercent ?? 30,
    defaultMarkupType: settings.defaultMarkupType || 'PERCENT',
    defaultMarkupValue: settings.defaultMarkupValue ?? settings.defaultMarkupPercent ?? 30,
    priceRounding: settings.priceRounding || 'ROUND',
    dropshippingEnabled: settings.dropshippingEnabled !== false,
    // CJ API points as last reported by CJ (null until the first call since
    // start-up) — "out of points" is a quota, not a broken connection.
    apiPoints: cjPointsGuard.snapshot(),
    updatedAt: settings.updatedAt,
  };
}

// GET /admin/cj/settings
async function getSettings(req, res) {
  const settings = await CjSettings.getSettings();
  res.json({ success: true, data: serializeSettings(settings) });
}

// POST /admin/cj/settings/connect
// body: { email, apiKey, environment? }
async function connect(req, res) {
  const { email, apiKey, environment } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'email is required' });
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, message: 'apiKey is required' });
  }
  if (environment && !['SANDBOX', 'LIVE'].includes(environment)) {
    return res.status(400).json({ success: false, message: 'environment must be SANDBOX or LIVE' });
  }

  try {
    const settings = await cjAuthService.connect({
      email,
      apiKey,
      environment,
      updatedBy: req.admin?._id || null,
    });
    res.json({ success: true, message: 'CJ account connected', data: serializeSettings(settings) });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: cjAuthService.safeFailureMessage(err.code),
    });
  }
}

// POST /admin/cj/settings/disconnect
async function disconnect(req, res) {
  await cjAuthService.disconnect({ updatedBy: req.admin?._id || null });
  const settings = await CjSettings.getSettings();
  res.json({ success: true, message: 'CJ account disconnected', data: serializeSettings(settings) });
}

// POST /admin/cj/settings/test-connection
async function testConnection(req, res) {
  const result = await cjAuthService.testConnection();
  const settings = await CjSettings.getSettings();
  res.json({
    success: result.connected,
    message: result.connected ? 'CJ connection is healthy' : result.reason,
    data: serializeSettings(settings),
  });
}

// POST /admin/cj/settings/refresh-token
async function refreshToken(req, res) {
  try {
    await cjAuthService.getAccessToken({ forceRefresh: true });
    const settings = await CjSettings.getSettings();
    res.json({ success: true, message: 'CJ token refreshed', data: serializeSettings(settings) });
  } catch (err) {
    res.status(400).json({ success: false, message: cjAuthService.safeFailureMessage(err.code) });
  }
}

// POST /admin/cj/settings/markup
// body: { defaultMarkupType?, defaultMarkupValue?, defaultMarkupPercent?, priceRounding? }
async function updateMarkupSettings(req, res) {
  const { defaultMarkupType, defaultMarkupValue, defaultMarkupPercent, priceRounding } = req.body || {};
  const settings = await CjSettings.getSettings();

  if (defaultMarkupType != null) {
    if (!['PERCENT', 'FLAT'].includes(defaultMarkupType)) {
      return res.status(400).json({ success: false, message: 'defaultMarkupType must be PERCENT or FLAT' });
    }
    settings.defaultMarkupType = defaultMarkupType;
  }

  const valueToSet = defaultMarkupValue != null ? defaultMarkupValue : defaultMarkupPercent;
  if (valueToSet != null) {
    const parsed = Number(valueToSet);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ success: false, message: 'Markup value must be a non-negative number' });
    }
    settings.defaultMarkupValue = parsed;
    settings.defaultMarkupPercent = parsed;
  }

  if (priceRounding != null) {
    if (!['ROUND', '9_ENDING', 'NONE'].includes(priceRounding)) {
      return res.status(400).json({ success: false, message: 'priceRounding must be ROUND, 9_ENDING, or NONE' });
    }
    settings.priceRounding = priceRounding;
  }

  if (req.admin?._id) {
    settings.updatedBy = req.admin._id;
  }

  await settings.save();
  res.json({
    success: true,
    message: 'CJ markup and pricing rules updated',
    data: serializeSettings(settings),
  });
}

// POST /admin/cj/settings/visibility
// body: { dropshippingEnabled }
//
// The single global switch for "Show Dropshipping Products to Customers".
// Turning it off does not touch Product data or the admin/vendor catalog —
// it only hides CJ-fulfilled products (Product.fulfillmentProvider === 'CJ')
// from the buyer-facing listing/detail endpoints, see productController.
async function updateVisibilitySettings(req, res) {
  const { dropshippingEnabled } = req.body || {};

  if (typeof dropshippingEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'dropshippingEnabled must be true or false' });
  }

  const settings = await CjSettings.getSettings();
  settings.dropshippingEnabled = dropshippingEnabled;
  if (req.admin?._id) {
    settings.updatedBy = req.admin._id;
  }
  await settings.save();

  res.json({
    success: true,
    message: dropshippingEnabled
      ? 'Dropshipping products are now visible to customers'
      : 'Dropshipping products are now hidden from customers',
    data: serializeSettings(settings),
  });
}

module.exports = {
  getSettings,
  connect,
  disconnect,
  testConnection,
  refreshToken,
  updateMarkupSettings,
  updateVisibilitySettings,
};
