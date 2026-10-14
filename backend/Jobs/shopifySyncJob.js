const cron = require('node-cron');
const inboundCatalogSync = require('../services/shopify/inboundCatalogSync');
const inboundOrderSync = require('../services/shopify/inboundOrderSync');
const ShopifySettings = require('../Models/ShopifySettings');

// Re-reads stock and status for every imported product.
//
// Webhooks are the primary mechanism and this is the SAFETY NET. Shopify
// gives up retrying a webhook after a few hours, and a server that was down
// or a subscription that lapsed loses those events permanently. Without this
// job a product keeps a stale stock figure forever and oversells silently.

let task = null;
let running = false;
let lastRun = null;
let lastSummary = null;

async function runOnce() {
  if (running) return null;
  running = true;
  try {
    const settings = await ShopifySettings.getSettings();
    if (settings.status !== 'CONNECTED') {
      lastSummary = { skipped: true, reason: 'NOT_CONNECTED' };
      return lastSummary;
    }

    const products = await inboundCatalogSync.syncAll({ limit: Number(process.env.SHOPIFY_SYNC_BATCH) || 100 });

    // Orders too. Webhooks are faster, but they need a public HTTPS address —
    // and without this an order sits at PENDING for the buyer while the parcel
    // is already on its way.
    const orders = await inboundOrderSync.pollOpenOrders({ limit: Number(process.env.SHOPIFY_POLL_BATCH) || 50 });

    const summary = { products, orders };
    lastRun = new Date();
    lastSummary = summary;

    if (products.changed || products.failed || orders.changed || orders.failed) {
      console.log(JSON.stringify({ scope: 'SHOPIFY_SYNC', event: 'CYCLE', at: lastRun.toISOString(), ...summary }));
    }
    return summary;
  } catch (err) {
    console.error('[shopifySyncJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleShopifySync() {
  const schedule = process.env.SHOPIFY_SYNC_CRON || '*/15 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[shopifySyncJob] invalid cron "${schedule}" — catalogue sync NOT scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[shopifySyncJob] scheduled with cron "${schedule}"`);
  return task;
}

function status() {
  return { scheduled: Boolean(task), running, lastRun, lastSummary, cron: process.env.SHOPIFY_SYNC_CRON || '*/15 * * * *' };
}

module.exports = { scheduleShopifySync, runOnce, status };
