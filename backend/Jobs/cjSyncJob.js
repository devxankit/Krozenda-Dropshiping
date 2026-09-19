const cron = require('node-cron');
const cjInventoryService = require('../services/cj/cjInventoryService');

// Scheduled fallback for CJ stock/price sync (master plan §12/§32) —
// webhooks (Phase 4, once CJ sends them) are primary; this covers the case
// where a webhook is dropped or CJ has none configured yet.
//
// Job locking (hardening req #5): `running` prevents a slow cycle from
// overlapping the next tick, which would double the request rate against CJ
// at exactly the wrong moment and could interleave two sync passes over the
// same mapping.

let task = null;
let running = false;
let lastStartedAt = null;
let lastFinishedAt = null;
let lastResult = null;

async function runOnce() {
  if (running) {
    console.log(JSON.stringify({ scope: 'CJ', event: 'CJ_SYNC_SKIPPED', reason: 'ALREADY_RUNNING' }));
    return null;
  }

  running = true;
  lastStartedAt = new Date();
  try {
    const result = await cjInventoryService.syncAll({ trigger: 'SCHEDULED' });
    lastResult = result;
    console.log(JSON.stringify({ scope: 'CJ', event: 'CJ_SYNC_COMPLETE', ...result }));
    return result;
  } catch (err) {
    console.error('[cjSyncJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
    lastFinishedAt = new Date();
  }
}

function scheduleCjSync() {
  const schedule = process.env.CJ_SYNC_CRON || '*/10 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[cjSyncJob] invalid cron "${schedule}" — CJ sync not scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[cjSyncJob] scheduled with cron "${schedule}"`);
  return task;
}

function stopCjSync() {
  task?.stop();
  task = null;
}

// Stuck-job visibility for the admin Sync Logs screen (master plan §32).
function status() {
  return { running, lastStartedAt, lastFinishedAt, lastResult };
}

module.exports = { scheduleCjSync, stopCjSync, runOnce, status };
