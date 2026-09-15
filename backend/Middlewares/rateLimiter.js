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

module.exports = { otpRateLimiter, globalRateLimiter };
