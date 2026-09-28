const LoginThrottle = require('../Models/LoginThrottle');

// Password sign-in limit for the admin and seller panels: MAX_ATTEMPTS per
// account per WINDOW, then the account is locked for LOCK_MS. A successful
// sign-in clears it.
//
// Per ACCOUNT, not per IP: the API sits behind a proxy without `trust
// proxy`, so every caller shares one req.ip and an IP limit would lock out
// everybody at once.
//
// The attempt is taken BEFORE the password is checked, atomically — the same
// reason as the OTP counter: a check-then-count lets a parallel burst all see
// "under the limit".
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function keyFor(audience, email) {
  return `${audience}:${String(email).toLowerCase().trim()}`;
}

/** Returns { allowed: true } or { allowed: false, retryAfterSeconds }. */
async function reserveAttempt(audience, email) {
  const key = keyFor(audience, email);
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);
  const freshWindow = {
    $or: [{ $eq: [{ $type: '$windowStartedAt' }, 'missing'] }, { $lt: ['$windowStartedAt', windowCutoff] }],
  };
  const locked = { $gt: [{ $ifNull: ['$lockedUntil', new Date(0)] }, now] };

  const row = await LoginThrottle.findOneAndUpdate(
    { key },
    [
      {
        $set: {
          key,
          // While locked nothing moves; otherwise a stale window restarts.
          attempts: {
            $cond: [locked, '$attempts', { $cond: [freshWindow, 1, { $add: [{ $ifNull: ['$attempts', 0] }, 1] }] }],
          },
          windowStartedAt: { $cond: [locked, '$windowStartedAt', { $cond: [freshWindow, now, '$windowStartedAt'] }] },
        },
      },
      {
        $set: {
          lockedUntil: {
            $cond: [
              locked,
              '$lockedUntil',
              { $cond: [{ $gt: ['$attempts', MAX_ATTEMPTS] }, new Date(now.getTime() + LOCK_MS), null] },
            ],
          },
        },
      },
      { $set: { expiresAt: { $max: [{ $add: ['$windowStartedAt', WINDOW_MS] }, { $ifNull: ['$lockedUntil', now] }] } } },
    ],
    { upsert: true, new: true }
  );

  if (row.lockedUntil && row.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 1000) };
  }
  return { allowed: true };
}

async function clearAttempts(audience, email) {
  await LoginThrottle.deleteOne({ key: keyFor(audience, email) });
}

function tooManyAttempts(res, retryAfterSeconds) {
  res.set('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({
    success: false,
    code: 'TOO_MANY_ATTEMPTS',
    message: `Too many sign-in attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
    data: { retryAfterSeconds },
  });
}

module.exports = { reserveAttempt, clearAttempts, tooManyAttempts, MAX_ATTEMPTS };
