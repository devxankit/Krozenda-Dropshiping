const express = require('express');
const { handleShiprocketWebhook } = require('../Controllers/shipmentWebhookController');
const { handleRazorpayWebhook } = require('../Controllers/paymentWebhookController');
const { handleRouteWebhook } = require('../Controllers/routeWebhookController');
const { handleRazorpayxWebhook } = require('../Controllers/razorpayxWebhookController');
const { handleShopifyWebhook } = require('../Controllers/shopifyWebhookController');

const router = express.Router();

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
router.post('/', handleShiprocketWebhook);

// A second provider, its own sub-path (see comment above) — Razorpay's
// payload has nothing in common with Shiprocket's and genuinely signs its
// requests, so it gets its own handler rather than being guessed at here.
router.post('/payments', handleRazorpayWebhook);

// Razorpay Route's own event family (transfer.processed/failed,
// settlement.processed) — a distinct sub-path from '/payments' even though
// both are Razorpay, because they confirm different things (a captured
// payment vs. a seller payout transfer) and this file's own rule above is
// that a shared endpoint would have to guess the event family from the
// payload alone.
router.post('/route-transfers', handleRouteWebhook);

// RazorpayX seller payouts — a separate webhook config in the RazorpayX
// dashboard, see razorpayxWebhookController.
router.post('/razorpayx-payouts', handleRazorpayxWebhook);

// Shopify's own sub-path. It signs every push (base64 HMAC-SHA256 over the
// raw body with the app's client secret), so the same rule as the others
// applies: its own endpoint, and the signature — not the payload — is what
// proves who sent it.
//
// One path for every topic: Shopify names the topic in the X-Shopify-Topic
// header, which is inside the signed request, so it is as trustworthy as the
// body and does not need its own URL.
router.post('/shopify', handleShopifyWebhook);

module.exports = router;
