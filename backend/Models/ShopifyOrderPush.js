const mongoose = require('mongoose');

// One row per Krozenda order PER SUPPLIER.
//
// WHY PER SUPPLIER. Several dropshipping apps feed one Shopify store, and each
// watches the store's orders for lines it recognises. A single Shopify order
// carrying lines from two of them is ambiguous: both may fulfil the whole
// order, which ships and bills two parcels for one sale, and nobody notices
// until the money is gone. Giving each supplier its own Shopify order
// containing only its own lines removes the ambiguity entirely.
//
// The BUYER still has one Krozenda order. This split exists only on the far
// side of the integration.
//
// WHY A TABLE RATHER THAN JUST CALLING SHOPIFY AT CHECKOUT:
//
//  1. The buyer gets a cancel window. Inside it the order has not been sent,
//     so cancelling is genuinely free — nothing to unwind at the supplier, no
//     refund race. That is only possible if the send is deferred.
//  2. A provider call inside the checkout request makes the buyer wait on it,
//     and makes a timeout indistinguishable from a refusal.
//  3. A failed push has to be retryable. An inline call that throws leaves a
//     paid order with nothing recording that the supplier never heard of it.
//
// The row is created INSIDE the checkout transaction, so there can never be a
// committed paid order with no scheduled push — that gap is money taken for
// goods nobody ordered.

const shopifyOrderPushSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },

    // Which dropshipping app this push is for. UNKNOWN is kept as a real
    // value rather than folded into another supplier's push: attributing one
    // app's order to another is worse than admitting we cannot tell.
    supplier: { type: String, default: 'UNKNOWN', uppercase: true, trim: true, index: true },
    supplierLabel: { type: String, default: '' },

    // The order lines this push covers, so the Shopify order carries ONLY
    // this supplier's items.
    productIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // What this supplier's share of the order is worth, for the admin view
    // and for reconciling what each provider was sent.
    subtotal: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    providerCost: { type: Number, default: 0 },
    // How many lines had no cost from the provider. Some apps (vFulfill) set
    // a unit cost in Shopify and some (Dropship India) do not, so a cost of
    // zero means two completely different things. Without this the margin
    // report shows 100% for a supplier whose cost is simply unknown — a
    // fabricated number that looks authoritative.
    linesWithoutCost: { type: Number, default: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    checkoutGroupId: { type: String, default: '' },

    // NEEDS_RECONCILE is not a failure, it is an UNKNOWN: the request was
    // sent and no answer came back, so Shopify may or may not hold an order.
    // Retrying an unknown risks a second supplier order for one sale; giving
    // up risks never ordering at all. So it is parked until the tag lookup can
    // answer, which needs a short delay — Shopify's order SEARCH INDEX LAGS
    // behind its writes by a few seconds, and an immediate lookup reports "no
    // such order" for an order that exists. Verified against the live store.
    status: {
      type: String,
      enum: ['SCHEDULED', 'PUSHING', 'PUSHED', 'NEEDS_RECONCILE', 'FAILED', 'ABANDONED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true,
    },

    // When the cron may claim it: placedAt + the grace window.
    dueAt: { type: Date, required: true, index: true },
    // Snapshotted, not read from settings at push time — an admin shortening
    // the window must not retroactively close a window a buyer was promised.
    graceWindowMinutes: { type: Number, default: 0, min: 0 },

    attempts: { type: Number, default: 0 },
    // Set when an attempt ended with an unknown outcome. Explicit rather than
    // inferred from the attempt count, because CLAIMING a row overwrites its
    // status to PUSHING — so by the time the push runs, the fact that it is a
    // reconcile has already been erased. Inferring it worked only by accident
    // of the counter, which is exactly the coupling that breaks silently.
    awaitingReconcile: { type: Boolean, default: false },
    nextAttemptAt: { type: Date, default: null },
    // Set when a worker claims the row. A claim older than the stale timeout
    // is reclaimable, so a process that died mid-push does not strand an order.
    claimedAt: { type: Date, default: null },

    lastError: { type: String, default: '' },
    lastErrorCode: { type: String, default: '' },

    shopifyOrderId: { type: String, default: null, index: true },
    shopifyOrderName: { type: String, default: '' },
    pushedAt: { type: Date, default: null },
    // True when the order was created as a Shopify TEST order — it reconciles
    // differently and must never be mistaken for a real one.
    test: { type: Boolean, default: false },

    cancelledBy: { type: String, enum: ['buyer', 'admin', 'system', null], default: null },
    cancelledReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// The claim query: due, not yet attempted again, oldest first.
shopifyOrderPushSchema.index({ status: 1, dueAt: 1, nextAttemptAt: 1 });

// One push per supplier per order. This is what makes a retried transaction
// or two racing requests produce ONE order per supplier rather than two.
shopifyOrderPushSchema.index({ order: 1, supplier: 1 }, { unique: true });

const STALE_CLAIM_MS = 10 * 60 * 1000;

shopifyOrderPushSchema.statics.STALE_CLAIM_MS = STALE_CLAIM_MS;

/**
 * Atomically take the next row that is ready to push.
 *
 * The find and the claim are ONE operation on purpose: two workers (or two
 * instances) running this concurrently cannot both get the same row, so an
 * order cannot be raised with the supplier twice.
 */
shopifyOrderPushSchema.statics.claimNext = function claimNext(now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  return this.findOneAndUpdate(
    {
      $or: [
        {
          status: 'SCHEDULED',
          dueAt: { $lte: now },
          $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
        },
        // An ambiguous outcome, once enough time has passed for Shopify's
        // search index to catch up and answer whether the order exists.
        { status: 'NEEDS_RECONCILE', nextAttemptAt: { $lte: now } },
        // A worker that died holding a claim.
        { status: 'PUSHING', claimedAt: { $lte: staleBefore } },
      ],
    },
    { $set: { status: 'PUSHING', claimedAt: now }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { dueAt: 1 } }
  );
};

module.exports = mongoose.model('ShopifyOrderPush', shopifyOrderPushSchema);
