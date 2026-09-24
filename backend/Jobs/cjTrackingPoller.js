const cron = require('node-cron');
const CjShipment = require('../Models/CjShipment');
const cjLogisticsService = require('../services/cj/cjLogisticsService');
const pointsGuard = require('../services/cj/cjPointsGuard');

// Tracking feeds the buyer's order status, so it may dig deeper into the CJ
// points balance than stock sync before it stands down.
const POINTS_RESERVE = Number(process.env.CJ_TRACKING_POINTS_RESERVE || 1000);

// Fallback for lost CJ tracking webhooks (master plan §12/§18), same shape
// as the existing Shiprocket Jobs/trackingPoller.js: only pollable shipments
// (not yet delivered/RTO'd) that haven't synced within the staleness window,
// and a `running` lock so a slow cycle never overlaps the next tick
// (hardening req #5).

const TERMINAL_STATUSES = ['DELIVERED', 'RTO'];
const STALE_AFTER_MINUTES = Number(process.env.CJ_TRACKING_STALE_MINUTES || 30);
const BATCH_SIZE = Number(process.env.CJ_TRACKING_POLL_BATCH_SIZE || 50);

let task = null;
let running = false;

async function runOnce() {
  if (running) {
    console.log(JSON.stringify({ scope: 'CJ', event: 'CJ_TRACKING_POLL_SKIPPED', reason: 'ALREADY_RUNNING' }));
    return null;
  }

  running = true;
  try {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000);
    const shipments = await CjShipment.find({
      status: { $nin: TERMINAL_STATUSES },
      $or: [{ lastSyncedAt: null }, { lastSyncedAt: { $lt: staleBefore } }],
    }).limit(BATCH_SIZE);

    let succeeded = 0;
    let failed = 0;

    let stoppedReason = null;
    for (const shipment of shipments) {
      if (!pointsGuard.canSpendInBackground(POINTS_RESERVE)) {
        stoppedReason = 'CJ_POINTS_LOW';
        break;
      }
      try {
        await cjLogisticsService.syncShipment(shipment);
        succeeded += 1;
      } catch (err) {
        if (err.code === 'CJ_POINTS_EXHAUSTED' || err.code === 'CJ_RATE_LIMITED') {
          stoppedReason = 'CJ_POINTS_LOW';
          break;
        }
        failed += 1;
        console.error(`[cjTrackingPoller] shipment ${shipment._id} sync failed:`, err.message);
      }
    }

    const result = { total: shipments.length, succeeded, failed, ...(stoppedReason ? { stoppedReason } : {}) };
    console.log(JSON.stringify({ scope: 'CJ', event: 'CJ_TRACKING_POLL_COMPLETE', ...result }));
    return result;
  } catch (err) {
    console.error('[cjTrackingPoller] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleCjTrackingPoller() {
  const schedule = process.env.CJ_TRACKING_POLL_CRON || '*/15 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[cjTrackingPoller] invalid cron "${schedule}" — not scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[cjTrackingPoller] scheduled with cron "${schedule}"`);
  return task;
}

function stopCjTrackingPoller() {
  task?.stop();
  task = null;
}

module.exports = { scheduleCjTrackingPoller, stopCjTrackingPoller, runOnce };
