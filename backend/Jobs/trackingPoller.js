const cron = require('node-cron');
const ShippingSettings = require('../Models/ShippingSettings');
const trackingService = require('../services/shipping/trackingService');

// The fallback for lost webhooks (task §24).
//
// Webhooks are primary and cover the normal case. This exists because they get
// dropped, and a missed "Delivered" event otherwise leaves a parcel showing
// IN_TRANSIT indefinitely — visible to the buyer, and wrong.
//
// It is deliberately narrow: only shipments that are BOTH in a pollable state
// AND have not been synced within the staleness window. Delivered, cancelled
// and not-yet-shipped parcels are never fetched.

let task = null;
// A slow cycle must never overlap with the next tick — that would double the
// request rate against the carrier at exactly the wrong moment.
let running = false;

async function runOnce() {
  if (running) {
    console.log(JSON.stringify({ scope: 'SHIPPING', event: 'SHIPROCKET_POLL_SKIPPED', reason: 'ALREADY_RUNNING' }));
    return null;
  }

  running = true;
  try {
    const settings = await ShippingSettings.getSettings();
    if (!settings.shippingEnabled || !settings.trackingPollEnabled) return null;

    return await trackingService.runPollCycle({
      staleAfterMinutes: settings.trackingStaleAfterMinutes,
      batchSize: settings.trackingPollBatchSize,
    });
  } catch (err) {
    console.error('[trackingPoller] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

// Reads its schedule from ShippingSettings so an admin can change the cadence
// without a deploy. Mirrors how Jobs/backupScheduler is wired into boot.
async function scheduleTrackingPoller() {
  try {
    const settings = await ShippingSettings.getSettings();

    if (!settings.trackingPollEnabled) {
      console.log('[trackingPoller] disabled in shipping settings');
      return null;
    }

    const schedule = settings.trackingPollCron || '*/30 * * * *';
    if (!cron.validate(schedule)) {
      console.error(`[trackingPoller] invalid cron "${schedule}" — poller not started`);
      return null;
    }

    task = cron.schedule(schedule, runOnce);
    console.log(`[trackingPoller] scheduled (${schedule})`);
    return task;
  } catch (err) {
    // Never let this stop the API from booting.
    console.error('[trackingPoller] could not start:', err.message);
    return null;
  }
}

function stopTrackingPoller() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { scheduleTrackingPoller, stopTrackingPoller, runOnce };
