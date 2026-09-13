const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const mongoose = require('mongoose');

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

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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
app.use('/admin/auth', require('./Router/adminAuthRoutes'));
app.use('/admin/staff', require('./Router/staffRoutes'));
app.use('/admin/roles', require('./Router/roleRoutes'));
app.use('/admin/catalog/products', require('./Router/productRoutes'));
app.use('/admin/catalog/categories', require('./Router/categoryRoutes'));
app.use('/admin/catalog/brands', require('./Router/brandRoutes'));
app.use('/admin/marketing/banners', require('./Router/bannerRoutes'));
app.use('/admin/marketing/coupons', require('./Router/couponRoutes'));
app.use('/admin/marketing/cms', require('./Router/cmsRoutes'));
app.use('/admin/marketing/faqs', require('./Router/faqRoutes'));
app.use('/admin/vendors', require('./Router/adminVendorRoutes'));
app.use('/admin/orders', require('./Router/adminOrderRoutes'));

app.use('/vendor/auth', require('./Router/vendorAuthRoutes'));
app.use('/vendor/documents', require('./Router/vendorDocumentRoutes'));

app.use('/catalog/categories', require('./Router/publicCategoryRoutes'));
app.use('/catalog/products', require('./Router/publicProductRoutes'));
app.use('/catalog/brands', require('./Router/publicBrandRoutes'));
app.use('/catalog/banners', require('./Router/publicBannerRoutes'));
app.use('/catalog/coupons', require('./Router/publicCouponRoutes'));
app.get('/public/cms/:slug', require('./Controllers/cmsController').getPublicCmsPage);
app.use('/faq', require('./Router/publicFaqRoutes'));

// Customer / Buyer mobile OTP authentication
app.use('/auth', require('./Router/userAuthRoutes'));
app.use('/user/wishlist', require('./Router/wishlistRoutes'));
app.use('/user/cart', require('./Router/cartRoutes'));
app.use('/user/addresses', require('./Router/addressRoutes'));
app.use('/user/wallet', require('./Router/walletRoutes'));
app.use('/user/orders', require('./Router/orderRoutes'));
app.use('/user/reviews', require('./Router/reviewRoutes'));
app.use('/user/coupons', require('./Router/userCouponRoutes'));

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
