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

// --- Static uploads ---
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

// --- Routes ---
app.use('/admin/auth', require('./Router/adminAuthRoutes'));
app.use('/admin/staff', require('./Router/staffRoutes'));
app.use('/admin/roles', require('./Router/roleRoutes'));
app.use('/admin/catalog/categories', require('./Router/categoryRoutes'));
app.use('/admin/catalog/brands', require('./Router/brandRoutes'));

// Mount remaining resource routers here as they're built, grouped by audience prefix:
//   app.use('/admin/<domain>/<resource>', require('./Router/<resource>Routes'));
//   app.use('/vendor/auth', require('./Router/vendorAuthRoutes'));
//   app.use('/vendor/<resource>', require('./Router/<resource>Routes'));
//   app.use('/auth', require('./Router/authRoutes'));
//   app.use('/<resource>', require('./Router/<resource>Routes'));

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
