const cron = require('node-cron');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const Order = require('../Models/Order');
const AccountingConfig = require('../Models/AccountingConfig');
const settlementService = require('../services/settlementService');
const razorpayRouteService = require('../services/razorpayRouteService');
const razorpayx = require('../services/razorpayxService');
const {
  initiateRazorpayTransferForSettlement,
  findBlockingLineIssue,
  isTransferDead,
  LIVE_PAYOUT_STATUSES,
} = require('../services/razorpaySettlementIntegration');
const razorpayxSettlement = require('../services/razorpayxSettlementIntegration');
const { syncPendingVendors } = require('../services/vendorRouteOnboarding');
const { syncPendingPayoutAccounts, payoutAccountReady } = require('../services/vendorPayoutAccount');
const { alertAdmins } = require('../services/adminAlertService');

// The seller-payout pipeline, end to end, with no admin click in AUTO mode.
// Which rail the money takes is SELLER_PAYOUT_PROVIDER
// (razorpayxService.payoutProvider):
//
//   razorpayx (default) — a bank payout from the platform's RazorpayX account
//   route               — a Razorpay Route transfer (needs Route enabled)
//
// Each tick:
//   1. payees      — approved sellers are set up with the provider (RazorpayX
//                    contact + fund account, or Route linked account)
//   2. holds       — batches this pipeline held itself are re-checked: a
//                    seller now ready is released, a batch made stale by a
//                    refund is cancelled so its lines are re-batched
//   3. generate    — every delivered line past the hold window is batched
//   4. pay         — every ELIGIBLE batch gets its payout / transfer
//   5. retry       — a failed attempt is retried, a few times
//   6. reconcile   — RazorpayX only: payouts whose webhook never came, or
//                    whose create response was lost, are re-read / re-sent
//
// Route's held transfers are released by Jobs/settlementReleaseJob.js; a
// RazorpayX payout is only made once due, so it needs no release step.
// MANUAL mode turns this whole job off.
//
// Same shape as the other jobs: a `running` flag so ticks never overlap, and
// candidates one at a time to stay polite to the Razorpay API.

