const cron = require('node-cron');
const { autoCancelUnacceptedOrders } = require('../services/orderAutoCancelService');

// Cancels (and refunds) orders no seller accepted within the window — see
// services/orderAutoCancelService. Same shape as the other Jobs: a `running`
// flag so a slow cycle never overlaps the next tick.

let task = null;
let running = false;

async function runOnce() {
  if (running) return null;
  running = true;
  try {
    const result = await autoCancelUnacceptedOrders();
    if (result.cancelledOrders > 0) {
      console.log(JSON.stringify({ scope: 'ORDER_AUTO_CANCEL', event: 'CANCELLED', ...result }));
    }
    return result;
  } catch (err) {
    console.error('[orderAutoCancelJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleOrderAutoCancel() {
  const schedule = process.env.ORDER_AUTO_CANCEL_CRON || '*/15 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[orderAutoCancelJob] invalid cron "${schedule}" — auto-cancel not scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[orderAutoCancelJob] scheduled with cron "${schedule}"`);
  return task;
}

function stopOrderAutoCancel() {
  task?.stop();
  task = null;
}

module.exports = { scheduleOrderAutoCancel, stopOrderAutoCancel, runOnce };
