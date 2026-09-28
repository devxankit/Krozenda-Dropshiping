const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const Order = require('../Models/Order');
const AccountingConfig = require('../Models/AccountingConfig');
const razorpayx = require('./razorpayxService');
const payoutService = require('./payoutService');
const { setSettlementHold } = require('./settlementService');
const { payoutAccountReady } = require('./vendorPayoutAccount');
const {
  findBlockingLineIssue,
  amountIsConsistent,
  settlementReleaseAt,
  LIVE_PAYOUT_STATUSES,
} = require('./razorpaySettlementIntegration');
const { alertAdmins } = require('./adminAlertService');

// Pays an ELIGIBLE settlement to the seller's bank with a RazorpayX payout
// from the platform's RazorpayX account — the seller-payout rail used while
// Razorpay Route is not available (SELLER_PAYOUT_PROVIDER, see
// razorpayxService.payoutProvider).
//
// Differences from Route that shape this file:
//   - A bank payout cannot be held or clawed back. So it is only made once
//     the settlement is due (eligibleAt + sellerSettlementWindowDays), after
//     the same line checks Route uses (return/refund, payment, amount).
//   - One payout pays the whole seller batch, COD included — the money comes
//     from the RazorpayX balance, not from a particular buyer payment.
//   - The payout's outcome arrives later: RazorpayX calls
//     /webhook/razorpayx-payouts, and reconcilePayouts() polls as a fallback.
//     applyProviderStatus is the one place a RazorpayX status becomes ours.

const SYSTEM_ACTOR = { _id: null, name: 'SYSTEM_RAZORPAYX_AUTOMATION' };
const METHOD = 'RAZORPAYX_PAYOUT';

// RazorpayX payout statuses, per its payout life cycle.
const IN_FLIGHT_STATUSES = ['queued', 'pending', 'scheduled', 'processing'];
const DEAD_STATUSES = ['rejected', 'cancelled', 'failed'];

// RazorpayX will not pay less than ₹1.
const MIN_PAYOUT_PAISE = 100;

/**
 * Everything that must hold before money goes to a seller's bank. Shares
 * the per-line checks with Route (razorpaySettlementIntegration), swaps the
 * Route-account check for the RazorpayX payee one.
 */
async function checkSettlementSafeForPayout(settlement, now = new Date()) {
  const vendor = await Vendor.findById(settlement.vendor).lean();
  const readiness = payoutAccountReady(vendor, now);
  if (!readiness.ready) {
    return { ok: false, reason: 'VENDOR_PAYOUT_ACCOUNT_NOT_READY', detail: readiness.reason };
  }

  const orderIds = [...new Set(settlement.items.map((item) => String(item.order)))];
  const orders = await Order.find({ _id: { $in: orderIds } }).select('paymentStatus paymentMethod').lean();
  const ordersById = new Map(orders.map((order) => [String(order._id), order]));

  const blockingIssue = await findBlockingLineIssue(settlement, ordersById);
  if (blockingIssue) return { ok: false, reason: 'ACTIVE_RETURN_OR_REFUND', detail: blockingIssue };

  if (!amountIsConsistent(settlement)) return { ok: false, reason: 'AMOUNT_MISMATCH' };
  if (settlement.netPayablePaise < MIN_PAYOUT_PAISE) return { ok: false, reason: 'AMOUNT_BELOW_PAYOUT_MINIMUM' };

  return { ok: true, vendor };
}

async function notify(kind, payout, reason) {
  // Lazy: the controller module pulls in notification plumbing this service
  // does not otherwise need, and requiring it lazily keeps tests light.
  const { notifyVendorOfSettlement, notifyVendorOfFailure } = require('../Controllers/routeWebhookController');
  if (kind === 'PAID') return notifyVendorOfSettlement(payout);
  return notifyVendorOfFailure(payout, reason);
}

/**
 * Move our Payout to match what RazorpayX says about it. Idempotent: the
 * same status applied twice (webhook + poll, or a re-delivered webhook) is a
 * no-op the second time, because every move goes through the payout state
 * machine's status-guarded update.
 *
 * @param {string} payoutId  Our Payout _id.
 * @param {object} remote    A RazorpayX payout entity.
 */
