const mongoose = require('mongoose');
const Product = require('../Models/Product');
const PlatformSettings = require('../Models/PlatformSettings');
const { isFirebaseConfigured } = require('../Config/firebase');
const whatsapp = require('../services/whatsappService');

// Same reasoning as adminAnalyticsController's integrationHealth(): reported
// from what this server can actually see (live connection state and which
// provider credentials are present), never a decorative "operational" badge.
// This copy additionally carries the metadata the Settings > Integrations
// page needs (purpose, environment, owner, where to configure it) — fields
// the dashboard's health strip doesn't need.
function integrationRows() {
  const razorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const shiprocket = Boolean(process.env.SHIPPING_API_KEY);
  const sms = Boolean(process.env.SMS_INDIA_HUB_API_KEY);
  const smtp = Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_FROM));
  const fcm = Boolean(isFirebaseConfigured);

  const row = (configured, degraded = false) => (configured ? (degraded ? 'degraded' : 'operational') : 'not_configured');

  return [
    {
      id: 'razorpay',
      name: 'Razorpay Route',
      purpose: 'Payments and split settlement to vendor linked accounts',
      status: row(razorpay),
      note: razorpay ? null : 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set',
      environment: razorpay ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/payments',
    },
    {
      id: 'shiprocket',
      name: 'Shiprocket',
      purpose: 'AWB, courier allocation, pickup and tracking webhooks',
      status: row(shiprocket),
      note: shiprocket ? null : 'SHIPPING_API_KEY not set — manual dispatch',
      environment: shiprocket ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/logistics',
    },
    {
      id: 'sms',
      name: 'SMS India Hub',
      purpose: 'Transactional SMS and every OTP',
      status: row(sms),
      note: sms ? null : 'SMS_INDIA_HUB_API_KEY not set — OTPs go to the server log',
      environment: sms ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/notifications',
    },
    {
      id: 'smtp',
      name: 'SMTP',
      purpose: 'Order confirmations, invoices and verification links',
      status: row(smtp),
      note: smtp ? null : 'SMTP_HOST not set',
      environment: smtp ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/notifications',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp (BhashSMS)',
      purpose: 'Order placed and order status updates to the buyer',
      status: row(whatsapp.isConfigured(), !whatsapp.isEnabled()),
      note: !whatsapp.isConfigured()
        ? 'WHATSAPP_USER / WHATSAPP_PASS / WHATSAPP_SENDER not set'
        : whatsapp.isEnabled()
          ? null
          : 'Credentials set but sending is off (WHATSAPP_ENABLED)',
      environment: whatsapp.isEnabled() ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/notifications',
    },
    {
      id: 'fcm',
      name: 'Firebase Cloud Messaging',
      purpose: 'Push notifications to the buyer and seller apps',
      status: row(fcm),
      note: fcm ? 'Push only — no Firebase Auth, Firestore or Storage' : 'Service account not set',
      environment: fcm ? 'Live' : 'Not configured',
      lastEventAt: null,
      ownedBy: 'client',
      settingsPath: '/admin/settings/notifications',
    },
    {
      id: 'mongodb',
      name: 'Database',
      purpose: 'Primary application datastore',
      status: mongoose.connection.readyState === 1 ? 'operational' : 'down',
      note: mongoose.connection.readyState === 1 ? null : 'Connection lost',
      environment: 'Live',
      lastEventAt: null,
      ownedBy: 'platform',
      settingsPath: '/admin/settings/general',
    },
  ];
}

async function getIntegrations(req, res) {
  try {
    res.json({
      success: true,
      message: 'Integrations fetched successfully',
      data: { items: integrationRows() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch integrations' });
  }
}

// The five statutory GST slabs, with how many catalog products currently
// carry each rate — a real count off Product.gstRate, not a guess. Products
// with no rate classified yet (gstRate: null) are not counted in any slab.
const TAX_SLABS = [
  { rate: 0, label: 'Exempt' },
  { rate: 5, label: '5% — essentials' },
  { rate: 12, label: '12% — standard reduced' },
  { rate: 18, label: '18% — standard' },
  { rate: 28, label: '28% — luxury' },
];

async function getTaxSettings(req, res) {
  try {
    const counts = await Product.aggregate([
      { $match: { gstRate: { $in: TAX_SLABS.map((s) => s.rate) } } },
      { $group: { _id: '$gstRate', count: { $sum: 1 } } },
    ]);
    const countByRate = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    const platform = await PlatformSettings.getSettings();

    res.json({
      success: true,
      message: 'Tax settings fetched successfully',
      data: {
        slabs: TAX_SLABS.map((slab) => ({ ...slab, productCount: countByRate[slab.rate] || 0 })),
        defaults: {
          placeOfSupplyRule: "Buyer's shipping address determines the place of supply",
          hsnRequiredFrom: 'All taxable products — 6 or 8 digits',
          roundingRule: 'Round the invoice total to the nearest rupee',
          invoicePrefix: `${(platform.gstin || 'KZ').slice(0, 2)}/${new Date().getFullYear()}/`,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch tax settings' });
  }
}

module.exports = {
  getIntegrations,
  getTaxSettings,
};
