const CjSettings = require('../Models/CjSettings');
const cjAuthService = require('../services/cj/cjAuthService');

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

module.exports = { getSettings, connect, disconnect, testConnection, refreshToken };
