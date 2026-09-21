const express = require('express');
const rateLimit = require('express-rate-limit');
const { handleShiprocketWebhook } = require('../Controllers/shipmentWebhookController');
const { handleRazorpayWebhook } = require('../Controllers/paymentWebhookController');
const { handleCjWebhook } = require('../Controllers/cjWebhookController');
const { handleRouteWebhook } = require('../Controllers/routeWebhookController');

const router = express.Router();

// Carriers burst: a batch of scans can arrive as many calls in a few seconds,
// so this is far looser than the buyer-facing limiters. It exists to bound
// abuse of a public endpoint, not to shape normal carrier traffic.
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.ENV === 'test',
  message: { success: false, message: 'Too many webhook requests' },
});

// Authentication is inside the handler (a constant-time x-api-key compare),
// NOT middleware — deliberately, so an unauthorised call is logged with the
// same structured event as every other webhook outcome.
//
// WHY THE PATH IS GENERIC. This is mounted at '/' rather than '/shiprocket'
// because Shiprocket's own webhook setup screen refuses URLs containing
// "shiprocket", "kartrocket", "sr" or "kr". The carrier is identified by which
// secret the caller presents, not by the path.
//
// A SECOND provider must NOT share this route — give it its own sub-path
// (e.g. '/payments'), because a shared endpoint would have to guess the sender
// from the payload, and a payload is not proof of who sent it.
router.post('/', webhookRateLimiter, handleShiprocketWebhook);

// A second provider, its own sub-path (see comment above) — Razorpay's
// payload has nothing in common with Shiprocket's and genuinely signs its
// requests, so it gets its own handler rather than being guessed at here.
router.post('/payments', webhookRateLimiter, handleRazorpayWebhook);

// Razorpay Route's own event family (transfer.processed/failed,
// settlement.processed) — a distinct sub-path from '/payments' even though
// both are Razorpay, because they confirm different things (a captured
// payment vs. a seller payout transfer) and this file's own rule above is
// that a shared endpoint would have to guess the event family from the
// payload alone.
router.post('/route-transfers', webhookRateLimiter, handleRouteWebhook);

// CJ Dropshipping's own sub-path — genuinely signs its payloads (HMAC-SHA256
// over the raw body), so no path-name restriction like Shiprocket's applies.
router.post('/cj', webhookRateLimiter, handleCjWebhook);

module.exports = router;