async function applyProviderStatus(payoutId, remote) {
  const payout = await Payout.findById(payoutId).lean();
  if (!payout) return { ok: false, outcome: 'NOT_FOUND' };

  const status = String(remote?.status || '').toLowerCase();
  await Payout.updateOne(
    { _id: payout._id },
    {
      $set: {
        providerStatus: status || payout.providerStatus,
        ...(remote?.id && !payout.razorpayxPayoutId ? { razorpayxPayoutId: remote.id } : {}),
      },
    }
  );

  const reason =
    remote?.status_details?.description || remote?.failure_reason || `RazorpayX payout ${status || 'failed'}`;
  const move = (to, extra = {}) =>
    payoutService.settlePayoutStatus({ payoutId: payout._id, status: to, admin: SYSTEM_ACTOR, ...extra });

  if (IN_FLIGHT_STATUSES.includes(status)) {
    if (payout.status === 'PENDING') await move('PROCESSING', { providerReference: remote.id || '' });
    if (status === 'queued') {
      // Queued means the RazorpayX balance is short. It pays itself once
      // topped up, but someone has to top it up.
      await alertAdmins({
        event: 'RAZORPAYX_LOW_BALANCE',
        title: 'RazorpayX balance too low for a seller payout',
        message: `A ₹${(payout.amount / 100).toFixed(2)} seller payout is queued on RazorpayX for lack of balance. Add funds to the RazorpayX account and it goes out automatically.`,
        link: '/admin/accounting/payouts',
        key: `RAZORPAYX_LOW_BALANCE:${payout._id}`,
        urgent: true,
      });
    }
    return { ok: true, outcome: 'IN_FLIGHT', status };
  }

  if (status === 'processed') {
    if (payout.status === 'COMPLETED') return { ok: true, outcome: 'ALREADY_COMPLETED' };
    if (!['PENDING', 'PROCESSING'].includes(payout.status)) return { ok: true, outcome: 'STALE', current: payout.status };
    const done = await move('COMPLETED', { utr: remote.utr || remote.id, providerReference: remote.id || '' });
    if (done.ok) await notify('PAID', done.payout);
    return { ok: done.ok, outcome: 'COMPLETED', payout: done.payout };
  }

  if (status === 'reversed' && payout.status === 'COMPLETED') {
    const reversed = await move('REVERSED', { failureReason: reason });
    if (reversed.ok) {
      await notify('FAILED', reversed.payout, `bank returned the payout — ${reason}`);
    }
    return { ok: reversed.ok, outcome: 'REVERSED', payout: reversed.payout };
  }

  if (status === 'reversed' || DEAD_STATUSES.includes(status)) {
    if (!['PENDING', 'PROCESSING'].includes(payout.status)) return { ok: true, outcome: 'STALE', current: payout.status };
    const failed = await move('FAILED', { failureReason: reason });
    if (failed.ok) await notify('FAILED', failed.payout, reason);
    return { ok: failed.ok, outcome: 'FAILED', payout: failed.payout };
  }

  return { ok: true, outcome: 'IGNORED', status };
}

/**
 * Send (or re-send) one payout attempt to RazorpayX. Re-sending is safe: the
 * attempt's fixed idempotency key makes RazorpayX return the payout it
 * already made instead of making another.
 */
async function submitPayout(payoutId) {
  const payout = await Payout.findById(payoutId).lean();
  if (!payout) return { ok: false, outcome: 'NOT_FOUND' };

  let remote;
  try {
    remote = await razorpayx.createPayout({
      fundAccountId: payout.razorpayxFundAccountId,
      amountPaise: payout.amount,
      referenceId: payout.payoutId,
      narration: 'Krozenda settlement',
      notes: { payoutId: payout.payoutId, settlement: String(payout.settlement) },
      idempotencyKey: payout.providerIdempotencyKey,
    });
  } catch (err) {
    const message = razorpayx.errorText(err);
    if (razorpayx.isRetryable(err)) {
      // RazorpayX may or may not have made it. Leave the attempt PENDING;
      // reconcilePayouts re-sends it with the same key, which settles which.
      await Payout.updateOne({ _id: payout._id }, { $set: { providerStatus: 'submit_unconfirmed', notes: message.slice(0, 300) } });
      return { ok: true, outcome: 'SUBMIT_UNCONFIRMED', message };
    }
    const failed = await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'FAILED',
      failureReason: message,
      admin: SYSTEM_ACTOR,
    });
    if (failed.ok) await notify('FAILED', failed.payout, message);
    return { ok: false, outcome: 'FAILED', message };
  }

  const applied = await applyProviderStatus(payout._id, remote);
  const fresh = await Payout.findById(payout._id).lean();
  return { ok: true, outcome: 'PAYOUT_CREATED', providerStatus: remote.status, applied: applied.outcome, payout: fresh };
}

/**
 * Pay one settlement out through RazorpayX.
 *
 * @param {string} settlementId
 * @param {object} [options]
 * @param {boolean} [options.force]  An admin "pay now": skips the AUTO-mode
 *   gate and the settlement window. Every safety check still applies.
 * @returns {Promise<object>} { ok, outcome, ... } — outcome is one of
 *   'PAYOUT_CREATED' | 'SUBMIT_UNCONFIRMED' | 'ALREADY_EXISTS' | 'HELD' |
 *   'NOT_DUE' | 'SKIPPED_MANUAL_MODE' | 'NOT_CONFIGURED' | 'NOT_TRANSFERABLE' |
 *   'NOT_FOUND' | 'FAILED'.
 */
