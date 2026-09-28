// Closed-model load generator for the isolated perfServer. No dependencies:
// keep-alive http + per-request timing, percentiles computed from raw samples.
//
//   node tests/performance/loadRunner.js [profile]      profile: full | quick | hot
//
// Writes tests/performance/results-<profile>.json and prints a table per stage.
// Points at PERF_URL (default http://localhost:5055). It refuses any host but
// localhost — this runner is never to be aimed at a shared or production API.

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const BASE = new URL(process.env.PERF_URL || 'http://localhost:5055');
if (!['localhost', '127.0.0.1'].includes(BASE.hostname)) {
  console.error('loadRunner only targets localhost. Use tests/performance/k6-staging.js for a staging environment.');
  process.exit(1);
}
const TIMEOUT_MS = 10000;
const agent = new http.Agent({ keepAlive: true, maxSockets: 2000 });
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function call(method, urlPath, { token, body, label } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const started = process.hrtime.bigint();
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: BASE.hostname,
        port: BASE.port,
        path: urlPath,
        method,
        agent,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let bytes = 0;
        const chunks = [];
        res.on('data', (c) => {
          bytes += c.length;
          chunks.push(c);
        });
        res.on('end', () => {
          const ms = Number(process.hrtime.bigint() - started) / 1e6;
          resolve({ label: label || `${method} ${urlPath.split('?')[0]}`, status: res.statusCode, ms, bytes, body: Buffer.concat(chunks) });
        });
      }
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', (err) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ label: label || `${method} ${urlPath}`, status: err.message === 'TIMEOUT' ? 'TIMEOUT' : 'ERR', ms, bytes: 0 });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

// ---- scenarios: each returns a list of results ----------------------------
const S = {
  async browse() {
    const out = [];
    out.push(await call('GET', '/catalog/categories', { label: 'browse: categories' }));
    out.push(await call('GET', '/catalog/banners', { label: 'browse: banners' }));
    out.push(await call('GET', `/catalog/products?page=${1 + Math.floor(Math.random() * 20)}&limit=20`, { label: 'browse: listing' }));
    out.push(await call('GET', `/catalog/products?search=${pick(fx.searchTerms)}`, { label: 'browse: search' }));
    out.push(await call('GET', `/catalog/products?category=${pick(fx.categoryIds)}&sort=price_asc`, { label: 'browse: category+price sort' }));
    const id = pick(fx.productIds);
    out.push(await call('GET', `/catalog/products/${id}`, { label: 'browse: product detail' }));
    out.push(await call('GET', `/catalog/products/${id}/related`, { label: 'browse: related' }));
    return out;
  },
  async login() {
    const b = pick(fx.buyers);
    const a = await call('POST', '/auth/send-otp', { body: { mobileNumber: b.mobileNumber }, label: 'login: send-otp' });
    const v = await call('POST', '/auth/verify-otp', { body: { mobileNumber: b.mobileNumber, otp: '123456' }, label: 'login: verify-otp' });
    return [a, v];
  },
  async cart(vu) {
    const b = fx.buyers[vu % fx.buyers.length];
    const id = pick(fx.productIds);
    return [
      await call('POST', '/user/cart/items', { token: b.token, body: { productId: id, quantity: 1 }, label: 'cart: add' }),
      await call('PUT', `/user/cart/items/${id}`, { token: b.token, body: { quantity: 2 }, label: 'cart: set qty' }),
      await call('GET', '/user/cart', { token: b.token, label: 'cart: get' }),
    ];
  },
  async checkout(vu) {
    const b = fx.buyers[vu % fx.buyers.length];
    const out = [];
    out.push(await call('POST', '/user/cart/items', { token: b.token, body: { productId: pick(fx.productIds), quantity: 1 }, label: 'checkout: add' }));
    out.push(await call('POST', '/user/orders/shipping-quote', { token: b.token, body: { addressId: b.addressId, paymentMethod: 'COD' }, label: 'checkout: quote' }));
    out.push(
      await call('POST', '/user/orders', {
        token: b.token,
        body: { addressId: b.addressId, paymentMethod: 'COD', idempotencyKey: crypto.randomUUID() },
        label: 'checkout: place COD order',
      })
    );
    return out;
  },
  async vendor(vu) {
    const t = fx.vendorTokens[vu % fx.vendorTokens.length];
    return [
      await call('GET', '/vendor/orders?page=1&rowsPerPage=25', { token: t, label: 'seller: orders' }),
      await call('GET', '/vendor/products', { token: t, label: 'seller: products' }),
      await call('GET', '/vendor/summary', { token: t, label: 'seller: dashboard summary' }),
      await call('GET', '/vendor/earnings/summary', { token: t, label: 'seller: earnings' }),
    ];
  },
  async admin() {
    const t = fx.adminToken;
    return [
      await call('GET', '/admin/dashboard', { token: t, label: 'admin: dashboard' }),
      await call('GET', '/admin/analytics/sales', { token: t, label: 'admin: sales analytics' }),
      await call('GET', '/admin/orders?page=1&rowsPerPage=25', { token: t, label: 'admin: orders' }),
      await call('GET', '/admin/catalog/products?page=1&rowsPerPage=25', { token: t, label: 'admin: products' }),
    ];
  },
};

