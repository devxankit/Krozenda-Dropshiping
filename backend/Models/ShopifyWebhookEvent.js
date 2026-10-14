const mongoose = require('mongoose');

// Inbound webhook dedupe ledger.
//
// Shopify delivers at least once: a push whose reply it does not see in time
// is sent again, with the SAME X-Shopify-Webhook-Id. Without this the retry of
// an inventory push re-applies a stock figure, and the retry of an order push
// re-runs whatever that handler does.
//
// The unique index is the whole mechanism — insert first, and treat a
// duplicate-key error as "already handled". That makes the check and the claim
// one atomic operation, so two instances receiving the same retry at the same
// moment cannot both proceed.
//
// Rows expire after 7 days. Shopify gives up retrying long before that, so a
// row older than the retry window has no job left to do.

const shopifyWebhookEventSchema = new mongoose.Schema(
  {
    webhookId: { type: String, required: true, unique: true, index: true },
    topic: { type: String, default: '', index: true },
    shopDomain: { type: String, default: '' },
    apiVersion: { type: String, default: '' },
    triggeredAt: { type: Date, default: null },
    receivedAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },

    // Set when processing throws. The row still exists (so a retry is still
    // deduped), but this says a human should look.
    processingError: { type: String, default: '' },
  },
  { timestamps: false }
);

module.exports = mongoose.model('ShopifyWebhookEvent', shopifyWebhookEventSchema);
