const rateLimit = require('express-rate-limit');

// The automated test suite fires far more than 8 OTP requests per run by
// design (many independent test cases share one process) — real rate
// limiting is exercised separately by a dedicated, deliberately-throttled
// test rather than by every other suite tripping over a shared counter.
const isTestEnv = process.env.ENV === 'test';

// Applied to OTP send/verify — the endpoints most exposed to brute-force
// and enumeration since they are unauthenticated by design.
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

// Looser global guard against request floods / credential stuffing across
// the rest of the API.
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Refresh is cheap but must not become a free JWT-minting oracle for a
// stolen refresh token, and a client stuck in a retry loop shouldn't be able
// to hammer it. Generous enough that a normal 1h-access-token session (a
// handful of refreshes a day) never notices.
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many refresh attempts. Please sign in again.' },
});

// Order creation and payment verification. Tight because each call can move
// money and reserve stock; a real buyer places one order per checkout, so 20
// per 15 minutes leaves plenty of room for retries after a failed payment.
const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many order attempts. Please wait a moment and try again.' },
});

// Coupon validation is the one buyer endpoint that invites brute forcing —
// without a limit, the whole coupon namespace can be enumerated for a
// working code.
const couponRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many coupon attempts. Please try again in a few minutes.' },
});

// Review/return submissions carry image uploads, so the cost per request is
// far higher than a plain write.
const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many submissions. Please try again shortly.' },
});

// Catalog search/browse. Loose enough for real shopping (a filter-heavy
// session easily makes a few hundred calls) but it stops a scraper from
// pulling the whole catalog at full speed.
const catalogRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// The product page's delivery check. Tighter than the catalog limiter because
// a cache miss costs a real call against the carrier's own rate limit, and
// looser than the OTP limiter because a shopper legitimately checks a few PIN
// codes while deciding.
const deliveryCheckRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { success: false, message: 'Too many delivery checks. Please wait a moment.' },
});

module.exports = {
  deliveryCheckRateLimiter,
  otpRateLimiter,
  globalRateLimiter,
  refreshRateLimiter,
  orderRateLimiter,
  couponRateLimiter,
  writeRateLimiter,
  catalogRateLimiter,
};