const MIX = [
  ['browse', 55],
  ['cart', 15],
  ['login', 10],
  ['checkout', 8],
  ['vendor', 7],
  ['admin', 5],
];
function pickScenario() {
  let r = Math.random() * 100;
  for (const [name, w] of MIX) {
    if ((r -= w) <= 0) return name;
  }
  return 'browse';
}

// ---- stats -----------------------------------------------------------------
function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
function summarise(samples, seconds) {
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => typeof s.status !== 'number' || s.status >= 500).length;
  const clientErrors = samples.filter((s) => typeof s.status === 'number' && s.status >= 400 && s.status < 500).length;
  const timeouts = samples.filter((s) => s.status === 'TIMEOUT').length;
  const round = (n) => Math.round(n * 10) / 10;
  return {
    requests: samples.length,
    rps: round(samples.length / seconds),
    avgMs: round(ms.reduce((a, b) => a + b, 0) / (ms.length || 1)),
    p50: round(pct(ms, 50)),
    p90: round(pct(ms, 90)),
    p95: round(pct(ms, 95)),
    p99: round(pct(ms, 99)),
    maxMs: round(ms[ms.length - 1] || 0),
    errorRatePct: round((errors / (samples.length || 1)) * 100),
    http4xx: clientErrors,
    timeouts,
    avgKb: round(samples.reduce((a, s) => a + s.bytes, 0) / (samples.length || 1) / 1024),
  };
}
function byEndpoint(samples) {
  const groups = new Map();
  for (const s of samples) {
    if (!groups.has(s.label)) groups.set(s.label, []);
    groups.get(s.label).push(s);
  }
  return [...groups.entries()]
    .map(([label, list]) => {
      const ms = list.map((s) => s.ms).sort((a, b) => a - b);
      const statuses = {};
      for (const s of list) statuses[s.status] = (statuses[s.status] || 0) + 1;
      return { label, n: list.length, p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)), p99: Math.round(pct(ms, 99)), avgKb: Math.round(list.reduce((a, s) => a + s.bytes, 0) / list.length / 102.4) / 10, statuses };
    })
    .sort((a, b) => b.p95 - a.p95);
}

