require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = require('./app');
const connectDB = require('./Config/db');
const registerSocketHandlers = require('./Router/socketHandler');
const ensureAdmin = require('./Router/seedAdmin');
const ensureDemoVendors = require('./Router/seedVendors');
const seedCatalog = require('./Router/seedCatalog');
const scheduleNightlyBackup = require('./Jobs/backupScheduler');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: app.ALLOWED_ORIGINS.length ? app.ALLOWED_ORIGINS : '*',
    credentials: true,
  },
});

registerSocketHandlers(io);

async function start() {
  await connectDB();
  await ensureAdmin();
  await ensureDemoVendors();
  await seedCatalog();
  scheduleNightlyBackup();

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
