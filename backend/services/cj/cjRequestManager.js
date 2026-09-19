// Central queue + throttle in front of cjClient, shared by every CJ service
// (product, order, logistics, inventory, tracking, dispute). This is the
// hardening requirement from the master plan: rate limiting must live in ONE
// shared layer, not be re-implemented per service, or five services calling
// CJ at once will collectively blow through its rate limit even though each
// one individually "retries responsibly".
//
// CJ's documented limit is per-endpoint-group; we don't try to model that
// precisely here. Instead we run a single global concurrency+spacing gate,
// which is simple, safe, and enough to stop a burst of admin actions (e.g.
// a bulk sync job) from hammering CJ. Endpoint-specific limits can be added
// as extra keys later without changing callers.

const DEFAULT_MIN_INTERVAL_MS = Number(process.env.CJ_MIN_REQUEST_INTERVAL_MS || 350);
const DEFAULT_MAX_CONCURRENCY = Number(process.env.CJ_MAX_CONCURRENCY || 2);

let queue = [];
let active = 0;
let lastDispatchAt = 0;

function scheduleDrain() {
  if (queue.length === 0 || active >= DEFAULT_MAX_CONCURRENCY) return;

  const now = Date.now();
  const wait = Math.max(0, lastDispatchAt + DEFAULT_MIN_INTERVAL_MS - now);

  setTimeout(() => {
    if (queue.length === 0 || active >= DEFAULT_MAX_CONCURRENCY) return;

    const job = queue.shift();
    active += 1;
    lastDispatchAt = Date.now();

    job()
      .finally(() => {
        active -= 1;
        scheduleDrain();
      });

    // Room for another concurrent slot right away.
    scheduleDrain();
  }, wait);
}

// Runs `task` (an async function performing one CJ request) through the
// shared queue. Every CJ service call should be wrapped in this rather than
// calling cjClient.call directly.
function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push(() =>
      task()
        .then(resolve)
        .catch(reject)
    );
    scheduleDrain();
  });
}

// For tests / diagnostics — never used to gate business logic.
function stats() {
  return { queued: queue.length, active };
}

module.exports = { enqueue, stats };
