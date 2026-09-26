const cron = require('node-cron');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const AccountingConfig = require('../Models/AccountingConfig');
const settlementService = require('../services/settlementService');
const razorpayRouteService = require('../services/razorpayRouteService');
const {
  initiateRazorpayTransferForSettlement,
  checkSettlementSafeForTransfer,
  isTransferDead,
  LIVE_PAYOUT_STATUSES,
} = require('../services/razorpaySettlementIntegration');
const { syncPendingVendors } = require('../services/vendorRouteOnboarding');
const { alertAdmins } = require('../services/adminAlertService');

// The seller-payout pipeline, end to end, with no admin click in AUTO mode:
//
//   1. onboarding  — approved sellers get a Razorpay Route linked account,
//                    and their activation is polled until Razorpay says ACTIVE
//   2. holds       — batches the pipeline itself held are re-checked: a seller
//                    who is now active is released, a batch made stale by a
//                    refund is cancelled so its lines are re-batched
//   3. generate    — every delivered line past the hold window is batched
//   4. transfer    — every ELIGIBLE batch gets its Route transfer
//   5. retry       — a failed transfer is retried, a few times, once
//                    Razorpay confirms the old one is dead
//
// Releasing a held transfer once its window passes stays with
// Jobs/settlementReleaseJob.js, and the transfer.processed webhook marks it
// paid. MANUAL mode turns this whole job off: batches and transfers then only
// happen from the admin panel.
//
// Same shape as the other jobs: a `running` flag so ticks never overlap, and
// candidates one at a time to stay polite to the Razorpay API.

const MAX_AUTO_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Hold reasons this pipeline sets itself and so may also clear. A hold with
// any other reason (typed by an admin, or AMOUNT_MISMATCH, which needs a
// human to look) is never touched here.
const UNHOLD_WHEN_VENDOR_ACTIVE = 'VENDOR_RAZORPAY_NOT_ACTIVE';
const UNHOLD_IN_DIRECT_MODE = 'NO_RAZORPAY_PAYMENT_TO_TRANSFER_AGAINST';
const REGENERATE_REASONS = [
  'ACTIVE_RETURN_OR_REFUND',
  'MULTI_ORDER_SETTLEMENT_UNSUPPORTED',
  'REFUND_AFTER_SETTLEMENT_GENERATED_NEEDS_REGEN',
  'REFUND_BEFORE_RELEASE',
  'REFUND_BEFORE_RELEASE_REVERSAL_FAILED_MANUAL_RECONCILIATION',
];

let task = null;
let running = false;

function log(entry) {
  console.log(JSON.stringify({ scope: 'SETTLEMENT_AUTOMATION', ...entry }));
}

function vendorIsRouteReady(vendor) {
  const rzp = vendor?.razorpay || {};
  return Boolean(rzp.isSettlementEligible && rzp.onboardingStatus === 'ACTIVE' && rzp.accountId);
}

/**
 * A held batch may only be cancelled and re-batched once nothing it ever
 * sent can still reach the seller: no live payout, and Razorpay confirming
 * its last transfer failed or was fully reversed.
 */
async function lastTransferIsDead(settlement) {
  const last = await Payout.findOne({ settlement: settlement._id, method: 'RAZORPAY_ROUTE' })
    .sort({ attempt: -1 })
    .lean();
  if (!last) return true;
  if (LIVE_PAYOUT_STATUSES.includes(last.status)) return false;
  return isTransferDead(last);
}

async function resolveAutoHolds() {
  const mode = razorpayRouteService.transferMode();
  const held = await Settlement.find({
    status: settlementService.HOLD_STATUS,
    holdReason: { $in: [UNHOLD_WHEN_VENDOR_ACTIVE, UNHOLD_IN_DIRECT_MODE, ...REGENERATE_REASONS] },
  }).lean();

  const summary = { released: 0, regenerated: 0 };

  for (const settlement of held) {
    try {
      if (settlement.holdReason === UNHOLD_WHEN_VENDOR_ACTIVE) {
        const vendor = await Vendor.findById(settlement.vendor).select('razorpay').lean();
        if (!vendorIsRouteReady(vendor)) continue;
        const result = await settlementService.setSettlementHold({ settlementId: settlement._id, hold: false });
        if (result.ok) summary.released += 1;
        continue;
      }

      if (settlement.holdReason === UNHOLD_IN_DIRECT_MODE) {
        if (mode !== 'direct') continue;
        const result = await settlementService.setSettlementHold({ settlementId: settlement._id, hold: false });
        if (result.ok) summary.released += 1;
        continue;
      }

      if (settlement.holdReason === 'MULTI_ORDER_SETTLEMENT_UNSUPPORTED' && mode !== 'payment') {
        // Direct mode pays a multi-payment batch as it stands.
        const result = await settlementService.setSettlementHold({ settlementId: settlement._id, hold: false });
        if (result.ok) summary.released += 1;
        continue;
      }

      if (settlement.holdReason === 'ACTIVE_RETURN_OR_REFUND') {
        // Still under a live return — wait for it to be decided.
        const safety = await checkSettlementSafeForTransfer(settlement._id);
        if (!safety.ok && safety.reason === 'ACTIVE_RETURN_OR_REFUND') continue;
      }

      if (!(await lastTransferIsDead(settlement))) continue;

      const cancelled = await settlementService.cancelSettlementForRegeneration({
        settlementId: settlement._id,
        reason: `Re-batched automatically (${settlement.holdReason})`,
      });
      if (cancelled.ok) summary.regenerated += 1;
    } catch (err) {
      console.error(`[settlementAutomationJob] hold ${settlement._id} failed:`, err.message);
    }
  }

  return summary;
}

