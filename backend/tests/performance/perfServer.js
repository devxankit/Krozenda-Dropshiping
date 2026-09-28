// Isolated load-test target: the real Express app + socket.io, on an
// in-memory MongoDB replica set, seeded with a realistic catalogue.
//
//   node tests/performance/perfServer.js            (port 5055)
//
// SAFETY — this process must never touch shared or third-party systems:
//   * MONGODB_URL is replaced with a throwaway in-memory replica set;
//   * every third-party credential (Razorpay, Shiprocket, SMS, WhatsApp,
//     Firebase, Gemini, SMTP, CJ) is blanked BEFORE the app is required;
//   * global fetch refuses any host that is not localhost;
//   * cron jobs (backups, pollers, settlement automation) are not started.
//
// It also exposes /__perf/stats and /__perf/reset (CPU, RSS, heap, event-loop
// delay, Mongo opcounters and the slowest profiled queries) for the runner.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BLANK = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAYX_ACCOUNT_NUMBER', 'RAZORPAYX_WEBHOOK_SECRET',
  'SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'SHIPPING_API_KEY', 'SHIPROCKET_WEBHOOK_TOKEN',
  'SMS_INDIA_HUB_API_KEY', 'WHATSAPP_ENABLED', 'WHATSAPP_USER', 'WHATSAPP_PASS', 'EMAIL_ENABLED', 'SMTP_HOST',
  'FIREBASE_SERVICE_ACCOUNT_BASE64', 'FIREBASE_SERVICE_ACCOUNT', 'GEMINI_API_KEY', 'CJ_API_KEY',
];
for (const key of BLANK) process.env[key] = '';
process.env.ENV = 'loadtest'; // not 'production' (fixed dev OTP), not 'test' (real validation paths)
process.env.RAZORPAY_KEY_ID = 'rzp_test_loadtest';
process.env.RAZORPAY_KEY_SECRET = 'loadtest';

const realFetch = global.fetch;
global.fetch = (url, ...rest) => {
  const host = new URL(String(url)).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    return Promise.reject(new Error(`[perfServer] outbound call blocked: ${host}`));
  }
  return realFetch(url, ...rest);
};

const fs = require('fs');
const http = require('http');
const { monitorEventLoopDelay } = require('perf_hooks');
const { MongoMemoryReplSet } = require(require.resolve('mongodb-memory-server-core', {
  paths: [path.join(__dirname, '..', '..', 'node_modules', '@shelf', 'jest-mongodb', 'node_modules')],
}));

