const Shipment = require('../../Models/Shipment');
const TrackingEvent = require('../../Models/TrackingEvent');
const { resolveForShipment } = require('./shippingAccountResolver');
const shiprocketService = require('./shiprocketService');
const { mapStatusForShipment, POLLABLE_STATUSES } = require('../../Config/shipping');
const { syncOrderFromShipment } = require('./shipmentService');
const buyerAlerts = require('../buyerAlertService');

// Turning carrier scans into shipment state.
//
// Three things feed this — the webhook, the cron poller and a manual refresh —
// and all three land on applyScans(). That is deliberate: deduplication and
// the no-downgrade rule have to hold no matter which door an event came in
// through, so there is exactly one implementation of both.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// ---------------------------------------------------------------------------
// Scan normalisation
// ---------------------------------------------------------------------------
// The tracking ENDPOINT is verified (GET /v1/external/courier/track/awb/{awb}).
// The response shape is not documented field-by-field in anything I could
// confirm, so this reads through tolerant aliases and keeps the raw entry.
// Anything unreadable becomes null rather than a guess.

function firstDefined(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

// Shiprocket reports scan times in IST and sends them WITHOUT a timezone
// designator ("2026-09-17 10:00:00"). `new Date()` reads such a string in the
// server's local zone, which is correct on an IST machine and silently wrong
// by 5.5 hours on a UTC host — where most deployments run. So a bare
// timestamp is pinned to IST explicitly rather than inheriting the host's
// clock. Anything that DOES carry a zone (a trailing Z or +05:30, or an ISO
// string) is left exactly as the carrier sent it.
const CARRIER_TZ_OFFSET = '+05:30';
const BARE_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  const bare = text.match(BARE_TIMESTAMP_RE);
  const parsed = bare
    ? new Date(`${bare[1]}T${bare[2].length === 5 ? `${bare[2]}:00` : bare[2]}${CARRIER_TZ_OFFSET}`)
    : new Date(text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// One carrier scan -> our shape. `occurredAt` falls back to now only as a last
// resort, and that is recorded, because a scan with a fabricated timestamp
// would corrupt the ordering logic that depends on it.
function normaliseScan(raw) {
  const occurredAt =
    parseDate(firstDefined(raw, ['date', 'activity_date', 'timestamp', 'scan_date_time', 'updated_at']));

  return {
    carrierStatus: String(firstDefined(raw, ['status', 'current_status', 'activity', 'sr_status_label']) || '').trim(),
    location: String(firstDefined(raw, ['location', 'scan_location', 'city']) || '').trim(),
    description: String(firstDefined(raw, ['activity', 'remark', 'status_description', 'sr_status_label']) || '').trim(),
    occurredAt,
    occurredAtWasMissing: occurredAt === null,
    carrierEventId: firstDefined(raw, ['id', 'scan_id', 'activity_id']),
    raw,
  };
}

// Pulls the scan array out of a tracking response. Shiprocket nests it under
// tracking_data.shipment_track_activities; the fallbacks cover the flatter
// shapes and the by-AWB keyed variant.
function extractScans(body) {
  const candidates = [
    body?.tracking_data?.shipment_track_activities,
    body?.data?.tracking_data?.shipment_track_activities,
    body?.shipment_track_activities,
  ];

  // The by-AWB form: { "AWB123": { tracking_data: { ... } } }
  if (body && typeof body === 'object') {
    for (const value of Object.values(body)) {
      if (value?.tracking_data?.shipment_track_activities) {
        candidates.push(value.tracking_data.shipment_track_activities);
      }
    }
  }

  const found = candidates.find((c) => Array.isArray(c) && c.length > 0);
  return Array.isArray(found) ? found : [];
}

// The headline status and ETA, which Shiprocket reports separately from the
// scan list.
function extractSummary(body) {
  const track =
    body?.tracking_data?.shipment_track?.[0] ||
    body?.data?.tracking_data?.shipment_track?.[0] ||
    null;

  return {
    currentStatus: String(
      firstDefined(body?.tracking_data || body?.data?.tracking_data || {}, ['shipment_status']) ||
        firstDefined(track || {}, ['current_status', 'status']) ||
        ''
    ).trim(),
    estimatedDeliveryAt: parseDate(firstDefined(track || {}, ['edd', 'expected_delivery_date'])),
    trackUrl: firstDefined(body?.tracking_data || body?.data?.tracking_data || {}, ['track_url']),
  };
}

// ---------------------------------------------------------------------------
// applyScans — the single place scans become state
// ---------------------------------------------------------------------------
// Returns what actually changed, so callers can tell a genuinely new event
// from a replay without re-reading.
async function applyScans(shipment, scans, { source = 'WEBHOOK', summary = null } = {}) {
  const statusBefore = shipment.internalStatus;
  let newEvents = 0;
  let statusChanged = false;
  const unmappedStatuses = [];

  // Oldest first. A webhook may deliver several scans at once, and applying
  // them newest-first would let an older scan win the final status.
  const ordered = [...scans]
    .filter((s) => s.carrierStatus)
    .sort((a, b) => {
      if (!a.occurredAt || !b.occurredAt) return 0;
      return a.occurredAt - b.occurredAt;
    });

  for (const scan of ordered) {
    // Return parcels read the same words differently — see mapStatusForShipment.
    const mapped = mapStatusForShipment(scan.carrierStatus, shipment.shipmentType);
    if (!mapped) unmappedStatuses.push(scan.carrierStatus);

    // A scan with no timestamp cannot be deduplicated reliably against a
    // future delivery of the same scan, so it is anchored to the shipment and
    // its status text — still stable, just coarser.
    const occurredAt = scan.occurredAt || new Date();

    const recorded = await TrackingEvent.record({
      shipment: shipment._id,
      awbCode: shipment.awbCode || '',
      carrierStatus: scan.carrierStatus,
      mappedStatus: mapped,
      location: scan.location,
      description: scan.description,
      occurredAt,
      source,
      dedupeKey: TrackingEvent.buildDedupeKey({
        shipmentId: shipment._id,
        carrierEventId: scan.carrierEventId,
        carrierStatus: scan.carrierStatus,
        occurredAt,
      }),
      raw: scan.raw,
    });

    if (!recorded) continue; // already seen — a replayed webhook
    newEvents += 1;

    // applyStatus enforces the no-downgrade rule, so a late IN_TRANSIT after
    // DELIVERED is silently ignored here rather than needing a check at every
    // call site (task §49).
    // The scan's own time, so `pickedUpAt`/`deliveredAt` record when the
    // parcel actually moved rather than when this process heard about it.
    if (mapped && shipment.applyStatus(mapped, { source, note: scan.location || '', at: occurredAt })) {
      statusChanged = true;
    }
  }

  // The carrier's headline status, stored verbatim for support. Never drives
  // logic — that is what the mapped scans above are for.
  if (summary?.currentStatus) {
    shipment.shiprocketStatus = summary.currentStatus;

    // The summary can be ahead of the scan list (the scans lag on some
    // couriers), so it gets a chance to move the status too — through the same
    // guarded path.
    const mappedSummary = mapStatusForShipment(summary.currentStatus, shipment.shipmentType);
    if (mappedSummary && shipment.applyStatus(mappedSummary, { source, note: 'carrier summary status' })) {
      statusChanged = true;
    } else if (!mappedSummary) {
      unmappedStatuses.push(summary.currentStatus);
    }
  }
  if (summary?.estimatedDeliveryAt) shipment.estimatedDeliveryAt = summary.estimatedDeliveryAt;
  if (summary?.trackUrl && !shipment.trackingUrl) shipment.trackingUrl = summary.trackUrl;

  if (source === 'WEBHOOK') shipment.lastWebhookAt = new Date();
  shipment.lastTrackingSyncAt = new Date();
  await shipment.save();

  // An unrecognised carrier status is a gap in the status map, and silence
  // would let it stay a gap forever. It never changes the shipment.
  if (unmappedStatuses.length) {
    log({
      event: 'SHIPROCKET_UNMAPPED_STATUS',
      shipmentId: String(shipment._id),
      statuses: [...new Set(unmappedStatuses)],
    });
  }

  if (statusChanged) {
    await syncOrderFromShipment(shipment);
    // Out for delivery / failed attempt have no order status of their own,
    // so the Order-model WhatsApp hook never sees them. Never throws.
    if (shipment.internalStatus !== statusBefore) {
      await buyerAlerts.notifyShipmentMilestone(shipment);
    }
  }

  return { newEvents, statusChanged, unmappedStatuses };
}

// ---------------------------------------------------------------------------
// syncShipment — pull tracking from the carrier
// ---------------------------------------------------------------------------
async function syncShipment(shipment, { source = 'POLL' } = {}) {
  if (!shipment.awbCode) {
    return { ok: false, code: 'NO_AWB', message: 'This shipment has no AWB to track yet.' };
  }

  // Uses the account the shipment was CREATED with, not whatever the seller
  // has configured today — a disconnected seller's parcels must stay
  // trackable (task §14).
  const resolution = await resolveForShipment(shipment, { operation: 'TRACK' });
  if (!resolution.ok) {
    return { ok: false, code: resolution.reason, message: resolution.message };
  }

  try {
    const { body } = await shiprocketService.trackByAwb(resolution.integration, shipment.awbCode, { onLog: log });

    const scans = extractScans(body).map(normaliseScan);
    const summary = extractSummary(body);
    const result = await applyScans(shipment, scans, { source, summary });

    log({
      event: 'SHIPROCKET_TRACKING_SYNC',
      shipmentId: String(shipment._id),
      awb: shipment.awbCode,
      newEvents: result.newEvents,
      statusChanged: result.statusChanged,
    });

    return { ok: true, shipment, ...result };
  } catch (err) {
    // A tracking failure is never fatal: the shipment keeps its last known
    // state and the next poll tries again. It is NOT marked FAILED — that
    // would turn a carrier outage into a fleet of broken shipments.
    log({ event: 'SHIPROCKET_TRACKING_FAILED', shipmentId: String(shipment._id), code: err.code });

    shipment.lastTrackingSyncAt = new Date();
    await shipment.save();

    return {
      ok: false,
      code: 'CARRIER_ERROR',
      message: 'Could not refresh tracking from the carrier right now.',
    };
  }
}

// ---------------------------------------------------------------------------
// The timeline a client sees
// ---------------------------------------------------------------------------
async function getTimeline(shipment, { limit = 100 } = {}) {
  const events = await TrackingEvent.find({ shipment: shipment._id })
    .sort({ occurredAt: 1 })
    .limit(limit)
    .lean();

  return events.map((event) => ({
    // The carrier's wording is what a buyer recognises from an SMS, so it is
    // shown — but `status` is ours, and that is what any UI logic keys on.
    status: event.mappedStatus,
    carrierStatus: event.carrierStatus,
    location: event.location || '',
    description: event.description || '',
    occurredAt: event.occurredAt,
  }));
}

// ---------------------------------------------------------------------------
// The polling fallback  (task §24)
// ---------------------------------------------------------------------------
// Webhooks are primary. This exists because webhooks get lost, and without it
// a dropped delivery event leaves a parcel stuck at IN_TRANSIT forever.
//
// Deliberately narrow: only shipments that are BOTH in a pollable state and
// stale. A delivered, cancelled or not-yet-shipped parcel is never fetched —
// polling everything would be the "continuously poll all shipments" the brief
// rules out.
async function findStaleShipments({ staleAfterMinutes = 180, batchSize = 50 } = {}) {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

  return Shipment.find({
    internalStatus: { $in: POLLABLE_STATUSES },
    awbCode: { $ne: null },
    $or: [{ lastTrackingSyncAt: null }, { lastTrackingSyncAt: { $lt: cutoff } }],
  })
    .sort({ lastTrackingSyncAt: 1 })
    .limit(batchSize);
}

async function runPollCycle({ staleAfterMinutes = 180, batchSize = 50 } = {}) {
  const shipments = await findStaleShipments({ staleAfterMinutes, batchSize });
  if (shipments.length === 0) return { checked: 0, updated: 0, failed: 0 };

  let updated = 0;
  let failed = 0;

  // Sequential on purpose. A parallel burst across 50 shipments is exactly
  // what trips the carrier's rate limit, and this runs in the background where
  // wall-clock time does not matter.
  for (const shipment of shipments) {
    const result = await syncShipment(shipment, { source: 'POLL' });
    if (!result.ok) failed += 1;
    else if (result.statusChanged || result.newEvents > 0) updated += 1;
  }

  log({ event: 'SHIPROCKET_POLL_CYCLE', checked: shipments.length, updated, failed });
  return { checked: shipments.length, updated, failed };
}

module.exports = {
  applyScans,
  syncShipment,
  getTimeline,
  findStaleShipments,
  runPollCycle,
  normaliseScan,
  extractScans,
  extractSummary,
};
