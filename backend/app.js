const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const mongoose = require('mongoose');
const { globalRateLimiter } = require('./Middlewares/rateLimiter');

const app = express();
const isProduction = process.env.ENV === 'production';

// --- Security & performance middleware ---
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// exposed so index.js can reuse the same allowlist for socket.io CORS
app.ALLOWED_ORIGINS = ALLOWED_ORIGINS;

app.use(
  cors({
    origin(origin, callback) {
      if (!isProduction || !origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// 10kb is the right ceiling for every write in this API — an order, a review,
// a product edit — and it stays the default. /translate is the one exception:
// it carries a whole screen's worth of UI strings in one array, which clears
// 10kb on the larger admin tables, and it writes nothing, so a bigger body
// costs a parse and nothing else. Its own limiter caps the array length.
const jsonParser = express.json({ limit: '10kb' });
const translateJsonParser = express.json({ limit: '128kb' });
app.use((req, res, next) => (req.path.startsWith('/translate') ? translateJsonParser : jsonParser)(req, res, next));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(globalRateLimiter);

// Express 5 makes req.query a read-only getter, so keys are stripped in
// place instead of reassigning req.body/query/params.
function sanitizeInPlace(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.startsWith('.')) {
      delete value[key];
      continue;
    }
    sanitizeInPlace(value[key]);
  }
}

app.use((req, res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.query);
  sanitizeInPlace(req.params);
  next();
});

// --- Static uploads & brand assets ---
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    acceptRanges: true,
    setHeaders(res) {
      res.set('Accept-Ranges', 'bytes');
    },
  })
);
app.use(
  '/brands',
  express.static(path.join(__dirname, 'brands'), {
    maxAge: '7d',
  })
);

// --- Routes ---
// Audience-neutral: buyers, vendors, admins and staff all register their push
// devices here, on whichever token they happen to be signed in with.
app.use('/fcm-token', require('./Router/pushTokenRoutes'));

app.use('/admin/auth', require('./Router/adminAuthRoutes'));
// Reporting surface (dashboard + analytics). Mounted on /admin itself, so it
// must declare only its own paths.
app.use('/admin', require('./Router/adminAnalyticsRoutes'));
app.use('/admin/staff', require('./Router/staffRoutes'));
app.use('/admin/roles', require('./Router/roleRoutes'));
app.use('/admin/catalog/approvals', require('./Router/adminApprovalRoutes'));
app.use('/admin/catalog/products', require('./Router/productRoutes'));
app.use('/admin/catalog/categories', require('./Router/categoryRoutes'));
app.use('/admin/catalog/brands', require('./Router/brandRoutes'));
app.use('/admin/catalog/inventory', require('./Router/inventoryRoutes'));
app.use('/admin/marketing/banners', require('./Router/bannerRoutes'));
app.use('/admin/marketing/coupons', require('./Router/couponRoutes'));
app.use('/admin/marketing/cms', require('./Router/cmsRoutes'));
app.use('/admin/marketing/faqs', require('./Router/faqRoutes'));
app.use('/admin/marketing/campaigns', require('./Router/adminCampaignRoutes'));
app.use('/admin/customers', require('./Router/customerRoutes'));
app.use('/admin/vendors', require('./Router/adminVendorRoutes'));
app.use('/admin/orders', require('./Router/adminOrderRoutes'));
app.use('/admin/returns', require('./Router/adminReturnRoutes'));
app.use('/admin/support/tickets', require('./Router/adminTicketRoutes'));
app.use('/admin/system/backups', require('./Router/adminBackupRoutes'));
app.use('/admin/finance', require('./Router/adminFinanceRoutes'));
app.use('/admin/accounting', require('./Router/adminAccountingRoutes'));
app.use('/admin', require('./Router/adminFulfilmentRoutes'));
// Carrier-backed shipments live under /admin/shipping, NOT /admin/shipments.
// That path is already taken: adminFulfilmentRoutes above declares GET
// /shipments, and because it is mounted on the bare '/admin' prefix it matches
// first and would shadow anything mounted at /admin/shipments afterwards.
// The older screen derives pseudo-shipments from Order.items[].trackingNumber
// — the manual flow that predates this integration — and it keeps working.
app.use('/admin/shipping/shipments', require('./Router/adminShipmentRoutes'));
app.use('/admin/shipping', require('./Router/adminShippingRoutes'));