async function transferEligible() {
  const eligible = await Settlement.find({ status: 'ELIGIBLE' }).select('_id').sort({ createdAt: 1 }).lean();
  const outcomes = {};
  for (const { _id } of eligible) {
    try {
      const result = await initiateRazorpayTransferForSettlement(String(_id));
      outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
    } catch (err) {
      outcomes.ERROR = (outcomes.ERROR || 0) + 1;
      console.error(`[settlementAutomationJob] transfer for settlement ${_id} failed:`, err.message);
    }
  }
  return outcomes;
}

async function retryFailed(now) {
  const failed = await Settlement.find({ status: 'FAILED' }).select('_id settlementId netPayablePaise').lean();
  const summary = { retried: 0, exhausted: 0 };

  for (const settlement of failed) {
    try {
      const last = await Payout.findOne({ settlement: settlement._id }).sort({ attempt: -1 }).lean();
      // Only Route attempts are retried here; a failed hand-made bank
      // transfer stays with the admin who made it.
      if (!last || last.method !== 'RAZORPAY_ROUTE') continue;

      if (last.attempt >= MAX_AUTO_ATTEMPTS) {
        summary.exhausted += 1;
        await alertAdmins({
          event: 'SETTLEMENT_FAILED',
          title: 'Seller settlement needs attention',
          message: `Settlement ${settlement.settlementId || settlement._id} failed ${last.attempt} Razorpay Route attempts (last: ${last.failureReason || 'unknown'}). Automatic retries have stopped.`,
          link: '/admin/finance/settlements',
          key: `SETTLEMENT_RETRIES_EXHAUSTED:${settlement._id}:${last.attempt}`,
          urgent: true,
        });
        continue;
      }

      const failedAt = new Date(last.processedAt || last.updatedAt || 0).getTime();
      if (now.getTime() - failedAt < RETRY_COOLDOWN_MS) continue;

      const result = await initiateRazorpayTransferForSettlement(String(settlement._id));
      if (result.outcome === 'TRANSFER_CREATED') summary.retried += 1;
    } catch (err) {
      console.error(`[settlementAutomationJob] retry for settlement ${settlement._id} failed:`, err.message);
    }
  }

  return summary;
}

async function runOnce({ now = new Date() } = {}) {
  if (running) {
    log({ event: 'SKIPPED', reason: 'ALREADY_RUNNING' });
    return null;
  }

  running = true;
  try {
    const config = await AccountingConfig.resolve();
    if (config.sellerSettlementMode !== 'AUTO') {
      log({ event: 'SKIPPED_MANUAL_MODE' });
      return null;
    }

    const summary = {};

    // Each step is independent: a Razorpay outage during onboarding must not
    // stop sellers who are already active from being paid.
    try {
      summary.onboarding = await syncPendingVendors();
    } catch (err) {
      console.error('[settlementAutomationJob] onboarding step failed:', err.message);
    }
    try {
      summary.holds = await resolveAutoHolds();
    } catch (err) {
      console.error('[settlementAutomationJob] holds step failed:', err.message);
    }
    try {
      const generated = await settlementService.generateSettlements({ now });
      summary.generated = generated.count;
    } catch (err) {
      console.error('[settlementAutomationJob] generate step failed:', err.message);
    }
    summary.transfers = await transferEligible();
    summary.retries = await retryFailed(now);

    log({ event: 'RUN_COMPLETE', ...summary });
    return summary;
  } catch (err) {
    console.error('[settlementAutomationJob] cycle failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function scheduleSettlementAutomation() {
  const schedule = process.env.SETTLEMENT_AUTOMATION_CRON || '0 */6 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[settlementAutomationJob] invalid cron "${schedule}" — settlement automation not scheduled`);
    return null;
  }

  task = cron.schedule(schedule, () => runOnce());
  console.log(`[settlementAutomationJob] scheduled with cron "${schedule}"`);
  return task;
}

function stopSettlementAutomation() {
  task?.stop();
  task = null;
}

module.exports = {
  scheduleSettlementAutomation,
  stopSettlementAutomation,
  runOnce,
  resolveAutoHolds,
  MAX_AUTO_ATTEMPTS,
};
