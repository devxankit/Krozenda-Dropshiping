const rateLimit = require('express-rate-limit');
// IPv6-safe IP normaliser; express-rate-limit v8 rejects a custom keyGenerator
// that uses a raw req.ip without it.
const { ipKeyGenerator } = require('express-rate-limit');

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

// Every AI chat turn is a paid Gemini call, so this one is keyed per ACCOUNT
// rather than per IP: sharing an office NAT must not throttle everyone, and
// a single account must not be able to burn budget from a pool of addresses.
// Mounted after protectUser (see Router/aiRoutes.js), so req.user is always
// set — the ipKeyGenerator fallback is defensive only.
const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  keyGenerator: (req) => (req.user ? `ai:${req.user._id}` : `ai:ip:${ipKeyGenerator(req.ip)}`),
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please wait a moment and try again.',
  },
});

module.exports = { otpRateLimiter, globalRateLimiter, aiChatRateLimiter };