app.use('/vendor/auth', require('./Router/vendorAuthRoutes'));
app.use('/vendor', require('./Router/vendorDashboardRoutes'));
app.use('/vendor/documents', require('./Router/vendorDocumentRoutes'));
app.use('/vendor/notifications', require('./Router/vendorNotificationRoutes'));
app.use('/vendor/tickets', require('./Router/vendorTicketRoutes'));
app.use('/vendor/products', require('./Router/vendorProductRoutes'));
app.use('/vendor/inventory', require('./Router/vendorInventoryRoutes'));
app.use('/vendor/orders', require('./Router/vendorOrderRoutes'));
app.use('/vendor/customers', require('./Router/vendorCustomerRoutes'));
app.use('/vendor/coupons', require('./Router/vendorCouponRoutes'));
app.use('/vendor/reviews', require('./Router/vendorReviewRoutes'));
app.use('/vendor/returns', require('./Router/vendorReturnRoutes'));
app.use('/vendor/earnings', require('./Router/vendorEarningsRoutes'));
app.use('/vendor/analytics', require('./Router/vendorAnalyticsRoutes'));
app.use('/vendor/settings', require('./Router/vendorSettingsRoutes'));
app.use('/vendor/catalog', require('./Router/vendorCatalogRoutes'));
app.use('/vendor/shipping', require('./Router/vendorShippingRoutes'));
app.use('/vendor/shipments', require('./Router/vendorShipmentRoutes'));

app.use('/catalog/categories', require('./Router/publicCategoryRoutes'));
app.use('/catalog/products', require('./Router/publicProductRoutes'));
app.use('/catalog/brands', require('./Router/publicBrandRoutes'));
app.use('/catalog/banners', require('./Router/publicBannerRoutes'));
app.use('/catalog/coupons', require('./Router/publicCouponRoutes'));
app.get('/public/cms/:slug', require('./Controllers/cmsController').getPublicCmsPage);
app.use('/faq', require('./Router/publicFaqRoutes'));
// Runtime UI translation. Unauthenticated like /catalog/*, because the
// language switcher has to work before anyone signs in.
app.use('/translate', require('./Router/translateRoutes'));

// Customer / Buyer mobile OTP authentication
app.use('/auth', require('./Router/userAuthRoutes'));
app.use('/user/wishlist', require('./Router/wishlistRoutes'));
app.use('/user/cart', require('./Router/cartRoutes'));
app.use('/user/addresses', require('./Router/addressRoutes'));
app.use('/user/wallet', require('./Router/walletRoutes'));
app.use('/user/orders', require('./Router/orderRoutes'));
app.use('/user/reviews', require('./Router/reviewRoutes'));
app.use('/user/coupons', require('./Router/userCouponRoutes'));
app.use('/user/notifications', require('./Router/notificationRoutes'));
app.use('/user/returns', require('./Router/returnRoutes'));
app.use('/user/tickets', require('./Router/ticketRoutes'));
// Gemini-backed customer assistant. Scoped to /user like every other
// buyer-facing surface, and authenticated inside the router itself.
app.use('/user/ai', require('./Router/aiRoutes'));
// Carrier webhooks. Mounted OUTSIDE every auth router on purpose: the carrier
// has no account with us and cannot present a bearer token. The endpoint
// authenticates itself with a shared secret — see shipmentWebhookController.
//
// Singular and provider-less because the carrier's own setup screen rejects
// URLs containing its name. Behind the production proxy (which strips /api)
// this is reachable at https://<host>/api/webhook.
app.use('/webhook', require('./Router/webhookRoutes'));

app.get('/health', async (req, res) => {
  const readyState = mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  let db = 'disconnected';

  try {
    if (readyState === 1) {
      await mongoose.connection.db.admin().ping();
      db = 'connected';
    } else if (readyState === 2) {
      db = 'connecting';
    }
  } catch (err) {
    db = 'error';
  }

  res.json({
    status: 'ok',
    db,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  console.error({
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(status).json({
    success: false,
    message: isProduction && status === 500 ? 'Something went wrong' : err.message,
  });
});

module.exports = app;