const MAX_AUTO_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// Hold reasons this pipeline sets itself and so may also clear. A hold with
// any other reason (typed by an admin, or AMOUNT_MISMATCH, which needs a
// human to look) is never touched here.
const ROUTE_VENDOR_NOT_ACTIVE = 'VENDOR_RAZORPAY_NOT_ACTIVE';
const PAYOUT_ACCOUNT_NOT_READY = 'VENDOR_PAYOUT_ACCOUNT_NOT_READY';
const PAYOUT_REVERSED = 'PAYOUT_REVERSED_BY_BANK';
const NO_PAYMENT = 'NO_RAZORPAY_PAYMENT_TO_TRANSFER_AGAINST';
const MULTI_PAYMENT = 'MULTI_ORDER_SETTLEMENT_UNSUPPORTED';
const REGENERATE_REASONS = [
  'ACTIVE_RETURN_OR_REFUND',
  'REFUND_AFTER_SETTLEMENT_GENERATED_NEEDS_REGEN',
  'REFUND_BEFORE_RELEASE',
  'REFUND_BEFORE_RELEASE_REVERSAL_FAILED_MANUAL_RECONCILIATION',
];
const AUTO_HOLD_REASONS = [
  ROUTE_VENDOR_NOT_ACTIVE,
  PAYOUT_ACCOUNT_NOT_READY,
  PAYOUT_REVERSED,
  NO_PAYMENT,
  MULTI_PAYMENT,
  ...REGENERATE_REASONS,
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
 * sent can still reach the seller: no live payout, and — for a Route
 * transfer — Razorpay confirming it failed or was fully reversed.
 */
async function lastPayoutIsDead(settlement) {
  const last = await Payout.findOne({ settlement: settlement._id }).sort({ createdAt: -1 }).lean();
  if (!last) return true;
  if (LIVE_PAYOUT_STATUSES.includes(last.status)) return false;
  if (last.method === 'RAZORPAY_ROUTE') return isTransferDead(last);
  return true;
}

async function lineStillBlocked(settlement) {
  const orderIds = [...new Set(settlement.items.map((item) => String(item.order)))];
  const orders = await Order.find({ _id: { $in: orderIds } }).select('paymentStatus').lean();
  return Boolean(await findBlockingLineIssue(settlement, new Map(orders.map((order) => [String(order._id), order]))));
}

async function unhold(settlement) {
  const result = await settlementService.setSettlementHold({ settlementId: settlement._id, hold: false });
  return result.ok;
}

/**
 * Is the reason this batch was held gone, for the active provider? Returns
 * 'release', 'regenerate' or null (leave it held).
 */
async function decideHold(settlement, provider) {
  const reason = settlement.holdReason;

  if (reason === PAYOUT_ACCOUNT_NOT_READY || (reason === ROUTE_VENDOR_NOT_ACTIVE && provider === 'razorpayx')) {
    if (provider === 'route') return null;
    const vendor = await Vendor.findById(settlement.vendor).lean();
    return payoutAccountReady(vendor).ready ? 'release' : null;
  }

  if (reason === ROUTE_VENDOR_NOT_ACTIVE) {
    const vendor = await Vendor.findById(settlement.vendor).select('razorpay').lean();
    return vendorIsRouteReady(vendor) ? 'release' : null;
  }

  if (reason === PAYOUT_REVERSED) {
    // Paying the account that bounced would bounce again: wait for the
    // seller's bank account (and so their fund account) to change.
    const vendor = await Vendor.findById(settlement.vendor).lean();
    const reversed = await Payout.findOne({ settlement: settlement._id, status: 'REVERSED' }).sort({ createdAt: -1 }).lean();
    const moved = vendor?.razorpayx?.fundAccountId && vendor.razorpayx.fundAccountId !== reversed?.razorpayxFundAccountId;
    return moved && payoutAccountReady(vendor).ready ? 'release' : null;
  }

  if (reason === NO_PAYMENT) {
    // A RazorpayX payout or a Route direct transfer pays COD lines too.
    return provider === 'razorpayx' || razorpayRouteService.transferMode() === 'direct' ? 'release' : null;
  }

  if (reason === MULTI_PAYMENT) {
    if (provider === 'razorpayx' || razorpayRouteService.transferMode() === 'direct') return 'release';
    return (await lastPayoutIsDead(settlement)) ? 'regenerate' : null;
  }

  if (REGENERATE_REASONS.includes(reason)) {
    // Still under a live return — wait for it to be decided.
    if (reason === 'ACTIVE_RETURN_OR_REFUND' && (await lineStillBlocked(settlement))) return null;
    return (await lastPayoutIsDead(settlement)) ? 'regenerate' : null;
  }

  return null;
}

async function resolveAutoHolds(provider = razorpayx.payoutProvider()) {
  const held = await Settlement.find({
    status: settlementService.HOLD_STATUS,
    holdReason: { $in: AUTO_HOLD_REASONS },
  }).lean();

  const summary = { released: 0, regenerated: 0 };

  for (const settlement of held) {
    try {
      const decision = await decideHold(settlement, provider);
      if (decision === 'release') {
        if (await unhold(settlement)) summary.released += 1;
      } else if (decision === 'regenerate') {
        const cancelled = await settlementService.cancelSettlementForRegeneration({
          settlementId: settlement._id,
          reason: `Re-batched automatically (${settlement.holdReason})`,
        });
        if (cancelled.ok) summary.regenerated += 1;
      }
    } catch (err) {
      console.error(`[settlementAutomationJob] hold ${settlement._id} failed:`, err.message);
    }
  }

  return summary;
}

function initiatorFor(provider) {
  return provider === 'route'
    ? (id, options) => initiateRazorpayTransferForSettlement(id, options)
    : (id, options) => razorpayxSettlement.initiatePayoutForSettlement(id, options);
}

async function payEligible(provider, now) {
  const initiate = initiatorFor(provider);
  const eligible = await Settlement.find({ status: 'ELIGIBLE' }).select('_id').sort({ createdAt: 1 }).lean();
  const outcomes = {};
  for (const { _id } of eligible) {
    try {
      const result = await initiate(String(_id), { now });
      outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
      if (result.outcome === 'NOT_CONFIGURED') {
        // Every other batch would say the same.
        await alertAdmins({
          event: 'SETTLEMENT_FAILED',
          title: 'Seller payouts are not configured',
          message: `${result.message}. Seller settlements are ready but cannot be paid until this is set.`,
          link: '/admin/accounting/settlements',
          key: `PAYOUTS_NOT_CONFIGURED:${now.toISOString().slice(0, 10)}`,
          urgent: true,
        });
        break;
      }
    } catch (err) {
      outcomes.ERROR = (outcomes.ERROR || 0) + 1;
      console.error(`[settlementAutomationJob] payout for settlement ${_id} failed:`, err.message);
    }
  }
  return outcomes;
}

async function retryFailed(provider, now) {
  const method = provider === 'route' ? 'RAZORPAY_ROUTE' : razorpayxSettlement.METHOD;
  const initiate = initiatorFor(provider);
  const failed = await Settlement.find({ status: 'FAILED' }).select('_id settlementId netPayablePaise').lean();
  const summary = { retried: 0, exhausted: 0 };

  for (const settlement of failed) {
    try {
      const last = await Payout.findOne({ settlement: settlement._id }).sort({ attempt: -1 }).lean();
      // Only this provider's attempts are retried here; a failed hand-made
      // bank transfer stays with the admin who made it.
      if (!last || last.method !== method) continue;

      if (last.attempt >= MAX_AUTO_ATTEMPTS) {
        summary.exhausted += 1;
        await alertAdmins({
          event: 'SETTLEMENT_FAILED',
          title: 'Seller settlement needs attention',
          message: `Settlement ${settlement.settlementId || settlement._id} failed ${last.attempt} automatic payout attempts (last: ${last.failureReason || 'unknown'}). Automatic retries have stopped.`,
          link: '/admin/accounting/settlements',
          key: `SETTLEMENT_RETRIES_EXHAUSTED:${settlement._id}:${last.attempt}`,
          urgent: true,
        });
        continue;
      }

      const failedAt = new Date(last.processedAt || last.updatedAt || 0).getTime();
      if (now.getTime() - failedAt < RETRY_COOLDOWN_MS) continue;

      const result = await initiate(String(settlement._id), { now });
      if (['TRANSFER_CREATED', 'PAYOUT_CREATED'].includes(result.outcome)) summary.retried += 1;
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

    const provider = razorpayx.payoutProvider();
    const summary = { provider };

    // Each step is independent: a Razorpay outage while setting up one
    // seller must not stop sellers who are already set up from being paid.
    try {
      summary.payees = provider === 'route' ? await syncPendingVendors() : await syncPendingPayoutAccounts();
    } catch (err) {
      console.error('[settlementAutomationJob] payee step failed:', err.message);
    }
    try {
      summary.holds = await resolveAutoHolds(provider);
    } catch (err) {
      console.error('[settlementAutomationJob] holds step failed:', err.message);
    }
    try {
      const generated = await settlementService.generateSettlements({ now });
      summary.generated = generated.count;
    } catch (err) {
      console.error('[settlementAutomationJob] generate step failed:', err.message);
    }
    summary.payouts = await payEligible(provider, now);
    summary.retries = await retryFailed(provider, now);
    if (provider === 'razorpayx') {
      try {
        summary.reconcile = await razorpayxSettlement.reconcilePayouts(now);
      } catch (err) {
        console.error('[settlementAutomationJob] reconcile step failed:', err.message);
      }
    }

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
  console.log(`[settlementAutomationJob] scheduled with cron "${schedule}" (provider: ${razorpayx.payoutProvider()})`);
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
