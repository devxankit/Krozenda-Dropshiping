const ShopifySettings = require('../Models/ShopifySettings');
const CatalogSettings = require('../Models/CatalogSettings');
const secretBox = require('../utils/secretBox');
const authService = require('../services/shopify/shopifyAuthService');
const connectionService = require('../services/shopify/shopifyConnectionService');

// Admin > Settings > Shopify.
//
// Every response goes through ShopifySettings.toSafeJSON(), which is an
// allowlist — a credential cannot reach the admin screen even by accident.

function fail(res, status, message, code) {
  return res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
}

// GET /admin/shopify/settings
async function getSettings(req, res) {
  const settings = await ShopifySettings.getSettings();
  const catalog = await CatalogSettings.getSettings();
  return res.json({
    success: true,
    message: 'Shopify settings fetched',
    data: {
      ...settings.toSafeJSON(),
      requiredScopes: connectionService.SCOPES_REQUIRED,
      missingScopes: connectionService.missingScopes(settings.grantedScopes),
      // The storefront kill-switch lives on CatalogSettings, but the Shopify
      // screen is where an admin looks for it, so it is surfaced here too.
      storefrontVisible: catalog.externalFulfillmentVisible !== false,
    },
  });
}

// POST /admin/shopify/settings/connect
async function connect(req, res) {
  const { shopDomain, clientId, clientSecret, apiVersion } = req.body || {};

  if (!shopDomain || !clientId || !clientSecret) {
    return fail(res, 400, 'Shop domain, client ID and client secret are all required.');
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(String(shopDomain).trim().replace(/^https?:\/\//, ''))) {
    return fail(
      res,
      400,
      'The shop domain must be the permanent .myshopify.com one (for example krozenda.myshopify.com), not a custom domain.'
    );
  }
  // Without the encryption key the credentials would be stored in plain text.
  // Refuse rather than do that.
  if (!secretBox.isConfigured()) {
    return fail(
      res,
      503,
      'Credential encryption is not configured on this server, so Shopify credentials cannot be stored safely. Set SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY and try again.',
      'ENCRYPTION_NOT_CONFIGURED'
    );
  }

  await authService.saveCredentials({
    shopDomain,
    clientId,
    clientSecret,
    apiVersion,
    adminId: req.admin?._id || null,
  });

  // Prove it works before reporting success — saving credentials that do not
  // work and calling it "connected" is the failure an admin discovers days
  // later, from a cron job.
  const result = await connectionService.testConnection({ adminId: req.admin?._id || null });
  if (!result.ok) {
    return res.status(502).json({
      success: false,
      message: `Saved, but Shopify refused the connection: ${result.message}`,
      code: result.code,
      data: result.settings,
    });
  }

  return res.json({
    success: true,
    message: result.warnings.length
      ? 'Connected to Shopify, with warnings.'
      : 'Connected to Shopify.',
    data: result,
  });
}

// POST /admin/shopify/settings/test-connection
async function testConnection(req, res) {
  const result = await connectionService.testConnection({ adminId: req.admin?._id || null });
  if (!result.ok) return res.status(502).json({ success: false, message: result.message, code: result.code, data: result.settings });
  return res.json({ success: true, message: 'Shopify connection is working.', data: result });
}

// POST /admin/shopify/settings/disconnect
async function disconnect(req, res) {
  const settings = await authService.disconnect({ adminId: req.admin?._id || null });
  return res.json({ success: true, message: 'Disconnected from Shopify.', data: settings.toSafeJSON() });
}

// PUT /admin/shopify/settings/visibility
async function setVisibility(req, res) {
  const { visible } = req.body || {};
  if (typeof visible !== 'boolean') return fail(res, 400, 'visible must be true or false.');

  const catalog = await CatalogSettings.getSettings();
  catalog.externalFulfillmentVisible = visible;
  catalog.updatedBy = req.admin?._id || null;
  await catalog.save();

  return res.json({
    success: true,
    message: visible
      ? 'Externally fulfilled products are visible to buyers.'
      : 'Externally fulfilled products are hidden from buyers.',
    data: { storefrontVisible: visible },
  });
}

module.exports = { getSettings, connect, testConnection, disconnect, setVisibility };
