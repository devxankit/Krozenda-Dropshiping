require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = require('./app');
const connectDB = require('./Config/db');
const registerSocketHandlers = require('./Router/socketHandler');
const { attachSocketServer } = require('./utils/realtime');
const scheduleNightlyBackup = require('./Jobs/backupScheduler');
const { scheduleTrackingPoller } = require('./Jobs/trackingPoller');
const { scheduleCjSync } = require('./Jobs/cjSyncJob');
const { scheduleCjTrackingPoller } = require('./Jobs/cjTrackingPoller');
const migrateFcmTokens = require('./utils/migrateFcmTokens');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: app.ALLOWED_ORIGINS.length ? app.ALLOWED_ORIGINS : '*',
    credentials: true,
  },
});

registerSocketHandlers(io);
// Hands the socket server to utils/realtime, which is what controllers
// emit through. Anything importing `app` without this file (the test
// suite, scripts) simply has no socket server and every emit no-ops.
attachSocketServer(io);

// Seeding is intentionally not part of boot. Run `npm run seed` when a
// database needs the admin/vendor/catalog fixtures.
async function start() {
  await connectDB();
  // Schema fix-up, not seeding — it must run before the first request can
  // hydrate a User/Vendor holding a legacy string token. No-op once applied.
  await migrateFcmTokens();
  scheduleNightlyBackup();
  // Fallback for lost carrier webhooks; no-op when shipping is disabled.
  await scheduleTrackingPoller();
  // Fallback for lost/absent CJ webhooks — see Jobs/cjSyncJob.
  scheduleCjSync();
  scheduleCjTrackingPoller();

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (${process.env.ENV || 'development'})`);
  });
}

start();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received: closing server gracefully`);

  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('HTTP server and MongoDB connection closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
