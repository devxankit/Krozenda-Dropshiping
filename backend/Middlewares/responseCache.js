// Short-lived shared cache for expensive, caller-independent GET reports
// (the admin dashboard and analytics). Two things, both per URL:
//
//   * coalescing — identical requests that arrive while one is still being
//     computed wait for it instead of starting their own aggregation. Ten
//     admins opening the dashboard at once used to run ten copies of the same
//     line-level $lookup pipelines and all time out (load test: 1 req/s, 65%
//     timeouts);
//   * a TTL — a result is reused for ANALYTICS_CACHE_MS (default 30s), which
//     a reporting screen can afford and a stampede cannot.
//
// Only 200 responses are kept. Per process: under PM2 each instance keeps its
// own, which still collapses the stampede on each one.
//
// Off under ENV=test unless ANALYTICS_CACHE_MS is set, so suites that write
// an order and immediately read the dashboard see the new numbers.

const entries = new Map(); // key -> { expiresAt, status, body } | { pending: Promise }
const MAX_ENTRIES = 500;

function ttlMs() {
  const configured = process.env.ANALYTICS_CACHE_MS;
  if (configured !== undefined && configured !== '') return Math.max(0, Number(configured) || 0);
  return process.env.ENV === 'test' ? 0 : 30000;
}

function responseCache() {
  return async (req, res, next) => {
    const ttl = ttlMs();
    if (req.method !== 'GET' || ttl <= 0) return next();

    const key = req.originalUrl;
    const now = Date.now();
    const hit = entries.get(key);

    if (hit && hit.pending) {
      const result = await hit.pending;
      res.set('X-Cache', 'COALESCED');
      return res.status(result.status).json(result.body);
    }
    if (hit && hit.expiresAt > now) {
      res.set('X-Cache', 'HIT');
      return res.status(hit.status).json(hit.body);
    }

    let settle;
    const pending = new Promise((resolve) => {
      settle = resolve;
    });
    entries.set(key, { pending });

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      if (status === 200) {
        if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
        entries.set(key, { expiresAt: Date.now() + ttl, status, body });
      } else {
        entries.delete(key);
      }
      settle({ status, body });
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    // A handler that throws never calls res.json: release the waiters with
    // the same generic failure the error handler will send.
    res.on('close', () => {
      if (entries.get(key)?.pending === pending) {
        entries.delete(key);
        settle({ status: 500, body: { success: false, message: 'Something went wrong' } });
      }
    });

    return next();
  };
}

function clearResponseCache() {
  entries.clear();
}

module.exports = { responseCache, clearResponseCache };
