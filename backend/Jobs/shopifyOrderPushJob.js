const cron = require('node-cron');
const orderPushService = require('../services/shopify/orderPushService');

// Sends paid orders to Shopify once their cancel window has passed.
//
// Runs every minute by default. The queue itself holds the ordering and the
// claiming (ShopifyOrderPush.claimNext is atomic), so this job is only a
// clock — and the `running` flag means a slow cycle never overlaps the next
// tick and double-claims.

let task = null;
let running = false;
let lastRun = null;
let lastSummary = null;

async function runOnce() {
  if (running) return null;
  running = true;
  try {
    const summary = await orderPushService.drain();
    lastRun = new Date();
    lastSummary = summary;

    // Quiet when there is nothing to do — this ticks 1,440 times a day and
    // logging every empty cycle would bury the cycles that matter.
    if (!summary.skipped && summary.claimed > 0) {
      console.log(JSON.stringify({ scope: 'SHOPIFY_PUSH', event: 'CYCLE', at: lastRun.toISOString(), ...summary }));
    }
    return summary;
  } catch (err) {
    console.error('[shopifyOrderPushJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleShopifyOrderPush() {
  const schedule = process.env.SHOPIFY_ORDER_PUSH_CRON || '* * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[shopifyOrderPushJob] invalid cron "${schedule}" — order push NOT scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[shopifyOrderPushJob] scheduled with cron "${schedule}"`);
  return task;
}

function status() {
  return {
    scheduled: Boolean(task),
    running,
    lastRun,
    lastSummary,
    cron: process.env.SHOPIFY_ORDER_PUSH_CRON || '* * * * *',
  };
}

module.exports = { scheduleShopifyOrderPush, runOnce, status };
