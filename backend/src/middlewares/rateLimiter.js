import rateLimit from 'express-rate-limit'

// General API limiter — generous defaults for a scaffold. Tighter,
// endpoint-specific limiters (OTP request, login attempts) belong with
// those features per §8 NFR ("rate limiting, anti-spam, anti-fraud checks")
// once they're built; this is the baseline every route gets.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
})
