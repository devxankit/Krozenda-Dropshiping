// CJ API points budget (developers.cjdropshipping.cn/.../standard/points.html).
//
// Since mid-2026 CJ meters every business call in points: 50,000 a day for
// this account (plus a bonus tied to CJ order volume), refilled per minute
// (total / 1440, ~35 points a minute), reset at 00:00 UTC. Most product and
// stock reads cost 10, a catalogue list call 50. Once the balance hits zero
// CJ answers every call with "Insufficient API points" — HTTP 200 with
// result:false, not the 429 its docs describe.
//
// That failure is NOT a connection problem, and reconnecting does not fix
// it. What does help is not calling at all: every rejected call still counts
// against the per-minute refill, so a job that keeps hammering CJ while it is
// out of points keeps the balance pinned at zero for everyone, the admin's
// catalogue included. Hence the breaker below.
//
// Every successful CJ response carries { pointsInfo: { total, usedToday,
// remaining } }, which is recorded here so background jobs can leave a
// reserve for the admin and for order placement.
//
// In-process only, like cjRequestManager: one API server talks to CJ.

const PAUSE_MS = Number(process.env.CJ_POINTS_PAUSE_MS || 5 * 60 * 1000);

let state = {
  total: null,
  usedToday: null,
  remaining: null,
  updatedAt: null,
  pausedUntil: 0,
};

function record(pointsInfo) {
  if (!pointsInfo || typeof pointsInfo !== 'object') return;
  const remaining = Number(pointsInfo.remaining);
  if (!Number.isFinite(remaining)) return;
  state = {
    ...state,
    total: Number(pointsInfo.total) || state.total,
    usedToday: Number(pointsInfo.usedToday) || 0,
    remaining,
    updatedAt: new Date(),
  };
}

// CJ said the balance is empty: stop calling it for a while.
function markExhausted() {
  state = { ...state, remaining: 0, updatedAt: new Date(), pausedUntil: Date.now() + PAUSE_MS };
}

function isPaused() {
  return state.pausedUntil > Date.now();
}

function pausedForMs() {
  return Math.max(0, state.pausedUntil - Date.now());
}

// Background work (stock sync, pollers) only runs while the last known
// balance stays above `reserve`, so it can never eat the points the admin's
// catalogue and new CJ orders need. Unknown balance (no call made yet since
// start-up) is allowed: the first call is what finds out.
function canSpendInBackground(reserve = Number(process.env.CJ_BACKGROUND_POINTS_RESERVE || 5000)) {
  if (isPaused()) return false;
  return state.remaining === null || state.remaining > reserve;
}

function snapshot() {
  return {
    total: state.total,
    usedToday: state.usedToday,
    remaining: state.remaining,
    updatedAt: state.updatedAt,
    paused: isPaused(),
    resumesAt: isPaused() ? new Date(state.pausedUntil) : null,
  };
}

// Tests only.
function reset() {
  state = { total: null, usedToday: null, remaining: null, updatedAt: null, pausedUntil: 0 };
}

module.exports = { record, markExhausted, isPaused, pausedForMs, canSpendInBackground, snapshot, reset };