async function initiatePayoutForSettlement(settlementId, { force = false, now = new Date() } = {}) {
  const settlement = await Settlement.findById(settlementId).lean();
  if (!settlement) return { ok: false, outcome: 'NOT_FOUND', message: 'Settlement not found' };

  const live = await Payout.findOne({ settlement: settlement._id, status: { $in: LIVE_PAYOUT_STATUSES } }).lean();
  if (live) {
    return { ok: true, outcome: 'ALREADY_EXISTS', message: 'A payout for this settlement already exists', payout: live };
  }

  if (!['ELIGIBLE', 'FAILED'].includes(settlement.status)) {
    return { ok: false, outcome: 'NOT_TRANSFERABLE', message: `Settlement is ${settlement.status} — nothing to pay` };
  }

  if (!razorpayx.isConfigured()) {
    return {
      ok: false,
      outcome: 'NOT_CONFIGURED',
      message: 'RazorpayX is not configured — set RAZORPAYX_ACCOUNT_NUMBER on the server',
    };
  }

  const safety = await checkSettlementSafeForPayout(settlement, now);
  if (!safety.ok) {
    const hold = await setSettlementHold({ settlementId: settlement._id, hold: true, reason: safety.reason });
    return { ok: true, outcome: 'HELD', reason: safety.reason, detail: safety.detail, hold };
  }

  const config = await AccountingConfig.resolve();
  if (!force) {
    if (config.sellerSettlementMode !== 'AUTO') {
      return { ok: true, outcome: 'SKIPPED_MANUAL_MODE', message: 'sellerSettlementMode is MANUAL — awaiting an admin' };
    }
    const releaseAt = settlementReleaseAt(settlement, config);
    if (!releaseAt || releaseAt > now) {
      return { ok: true, outcome: 'NOT_DUE', message: 'Settlement window has not passed yet', releaseAt };
    }
  }

  const created = await payoutService.createPayout({
    settlementId: settlement._id,
    admin: SYSTEM_ACTOR,
    method: METHOD,
    notes: 'Automated RazorpayX payout',
  });
  if (!created.ok) return { ok: false, outcome: 'FAILED', message: created.message };
  if (created.duplicate) {
    return { ok: true, outcome: 'ALREADY_EXISTS', message: created.message, payout: created.payout };
  }

  await Payout.updateOne(
    { _id: created.payout._id },
    {
      $set: {
        providerIdempotencyKey: razorpayx.newIdempotencyKey(),
        razorpayxFundAccountId: safety.vendor.razorpayx.fundAccountId,
      },
    }
  );

  return submitPayout(created.payout._id);
}

const RESUBMIT_AFTER_MS = 5 * 60 * 1000;
const POLL_PROCESSING_AFTER_MS = 30 * 60 * 1000;
const WATCH_COMPLETED_FOR_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The fallback for webhooks that never arrive, and for submits whose
 * response was lost:
 *   - a PENDING attempt RazorpayX never confirmed is re-sent (same key);
 *   - an in-flight payout is re-read from RazorpayX;
 *   - a recently paid one is re-read too, since a bank can still reverse it.
 */
async function reconcilePayouts(now = new Date()) {
  const summary = { resubmitted: 0, refreshed: 0, errors: 0 };

  const unconfirmed = await Payout.find({
    method: METHOD,
    status: 'PENDING',
    razorpayxPayoutId: { $in: [null, undefined] },
    providerIdempotencyKey: { $nin: [null, ''] },
    createdAt: { $lte: new Date(now.getTime() - RESUBMIT_AFTER_MS) },
  }).select('_id').lean();
  for (const { _id } of unconfirmed) {
    const result = await submitPayout(_id);
    if (result.outcome === 'PAYOUT_CREATED') summary.resubmitted += 1;
  }

  const watched = await Payout.find({
    method: METHOD,
    razorpayxPayoutId: { $nin: [null, ''] },
    $or: [
      { status: 'PROCESSING', updatedAt: { $lte: new Date(now.getTime() - POLL_PROCESSING_AFTER_MS) } },
      { status: 'COMPLETED', processedAt: { $gte: new Date(now.getTime() - WATCH_COMPLETED_FOR_MS) } },
    ],
  }).select('_id razorpayxPayoutId').lean();
  for (const payout of watched) {
    try {
      const remote = await razorpayx.fetchPayout(payout.razorpayxPayoutId);
      await applyProviderStatus(payout._id, remote);
      summary.refreshed += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`[razorpayxSettlementIntegration] could not refresh payout ${payout.razorpayxPayoutId}:`, razorpayx.errorText(err));
    }
  }

  return summary;
}

module.exports = {
  initiatePayoutForSettlement,
  submitPayout,
  applyProviderStatus,
  reconcilePayouts,
  checkSettlementSafeForPayout,
  SYSTEM_ACTOR,
  METHOD,
};