// ---- stage runner ----------------------------------------------------------
async function runStage({ name, vus, seconds, scenario, thinkMs = 0 }) {
  await call('POST', '/__perf/reset');
  const samples = [];
  const deadline = Date.now() + seconds * 1000;
  const worker = async (vu) => {
    while (Date.now() < deadline) {
      const results = await S[scenario || pickScenario()](vu);
      for (const r of results) samples.push({ label: r.label, status: r.status, ms: r.ms, bytes: r.bytes });
      if (thinkMs) await sleep(thinkMs);
    }
  };
  const started = Date.now();
  await Promise.all(Array.from({ length: vus }, (_, i) => worker(i)));
  const elapsed = (Date.now() - started) / 1000;
  const statsRes = await call('GET', '/__perf/stats');
  const server = JSON.parse(statsRes.body.toString());
  const summary = { name, vus, seconds: Math.round(elapsed), ...summarise(samples, elapsed) };
  console.log(
    `${name.padEnd(22)} VUs=${String(vus).padStart(3)} req=${String(summary.requests).padStart(6)} rps=${String(summary.rps).padStart(6)} ` +
      `avg=${summary.avgMs} p50=${summary.p50} p90=${summary.p90} p95=${summary.p95} p99=${summary.p99} max=${summary.maxMs} ` +
      `5xx/err=${summary.errorRatePct}% timeouts=${summary.timeouts} | cpu=${server.peakCpuPercent}% rss=${server.peakRssMb}MB eld99=${server.eventLoopDelayMs.p99.toFixed(1)}ms`
  );
  return { summary, endpoints: byEndpoint(samples), server };
}

async function hotProductRace(buyers = 100) {
  const hot = fx.hotProductId;
  const pool = fx.buyers.slice(0, buyers);
  for (const b of pool) await call('POST', '/user/cart/items', { token: b.token, body: { productId: hot, quantity: 1 } });
  await call('POST', '/__perf/reset');
  const results = await Promise.all(
    pool.map((b) =>
      call('POST', '/user/orders', { token: b.token, body: { addressId: b.addressId, paymentMethod: 'COD', idempotencyKey: crypto.randomUUID() }, label: 'hot: place order' })
    )
  );
  const statuses = {};
  for (const r of results) statuses[r.status] = (statuses[r.status] || 0) + 1;
  const product = await call('GET', `/catalog/products/${hot}`);
  const stockLeft = JSON.parse(product.body.toString()).data?.stock;
  const out = { buyers, statuses, stockLeft, ...summarise(results, 1) };
  console.log(`hot-product race       buyers=${buyers} statuses=${JSON.stringify(statuses)} stockLeft=${stockLeft} p95=${out.p95}ms`);
  return out;
}

const PROFILES = {
  quick: [
    { name: 'baseline (1 VU)', vus: 1, seconds: 10 },
    { name: 'smoke (10 VUs)', vus: 10, seconds: 15 },
  ],
  full: [
    { name: 'baseline (1 VU)', vus: 1, seconds: 20 },
    { name: 'smoke (10 VUs)', vus: 10, seconds: 30 },
    { name: 'normal (50 VUs)', vus: 50, seconds: 60 },
    { name: 'heavy (100 VUs)', vus: 100, seconds: 60 },
    { name: 'stress (150 VUs)', vus: 150, seconds: 30 },
    { name: 'stress (200 VUs)', vus: 200, seconds: 30 },
    { name: 'stress (300 VUs)', vus: 300, seconds: 30 },
    { name: 'spike 10 (pre)', vus: 10, seconds: 15 },
    { name: 'spike 300 (burst)', vus: 300, seconds: 20 },
    { name: 'spike 10 (recovery)', vus: 10, seconds: 20 },
    { name: 'soak (50 VUs, 5 min)', vus: 50, seconds: 300, thinkMs: 200 },
  ],
  scenarios: [
    { name: 'S1 browsing (50)', vus: 50, seconds: 30, scenario: 'browse' },
    { name: 'S2 login (50)', vus: 50, seconds: 30, scenario: 'login' },
    { name: 'S3 cart (50)', vus: 50, seconds: 30, scenario: 'cart' },
    { name: 'S4 checkout (50)', vus: 50, seconds: 30, scenario: 'checkout' },
    { name: 'S6 admin dash (10)', vus: 10, seconds: 30, scenario: 'admin' },
    { name: 'S7 seller dash (20)', vus: 20, seconds: 30, scenario: 'vendor' },
  ],
};

(async () => {
  const profile = process.argv[2] || 'quick';
  const out = { profile, startedAt: new Date().toISOString(), stages: [] };
  if (profile === 'hot') {
    out.hot = await hotProductRace(100);
  } else {
    for (const stage of PROFILES[profile]) out.stages.push(await runStage(stage));
  }
  const file = path.join(__dirname, `results-${profile}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`\nwritten ${file}`);
  process.exit(0);
})();
