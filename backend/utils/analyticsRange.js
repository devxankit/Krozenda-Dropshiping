// Every analytics window on the admin panel is resolved here, so the
// dashboard and the analytics screens can never disagree about what
// "last 30 days" means or where a bucket starts.
//
// Dates are bucketed in IST. India has no DST, so a fixed +05:30 offset is
// exact — and the same offset string is handed to $dateToString so Mongo
// groups by the same calendar day this module labels.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_TZ = '+05:30';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'YYYY-MM-DD' for the IST calendar day a UTC instant falls on.
function dayKey(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// The UTC instant of 00:00 IST on that calendar day.
function startOfDay(key) {
  return new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_OFFSET_MS);
}

function addDays(key, amount) {
  return dayKey(new Date(startOfDay(key).getTime() + amount * 24 * 60 * 60 * 1000 + IST_OFFSET_MS));
}

function listDays(fromKey, toKey) {
  const days = [];
  for (let key = fromKey; key <= toKey; key = addDays(key, 1)) days.push(key);
  return days;
}

function formatDay(key) {
  const [, month, day] = key.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

// Indian financial year: 1 April - 31 March.
function financialYearStartKey(todayKey) {
  const [year, month] = todayKey.split('-').map(Number);
  return `${month >= 4 ? year : year - 1}-04-01`;
}

const RANGES = Object.freeze({
  '7d': { label: 'Last 7 days', shortLabel: '7 days', days: 7, granularity: 'day' },
  '30d': { label: 'Last 30 days', shortLabel: '30 days', days: 30, granularity: 'day' },
  '90d': { label: 'Last 90 days', shortLabel: '90 days', days: 90, granularity: 'week' },
  fy: { label: 'This financial year', shortLabel: 'financial year', granularity: 'month' },
});

/**
 * Resolve a range id from the client into the window to aggregate over, plus
 * the equally long window immediately before it — every delta on these
 * screens is "this window vs the one before it", never a hardcoded figure.
 */
function resolveRange(rangeId, now = new Date()) {
  const id = RANGES[rangeId] ? rangeId : '30d';
  const config = RANGES[id];
  const todayKey = dayKey(now);

  const startKey = id === 'fy' ? financialYearStartKey(todayKey) : addDays(todayKey, -(config.days - 1));
  const days = listDays(startKey, todayKey);

  // The previous window is the same number of days, ending the day before
  // this one starts.
  const previousEndKey = addDays(startKey, -1);
  const previousStartKey = addDays(previousEndKey, -(days.length - 1));

  return {
    id,
    label: config.label,
    shortLabel: config.shortLabel,
    granularity: config.granularity,
    timezone: IST_TZ,
    days,
    startKey,
    endKey: todayKey,
    start: startOfDay(startKey),
    // Exclusive upper bound — tomorrow 00:00 IST, so everything placed today counts.
    end: startOfDay(addDays(todayKey, 1)),
    previous: {
      startKey: previousStartKey,
      endKey: previousEndKey,
      start: startOfDay(previousStartKey),
      end: startOfDay(startKey),
    },
  };
}

/**
 * Group the range's days into the buckets a chart plots: one per day, per
 * week, or per calendar month. Weeks are chunked backwards from today, so
 * the right-hand bucket is always the current week rather than a stub.
 *
 * Returns the bucket list (in plot order) and a day -> bucket index map.
 */
function buildBuckets(range) {
  const { days, granularity } = range;
  const buckets = [];
  const indexByDay = new Map();

  if (granularity === 'day') {
    days.forEach((key, index) => {
      buckets.push({ key, label: formatDay(key) });
      indexByDay.set(key, index);
    });
    return { buckets, indexByDay };
  }

  if (granularity === 'week') {
    const chunks = [];
    for (let end = days.length; end > 0; end -= 7) {
      chunks.unshift(days.slice(Math.max(0, end - 7), end));
    }
    chunks.forEach((chunk, index) => {
      buckets.push({ key: chunk[0], label: formatDay(chunk[0]) });
      chunk.forEach((key) => indexByDay.set(key, index));
    });
    return { buckets, indexByDay };
  }

  days.forEach((key) => {
    const monthKey = key.slice(0, 7);
    let index = buckets.findIndex((bucket) => bucket.key === monthKey);
    if (index === -1) {
      index = buckets.length;
      buckets.push({ key: monthKey, label: MONTHS[Number(monthKey.slice(5, 7)) - 1] });
    }
    indexByDay.set(key, index);
  });

  return { buckets, indexByDay };
}

module.exports = {
  IST_TZ,
  RANGES,
  addDays,
  buildBuckets,
  dayKey,
  formatDay,
  listDays,
  resolveRange,
  startOfDay,
};