const PORT = Number(process.env.PERF_PORT || 5055);
const SEED = {
  categories: 12,
  vendors: 20,
  products: Number(process.env.PERF_PRODUCTS || 3000),
  customers: 300,
  orders: Number(process.env.PERF_ORDERS || 6000),
};

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URL = replSet.getUri('krozenda_loadtest');

  const mongoose = require('mongoose');
  const os = require('os');
  await mongoose.connect(process.env.MONGODB_URL, { maxPoolSize: 20, runtimeAdapters: { os } });

  const express = require('express');
  const { Server } = require('socket.io');
  const app = require('../../app');
  const registerSocketHandlers = require('../../Router/socketHandler');
  const { attachSocketServer } = require('../../utils/realtime');

  // Build every declared index before traffic, as a long-running server would have.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const fixtures = await seed(mongoose);
  fs.writeFileSync(path.join(__dirname, 'fixtures.json'), JSON.stringify(fixtures));

  // Profile everything slower than 20ms, for the slow-query/missing-index report.
  await mongoose.connection.db.command({ profile: 1, slowms: 20 });

  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();
  const peaks = { cpu: 0, rss: 0, heap: 0 };
  let lastCpu = process.cpuUsage();
  let lastAt = process.hrtime.bigint();
  setInterval(() => {
    const now = process.hrtime.bigint();
    const cpu = process.cpuUsage(lastCpu);
    const elapsedUs = Number(now - lastAt) / 1000;
    const pct = ((cpu.user + cpu.system) / elapsedUs) * 100;
    const mem = process.memoryUsage();
    peaks.cpu = Math.max(peaks.cpu, pct);
    peaks.rss = Math.max(peaks.rss, mem.rss);
    peaks.heap = Math.max(peaks.heap, mem.heapUsed);
    lastCpu = process.cpuUsage();
    lastAt = now;
  }, 500).unref();

  const outer = express();
  outer.get('/__perf/stats', async (req, res) => {
    const db = mongoose.connection.db;
    const status = await db.admin().serverStatus();
    const slow = await db
      .collection('system.profile')
      .find({ ns: { $not: /system\.profile$/ } })
      .sort({ millis: -1 })
      .limit(15)
      .project({ op: 1, ns: 1, millis: 1, planSummary: 1, docsExamined: 1, keysExamined: 1, nreturned: 1, 'command.filter': 1, 'command.pipeline': 1 })
      .toArray();
    const mem = process.memoryUsage();
    res.json({
      peakCpuPercent: Math.round(peaks.cpu),
      peakRssMb: Math.round(peaks.rss / 1048576),
      peakHeapMb: Math.round(peaks.heap / 1048576),
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      eventLoopDelayMs: {
        p50: eld.percentile(50) / 1e6,
        p99: eld.percentile(99) / 1e6,
        max: eld.max / 1e6,
      },
      mongo: { opcounters: status.opcounters, connections: status.connections?.current },
      slowQueries: slow,
    });
  });
  outer.post('/__perf/reset', async (req, res) => {
    eld.reset();
    peaks.cpu = 0;
    peaks.rss = 0;
    peaks.heap = 0;
    const db = mongoose.connection.db;
    await db.command({ profile: 0 });
    await db.collection('system.profile').drop().catch(() => {});
    await db.command({ profile: 1, slowms: 20 });
    res.json({ ok: true });
  });
  outer.use(app);

  const server = http.createServer(outer);
  const io = new Server(server, { cors: { origin: '*' } });
  registerSocketHandlers(io);
  attachSocketServer(io);
  server.keepAliveTimeout = 65000;
  server.listen(PORT, () => console.log(`[perfServer] ready on :${PORT} (in-memory mongo, ${SEED.products} products, ${SEED.orders} orders)`));

  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function seed(mongoose) {
  const { signToken } = require('../../utils/jwt');
  const User = require('../../Models/User');
  const Customer = require('../../Models/Customer');
  const Vendor = require('../../Models/Vendor');
  const Category = require('../../Models/Category');
  const Product = require('../../Models/Product');
  const Address = require('../../Models/Address');
  const Order = require('../../Models/Order');
  const ShippingSettings = require('../../Models/ShippingSettings');

  await ShippingSettings.updateOne(
    { key: 'GLOBAL' },
    { $set: { shippingEnabled: false, sellerOwnAccountEnabled: false, policyVersion: 2 } },
    { upsert: true }
  );

  const admin = await User.create({ name: 'Load Admin', email: 'load.admin@test.local', role: 'admin', isActive: true });

  const categories = await Category.insertMany(
    Array.from({ length: SEED.categories }, (_, i) => ({ name: `Category ${i}`, isActive: true }))
  );

  const vendors = [];
  for (let i = 0; i < SEED.vendors; i += 1) {
    vendors.push(
      await Vendor.create({
        vendorType: 'B2C',
        name: `Load Vendor ${i}`,
        email: `load.vendor${i}@test.local`,
        mobile: `8${String(100000000 + i)}`,
        password: 'secret123',
        verificationStatus: 'APPROVED',
        isActive: true,
      })
    );
  }

  const words = ['shirt', 'phone', 'shoe', 'bag', 'watch', 'lamp', 'mug', 'cable', 'chair', 'bottle', 'saree', 'rice'];
  const products = await Product.insertMany(
    Array.from({ length: SEED.products }, (_, i) => ({
      name: `${words[i % words.length]} model ${i}`,
      sku: `LOAD-${i}`,
      barcode: `LOADBC${String(i).padStart(8, '0')}`,
      category: categories[i % categories.length]._id,
      vendor: vendors[i % vendors.length]._id,
      price: 100 + (i % 50) * 37,
      mrp: 200 + (i % 50) * 40,
      stock: 100000,
      weight: 0.5,
      images: ['/uploads/products/placeholder.webp'],
      isActive: true,
      approvalStatus: 'APPROVED',
      gstRate: 0,
    }))
  );
  const hot = await Product.create({
    name: 'HOT limited drop',
    sku: 'LOAD-HOT',
    category: categories[0]._id,
    vendor: vendors[0]._id,
    price: 999,
    stock: 10,
    weight: 0.5,
    images: ['/uploads/products/placeholder.webp'],
    isActive: true,
    approvalStatus: 'APPROVED',
    gstRate: 0,
  });

  const customers = await Customer.insertMany(
    Array.from({ length: SEED.customers }, (_, i) => ({
      name: `Load Buyer ${i}`,
      mobileNumber: `7${String(100000000 + i)}`,
      isActive: true,
    }))
  );
  const addresses = await Address.insertMany(
    customers.map((c) => ({
      user: c._id,
      fullName: c.name,
      phone: c.mobileNumber,
      line1: '1 Load Street',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
    }))
  );

  // Order history, so seller/admin dashboards have real volume to aggregate.
  const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const orders = [];
  for (let i = 0; i < SEED.orders; i += 1) {
    const n = 1 + (i % 3);
    const items = Array.from({ length: n }, (_, k) => {
      const p = products[(i * 7 + k * 13) % products.length];
      return { product: p._id, name: p.name, price: p.price, quantity: 1, vendor: p.vendor, status: statuses[i % 5] };
    });
    const subtotal = items.reduce((s, it) => s + it.price, 0);
    orders.push({
      user: customers[i % customers.length]._id,
      items,
      shippingAddress: { fullName: 'x', phone: '9', line1: 'l', city: 'Indore', state: 'MP', pincode: '452001' },
      subtotal,
      total: subtotal,
      paymentMethod: 'COD',
      status: statuses[i % 5],
      createdAt: new Date(Date.now() - (i % 180) * 86400000),
    });
  }
  for (let i = 0; i < orders.length; i += 1000) await Order.insertMany(orders.slice(i, i + 1000));

  return {
    adminToken: signToken('admin', { id: String(admin._id), role: 'admin' }),
    vendorTokens: vendors.map((v) => signToken('vendor', { id: String(v._id), vendorType: 'B2C' })),
    buyers: customers.map((c, i) => ({
      token: signToken('user', { id: String(c._id), role: 'customer', mobileNumber: c.mobileNumber }, { expiresIn: '6h' }),
      addressId: String(addresses[i]._id),
      mobileNumber: c.mobileNumber,
    })),
    productIds: products.map((p) => String(p._id)),
    categoryIds: categories.map((c) => String(c._id)),
    hotProductId: String(hot._id),
    searchTerms: words,
  };
}

main().catch((err) => {
  console.error('[perfServer] failed to start', err);
  process.exit(1);
});
