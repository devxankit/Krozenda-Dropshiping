const mongoose = require('mongoose');

// One scan in a shipment's journey. Append-only.
//
// Kept as its own collection rather than an array on Shipment because a long
// journey can run to dozens of scans, and embedding them would grow the
// shipment document on every webhook — making every shipment read heavier for
// the sake of a timeline that only the detail screen shows.
//
// DEDUPLICATION is the whole point of this model. The same scan reaches us
// from three directions — the webhook, the fallback poller, and a manual
// refresh — and the carrier may resend a webhook at any time. `dedupeKey` is a
// unique index, so a repeat insert fails loudly instead of quietly producing a
// timeline with the same event three times (task §12, §13).

const trackingEventSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    // Denormalised so a webhook can be recorded from the AWB alone, and so the
    // admin tracking screens can filter without a join.
    awbCode: { type: String, default: '', trim: true },

    // The carrier's wording, verbatim.
    carrierStatus: { type: String, default: '', trim: true },
    // The internal status this scan mapped to, or null when the carrier sent
    // something not in the status map. Null is meaningful: it marks a scan
    // that was recorded for the timeline but deliberately did not drive the
    // shipment's state.
    mappedStatus: { type: String, default: null },

    location: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },

    // When the scan HAPPENED, per the carrier.
    occurredAt: { type: Date, required: true },
    // When WE learned about it. These differ, sometimes by hours, and the gap
    // is what makes out-of-order webhook handling necessary.
    receivedAt: { type: Date, default: Date.now },

    // 'WEBHOOK' | 'POLL' | 'MANUAL'
    source: { type: String, default: 'WEBHOOK' },

    // Stable identity for this scan. Built from the carrier's own event id when
    // it supplies one, else a hash of (shipment, status, occurredAt) — see
    // buildDedupeKey.
    dedupeKey: { type: String, required: true },

    // The raw carrier payload for this event, for support and for filling gaps
    // in the status map. Scrubbed of anything credential-shaped by the caller.
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// The deduplication guarantee.
trackingEventSchema.index({ dedupeKey: 1 }, { unique: true });
// The timeline query: one shipment's scans, oldest first.
trackingEventSchema.index({ shipment: 1, occurredAt: 1 });
trackingEventSchema.index({ awbCode: 1, occurredAt: -1 });

// Deterministic identity for a scan.
//
// Prefers the carrier's own event id when there is one. Falls back to a hash of
// the facts that make a scan unique — the same shipment cannot have two
// different scans with the same status at the same instant, so this is safe,
// and it is stable across the webhook and the poller seeing the same event.
trackingEventSchema.statics.buildDedupeKey = function buildDedupeKey({
  shipmentId,
  carrierEventId,
  carrierStatus,
  occurredAt,
}) {
  if (carrierEventId) return `evt:${shipmentId}:${carrierEventId}`;

  const crypto = require('crypto');
  const stamp = occurredAt instanceof Date ? occurredAt.toISOString() : String(occurredAt || '');
  const basis = `${shipmentId}|${String(carrierStatus || '').trim().toLowerCase()}|${stamp}`;
  return `hash:${crypto.createHash('sha1').update(basis).digest('hex')}`;
};

// Insert-if-new. Returns the event when it was created, or null when this scan
// had already been recorded — so callers can cheaply tell a genuinely new scan
// from a replay without a separate read.
trackingEventSchema.statics.record = async function record(doc) {
  try {
    return await this.create(doc);
  } catch (err) {
    if (err.code === 11000) return null; // already recorded; not an error
    throw err;
  }
};

module.exports = mongoose.model('TrackingEvent', trackingEventSchema);
