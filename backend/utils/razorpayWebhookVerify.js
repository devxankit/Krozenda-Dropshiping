const crypto = require('crypto');
const { safeEqual } = require('./secretBox');

// Shared HMAC-SHA256 signature verification for every Razorpay webhook this
// backend receives (payments today, Route transfers/settlements as of the
// seller-settlement-automation sub-tasks). Extracted out of
// paymentWebhookController.js so a second Razorpay webhook route does not
// copy-paste the comparison — behavior is unchanged from the original inline
// version: same rawBody+signature+secret inputs, same HMAC-SHA256-over-
// raw-body computation, same constant-time compare via secretBox.safeEqual.
function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(signature, expected);
}

module.exports = { verifyRazorpaySignature };
