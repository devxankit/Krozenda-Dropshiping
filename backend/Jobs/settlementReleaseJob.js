const cron = require('node-cron');
const Payout = require('../Models/Payout');
const AccountingConfig = require('../Models/AccountingConfig');
const { releaseSinglePayout } = require('../services/razorpaySettlementIntegration');

// Releases Razorpay Route transfers that were created on hold
// (razorpaySettlementIntegration.initiateRazorpayTransferForSettlement) once
// their settlement's eligibility window has passed. Webhooks (a later
// sub-task) are what ultimately confirm money actually moved; this job only
// asks Razorpay to lift the hold.
//
// Mirrors Jobs/cjSyncJob.js and Jobs/trackingPoller.js: a `running` flag
// prevents two ticks (or a slow tick and the next one) from overlapping and
// racing each other over the same candidates, and candidates are processed
// one at a time — deliberately not in parallel — both to stay polite to the
// Razorpay API and because the atomic claim below is only meaningful if one
// candidate's Razorpay call finishes before the next candidate's claim is
// attempted from this process.

let task = null;
let running = false;

/**
 * Applies this job's own "is it due yet" gate, then delegates the actual
 * safety-checked release sequence to
 * razorpaySettlementIntegration.releaseSinglePayout — the same function the
 * admin "release now" endpoint calls, so there is exactly one implementation
 * of "release one payout" rather than two that can drift.
 */
async function releaseOne(payout) {
  const settlement = payout.settlement;
  if (!settlement) {
    console.error(`[settlementReleaseJob] payout ${payout._id} has no linked settlement — skipping`);
    return;
  }

  const eligibleAt = settlement.eligibleAt;
  if (!eligibleAt || new Date(eligibleAt) > new Date()) {
    // Not due yet.
    return;
  }

  const result = await releaseSinglePayout(payout);

  if (result.ok) {
    console.log(
      JSON.stringify({ scope: 'SETTLEMENT_RELEASE', event: 'RELEASE_REQUESTED', payoutId: String(payout._id), transferId: payout.razorpayTransferId })
    );
    return;
  }

  if (result.outcome === 'DISQUALIFIED') {
    console.log(
      JSON.stringify({ scope: 'SETTLEMENT_RELEASE', event: 'RELEASE_DISQUALIFIED', payoutId: String(payout._id), reason: result.reason })
    );
  } else if (result.outcome === 'CLAIM_LOST') {
    console.log(
      JSON.stringify({ scope: 'SETTLEMENT_RELEASE', event: 'RELEASE_CLAIM_LOST', payoutId: String(payout._id), message: result.message })
    );
  } else {
    console.error(`[settlementReleaseJob] releaseTransfer failed for payout ${payout._id}:`, result.message);
  }
}

async function runOnce() {
  if (running) {
    console.log(JSON.stringify({ scope: 'SETTLEMENT_RELEASE', event: 'RELEASE_SKIPPED', reason: 'ALREADY_RUNNING' }));
    return null;
  }

  running = true;
  try {
    // Read fresh every tick — never cached across runs.
    const config = await AccountingConfig.resolve();
    if (config.sellerSettlementMode !== 'AUTO') {
      console.log(
        JSON.stringify({ scope: 'SETTLEMENT_RELEASE', event: 'RELEASE_SKIPPED_MANUAL_MODE' })
      );
      return null;
    }

    const candidates = await Payout.find({
      method: 'RAZORPAY_ROUTE',
      status: 'PROCESSING',
      razorpayTransferId: { $exists: true, $ne: null },
    })
      .populate({ path: 'settlement', populate: { path: 'vendor' } })
      .exec();

    for (const payout of candidates) {
      try {
        await releaseOne(payout);
      } catch (err) {
        console.error(`[settlementReleaseJob] candidate ${payout._id} failed:`, err.message);
      }
    }

    return { checked: candidates.length };
  } catch (err) {
    console.error('[settlementReleaseJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleSettlementRelease() {
  const schedule = process.env.SETTLEMENT_RELEASE_CRON || '*/30 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`[settlementReleaseJob] invalid cron "${schedule}" — settlement release not scheduled`);
    return null;
  }

  task = cron.schedule(schedule, runOnce);
  console.log(`[settlementReleaseJob] scheduled with cron "${schedule}"`);
  return task;
}

function stopSettlementRelease() {
  task?.stop();
  task = null;
}

module.exports = { scheduleSettlementRelease, stopSettlementRelease, runOnce };
