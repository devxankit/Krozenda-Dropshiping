const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const Order = require('../Models/Order');
const ReturnRequest = require('../Models/ReturnRequest');
const Rto = require('../Models/Rto');
const AccountingConfig = require('../Models/AccountingConfig');
const razorpayRouteService = require('./razorpayRouteService');
const payoutService = require('./payoutService');
const { setSettlementHold } = require('./settlementService');

// Bridges an ELIGIBLE Settlement (produced by settlementService.generateSettlements)
// to an actual Razorpay Route transfer. Kept out of settlementService.js on
// purpose: that file's whole job is being THE single settlement generator/
// ledger reader, and mixing a payment-gateway integration into it would blur
// that boundary. This file only ever READS settlements/orders it did not
// create and calls out to razorpayRouteService/payoutService — it never
// computes commission or touches the ledger itself.
//
// A "system" actor for payoutService.createPayout/settlePayoutStatus: both
// functions treat `admin` as fully optional (`admin?._id || null`,
// `admin?.name || ''`), so no schema or service change was needed to call
// them from an automated path — we just pass a plain object with a `name`
// and no `_id`, which shows up in the Payout's auditHistory as byName with
// by:null, clearly distinguishable from a human admin's ObjectId.
const SYSTEM_ACTOR = { _id: null, name: 'SYSTEM_RAZORPAY_ROUTE_AUTOMATION' };

// The Settlement status that means "batched, not on hold, not yet paid" —
// see backend/Models/Settlement.js: ELIGIBLE is the accounting module's name
// for what the legacy Finance screens call AWAITING_APPROVAL/PENDING.
const TRANSFERABLE_STATUS = 'ELIGIBLE';
// FAILED is a retry: its previous transfer must be confirmed dead first
// (isTransferDead), which initiateRazorpayTransferForSettlement checks.
const TRANSFERABLE_STATUSES = [TRANSFERABLE_STATUS, 'FAILED'];

// ReturnRequest.STATUSES = ['PENDING', 'APPROVED', 'REJECTED']. Only REJECTED
// is a dead end for the buyer's claim; PENDING and APPROVED both mean the
// line's money is still in question and must not go out to the seller yet.
const ACTIVE_RETURN_STATUSES = ['PENDING', 'APPROVED'];

/**
 * True if any order line in this settlement has a live return/refund claim
 * or an unreversed RTO against it, or if its underlying order is not PAID.
 * Returns the first blocking reason found, or null if every line is clear.
 */
async function findBlockingLineIssue(settlement, ordersById) {
  for (const item of settlement.items) {
    const order = ordersById.get(String(item.order));
    if (!order) {
      return `Order ${item.order} referenced by this settlement no longer exists`;
    }
    if (order.paymentStatus !== 'PAID') {
      return `Order ${order._id} backing this settlement is ${order.paymentStatus}, not PAID`;
    }
  }

  const orderIds = [...ordersById.keys()];
  const productIds = [...new Set(settlement.items.map((item) => String(item.product)))];

  const [activeReturn, activeRto] = await Promise.all([
    ReturnRequest.exists({
      order: { $in: orderIds },
      product: { $in: productIds },
      status: { $in: ACTIVE_RETURN_STATUSES },
    }),
    Rto.exists({
      order: { $in: orderIds },
      product: { $in: productIds },
      settlementReversed: false,
    }),
  ]);

  if (activeReturn) return 'An active return/refund request exists against a line in this settlement';
  if (activeRto) return 'An unreversed RTO exists against a line in this settlement';
  return null;
}

/**
 * Recompute the settlement's stored net payable from its own stored paise
 * components, and compare against what it claims netPayablePaise is. This
 * NEVER recomputes commission from scratch (that stays commissionResolver's
 * job, already baked into the Settlement by settlementService) — it only
 * checks the Settlement's own arithmetic is internally consistent, per the
 * requirement that a seller payout amount is never trusted blindly.
 */
function amountIsConsistent(settlement) {
  const { grossPaise = 0, commissionPaise = 0, feesPaise = 0, refundsPaise = 0, adjustmentsPaise = 0, netPayablePaise = 0 } = settlement;

  if (!Number.isInteger(netPayablePaise) || netPayablePaise <= 0) return false;

  const expected = grossPaise - commissionPaise - feesPaise - refundsPaise + adjustmentsPaise;
  // adjustmentsPaise's sign convention isn't pinned down elsewhere in the
  // codebase (settlementService always writes 0 for it today), so accept
  // either sign here rather than guess — but still require the figure to
  // land within a small rounding tolerance of one of the two readings.
  const expectedAltSign = grossPaise - commissionPaise - feesPaise - refundsPaise - adjustmentsPaise;
  const tolerancePaise = 1; // integer paise — allow only for prior rounding, not real drift
  return (
    Math.abs(netPayablePaise - expected) <= tolerancePaise ||
    Math.abs(netPayablePaise - expectedAltSign) <= tolerancePaise
  );
}

/**
 * Shared "is this settlement still clean" check — the SAME safety checks used
 * before creating a transfer are re-run, unchanged, before releasing one
 * (backend/Jobs/settlementReleaseJob.js). Factored out here so there is one
 * source of truth rather than two copies that can drift.
 *
 * Deliberately does NOT create a transfer, does NOT set a hold, and does NOT
 * touch the Payout/Settlement — it only answers the question. The caller
 * decides what to do with the answer (hold it, reverse an existing transfer,
 * etc).
 *
 * @param {string} settlementId
 * @returns {Promise<object>} On failure: { ok: false, reason, detail? }.
 *   On success: { ok: true, settlement, vendor, orders, ordersById }.
 */
async function checkSettlementSafeForTransfer(settlementId) {
  const settlement = await Settlement.findById(settlementId).lean();
  if (!settlement) {
    return { ok: false, reason: 'NOT_FOUND', detail: 'Settlement not found' };
  }

  // --- vendor Razorpay Route eligibility -----------------------------------
  const vendor = await Vendor.findById(settlement.vendor).select('razorpay').lean();
  const rzp = vendor?.razorpay || {};
  if (!vendor || !rzp.isSettlementEligible || rzp.onboardingStatus !== 'ACTIVE' || !rzp.accountId) {
    return { ok: false, reason: 'VENDOR_RAZORPAY_NOT_ACTIVE', settlement, vendor };
  }

  // --- per-line return/refund/RTO + payment-status checks ------------------
  const orderIds = [...new Set(settlement.items.map((item) => String(item.order)))];
  const orders = await Order.find({ _id: { $in: orderIds } })
    .select('paymentStatus razorpayPaymentId paymentMethod')
    .lean();
  const ordersById = new Map(orders.map((order) => [String(order._id), order]));

  const blockingIssue = await findBlockingLineIssue(settlement, ordersById);
  if (blockingIssue) {
    return { ok: false, reason: 'ACTIVE_RETURN_OR_REFUND', detail: blockingIssue, settlement, vendor };
  }

  // --- hard amount sanity check --------------------------------------------
  if (!amountIsConsistent(settlement)) {
    return { ok: false, reason: 'AMOUNT_MISMATCH', settlement, vendor };
  }

  return { ok: true, settlement, vendor, orders, ordersById };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a settlement's money may actually go to the seller: its eligibleAt
 * plus AccountingConfig.sellerSettlementWindowDays — the extra buffer after
 * batching in which a problem can still be caught while the transfer is
 * held. The release job and direct-mode transfers both gate on this.
 */
function settlementReleaseAt(settlement, config) {
  if (!settlement?.eligibleAt) return null;
  const windowDays = Number(config?.sellerSettlementWindowDays) || 0;
  return new Date(new Date(settlement.eligibleAt).getTime() + windowDays * DAY_MS);
}

// Payout statuses that mean a transfer is (or may still be) in flight or
// done. Any of these on a settlement makes a new transfer a duplicate.
const LIVE_PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'RELEASED', 'COMPLETED'];

/**
 * True only when Razorpay confirms a transfer can no longer pay anything
 * out: it failed, or it has been reversed in full. A payout that never got a
 * transfer id never moved money either. Anything else — including not being
 * able to ask Razorpay — is treated as possibly live, because creating a
 * second transfer next to a live one pays the seller twice.
 */
async function isTransferDead(payout) {
  if (!payout?.razorpayTransferId) return true;
  try {
    const transfer = await razorpayRouteService.fetchTransfer(payout.razorpayTransferId);
    if (['failed', 'reversed'].includes(transfer?.status)) return true;
    return Number(transfer?.amount_reversed || 0) >= Number(transfer?.amount || payout.amount);
  } catch (err) {
    console.error(
      `[razorpaySettlementIntegration] could not fetch transfer ${payout.razorpayTransferId}:`,
      razorpayRouteService.errorText(err)
    );
    return false;
  }
}

/**
 * Initiate (or return the already-existing) Razorpay Route transfer for one
 * ELIGIBLE settlement — or a FAILED one being retried, once its previous
 * transfer is confirmed dead.
 *
 * `payment` mode (default): a transfer on the batch's one captured payment,
 * on hold with no expiry — only this codebase's release step (after its
 * safety re-check) ever lifts it. `direct` mode: a transfer from the
 * platform balance, which cannot be held, so it is only made once the
 * settlement is due and goes straight to RELEASED.
 *
 * @param {string} settlementId
 * @param {object} [options]
 * @param {boolean} [options.force]  Skip the sellerSettlementMode==='AUTO'
 *   gate and, in direct mode, the "is it due yet" gate — for an admin
 *   "release now" action. Every other safety check below still applies.
 * @returns {Promise<object>} { ok, outcome, ...detail } — outcome is one of
 *   'TRANSFER_CREATED' | 'ALREADY_EXISTS' | 'HELD' | 'SKIPPED_MANUAL_MODE' |
 *   'NOT_DUE' | 'PREVIOUS_TRANSFER_LIVE' | 'NOT_TRANSFERABLE' | 'NOT_FOUND' | 'FAILED'.
 */
async function initiateRazorpayTransferForSettlement(settlementId, { force = false } = {}) {
  const settlement = await Settlement.findById(settlementId).lean();
  if (!settlement) {
    return { ok: false, outcome: 'NOT_FOUND', message: 'Settlement not found' };
  }

  // --- idempotency: a live transfer already exists for this settlement ----
  const existingPayout = await Payout.findOne({
    settlement: settlement._id,
    method: 'RAZORPAY_ROUTE',
    status: { $in: LIVE_PAYOUT_STATUSES },
  }).lean();
  if (existingPayout) {
    return {
      ok: true,
      outcome: 'ALREADY_EXISTS',
      message: 'A Razorpay Route transfer already exists for this settlement — no-op',
      payout: existingPayout,
    };
  }

  // --- settlement must be in a transferable state -------------------------
  if (!TRANSFERABLE_STATUSES.includes(settlement.status)) {
    return {
      ok: false,
      outcome: 'NOT_TRANSFERABLE',
      message: `Settlement is ${settlement.status}, not ${TRANSFERABLE_STATUSES.join('/')} — nothing to transfer`,
    };
  }

  // --- a retry must never sit next to a transfer that can still pay ------
  if (settlement.status === 'FAILED') {
    const lastAttempt = await Payout.findOne({ settlement: settlement._id, method: 'RAZORPAY_ROUTE' })
      .sort({ attempt: -1 })
      .lean();
    if (lastAttempt && !(await isTransferDead(lastAttempt))) {
      return {
        ok: false,
        outcome: 'PREVIOUS_TRANSFER_LIVE',
        message: `The previous transfer ${lastAttempt.razorpayTransferId} is not confirmed failed or fully reversed on Razorpay — reconcile it before retrying`,
        payout: lastAttempt,
      };
    }
  }

  // --- vendor eligibility / per-line issues / amount sanity — one source of
  // truth, shared with the release job (checkSettlementSafeForTransfer) -----
  const safety = await checkSettlementSafeForTransfer(settlement._id);
  if (!safety.ok) {
    if (safety.reason === 'NOT_FOUND') {
      return { ok: false, outcome: 'NOT_FOUND', message: 'Settlement not found' };
    }
    const hold = await setSettlementHold({
      settlementId: settlement._id,
      hold: true,
      reason: safety.reason,
    });
    return { ok: true, outcome: 'HELD', reason: safety.reason, detail: safety.detail, hold };
  }
  const { vendor, orders } = safety;
  const rzp = vendor.razorpay || {};

  // --- AUTO vs MANUAL settlement mode gate ---------------------------------
  const config = await AccountingConfig.resolve();
  if (!force && config.sellerSettlementMode !== 'AUTO') {
    return {
      ok: true,
      outcome: 'SKIPPED_MANUAL_MODE',
      message: 'sellerSettlementMode is MANUAL — awaiting an explicit admin release',
    };
  }

  const mode = razorpayRouteService.transferMode();
  const notes = { settlementId: settlement.settlementId || String(settlement._id) };

  if (mode === 'direct') {
    // Nothing to hold a direct transfer with, so the settlement window is
    // enforced here, before any money moves.
    const releaseAt = settlementReleaseAt(settlement, config);
    if (!force && (!releaseAt || releaseAt > new Date())) {
      return { ok: true, outcome: 'NOT_DUE', message: 'Settlement window has not passed yet', releaseAt };
    }
    return createTransfer({
      settlement,
      rzp,
      callRazorpay: () =>
        razorpayRouteService.createDirectTransfer({
          vendorAccountId: rzp.accountId,
          amountPaise: settlement.netPayablePaise,
          notes,
        }),
      releaseImmediately: true,
    });
  }

  // --- resolve the underlying Razorpay payment -----------------------------
  // A Route transfer is made against ONE captured payment
  // (razorpay.payments.transfer(paymentId, ...)). generateSettlements
  // batches per payment in this mode, so a new batch always resolves to one;
  // a batch spanning several payments (made before the split, or in direct
  // mode and switched back) is held, and the automation job cancels it so
  // its lines are re-batched per payment.
  const distinctPaymentIds = new Set(
    orders.filter((order) => order.paymentMethod === 'RAZORPAY').map((order) => order.razorpayPaymentId).filter(Boolean)
  );

  if (distinctPaymentIds.size === 0) {
    // Every line is COD/WALLET — there is no captured Razorpay payment to
    // transfer against at all. Paid by direct transfer (direct mode) or by
    // hand (bank transfer + UTR) instead.
    const hold = await setSettlementHold({
      settlementId: settlement._id,
      hold: true,
      reason: 'NO_RAZORPAY_PAYMENT_TO_TRANSFER_AGAINST',
    });
    return { ok: true, outcome: 'HELD', reason: 'NO_RAZORPAY_PAYMENT_TO_TRANSFER_AGAINST', hold };
  }

  if (distinctPaymentIds.size > 1) {
    const hold = await setSettlementHold({
      settlementId: settlement._id,
      hold: true,
      reason: 'MULTI_ORDER_SETTLEMENT_UNSUPPORTED',
    });
    return {
      ok: true,
      outcome: 'HELD',
      reason: 'MULTI_ORDER_SETTLEMENT_UNSUPPORTED',
      message:
        'This settlement spans more than one captured Razorpay payment; the automation job will cancel and re-batch it per payment',
      hold,
    };
  }

  const [razorpayPaymentId] = distinctPaymentIds;

  const result = await createTransfer({
    settlement,
    rzp,
    // No on_hold_until: an expiry would let Razorpay release the money on
    // its own clock, skipping the safety re-check in releaseSinglePayout.
    callRazorpay: () =>
      razorpayRouteService.createHeldTransfer({
        razorpayPaymentId,
        vendorAccountId: rzp.accountId,
        amountPaise: settlement.netPayablePaise,
        notes,
      }),
    releaseImmediately: false,
  });
  return result.outcome === 'TRANSFER_CREATED' ? { ...result, razorpayPaymentId } : result;
}

/**
 * Payout record -> Razorpay call -> record the transfer. Shared by both
 * transfer modes; `releaseImmediately` is for a direct transfer, which is
 * never held and so goes PROCESSING -> RELEASED at once.
 */
async function createTransfer({ settlement, rzp, callRazorpay, releaseImmediately }) {
  const created = await payoutService.createPayout({
    settlementId: settlement._id,
    admin: SYSTEM_ACTOR,
    method: 'RAZORPAY_ROUTE',
    notes: 'Automated Razorpay Route transfer',
  });
  if (!created.ok) {
    return { ok: false, outcome: 'FAILED', message: created.message };
  }
  if (created.duplicate) {
    // Another attempt (human or a concurrent run) beat us to it. Nothing to
    // do — the caller can inspect `payout` for its current state.
    return { ok: true, outcome: 'ALREADY_EXISTS', message: created.message, payout: created.payout };
  }

  const payout = created.payout;

  let transfer;
  try {
    transfer = await callRazorpay();
  } catch (err) {
    // Nothing moved. Mark the Payout FAILED (via the sanctioned state
    // machine) so the settlement rolls back to a retryable state — see
    // payoutService.settlePayoutStatus's FAILED branch.
    const message = razorpayRouteService.errorText(err) || 'Razorpay transfer creation failed';
    await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'FAILED',
      failureReason: message,
      admin: SYSTEM_ACTOR,
    });
    return { ok: false, outcome: 'FAILED', message, payoutId: payout._id, error: err };
  }

  // --- success: record the transfer and move the Payout on -----------------
  await Payout.updateOne(
    { _id: payout._id },
    { $set: { razorpayTransferId: transfer.id, razorpayAccountId: rzp.accountId } }
  );
  let settled = await payoutService.settlePayoutStatus({
    payoutId: payout._id,
    status: 'PROCESSING',
    providerReference: transfer.id,
    admin: SYSTEM_ACTOR,
  });
  if (releaseImmediately && settled.ok) {
    settled = await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'RELEASED',
      admin: SYSTEM_ACTOR,
    });
  }

  return {
    ok: true,
    outcome: 'TRANSFER_CREATED',
    payout: settled.ok ? settled.payout : payout,
    transferId: transfer.id,
    amountPaise: settlement.netPayablePaise,
  };
}

/**
 * Given one Payout doc (status PROCESSING, method RAZORPAY_ROUTE, populated
 * with its `settlement`), run the exact safety-checked release sequence:
 * re-check checkSettlementSafeForTransfer, atomically claim
 * PROCESSING -> RELEASED (so two callers — the cron tick and this admin
 * action — cannot both release the same transfer), then ask Razorpay to lift
 * the hold.
 *
 * Extracted out of Jobs/settlementReleaseJob.js (sub-task 7/11) so the cron
 * loop and the new admin "release now" endpoint share ONE implementation
 * instead of two copies that can drift. Does NOT check `settlement.eligibleAt`
 * — that "is it due yet" gate is specific to the cron's own polling loop, not
 * to what "release" itself means, so the cron checks eligibleAt itself before
 * calling this, while an explicit admin release intentionally bypasses it.
 *
 * @param {object} payout  A Payout mongoose/lean doc with `settlement`
 *   populated (and, ideally, `settlement.vendor` populated too, though this
 *   function does not read that field itself).
 * @returns {Promise<object>} One of:
 *   { ok: true, outcome: 'RELEASED', payout }
 *   { ok: true, outcome: 'NOT_DUE' }               (should not normally occur — caller's job to gate on eligibleAt if it matters)
 *   { ok: false, outcome: 'DISQUALIFIED', reason, detail, payout }
 *   { ok: false, outcome: 'CLAIM_LOST', message }
 *   { ok: false, outcome: 'RELEASE_FAILED', message, payout }
 *   { ok: false, outcome: 'NO_SETTLEMENT' }
 */
async function releaseSinglePayout(payout) {
  const settlement = payout.settlement;
  if (!settlement) {
    return { ok: false, outcome: 'NO_SETTLEMENT', message: 'Payout has no linked settlement' };
  }

  // Re-run the same safety checks used before creating the transfer — one
  // shared source of truth.
  const safety = await checkSettlementSafeForTransfer(settlement._id);
  if (!safety.ok) {
    try {
      await razorpayRouteService.reverseTransfer(payout.razorpayTransferId, payout.amount);
    } catch (err) {
      console.error(
        `[razorpaySettlementIntegration] reverseTransfer failed for payout ${payout._id} (transfer ${payout.razorpayTransferId}):`,
        err?.error?.description || err.message || err
      );
      // Fall through and still fail the Payout — the reversal can be retried
      // by an admin; leaving the Payout stuck in PROCESSING forever is worse.
    }

    const failureReason = `DISQUALIFIED_BEFORE_RELEASE: ${safety.reason}${safety.detail ? ` — ${safety.detail}` : ''}`;
    const failed = await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'FAILED',
      failureReason,
      admin: SYSTEM_ACTOR,
    });
    return { ok: false, outcome: 'DISQUALIFIED', reason: safety.reason, detail: safety.detail, payout: failed.ok ? failed.payout : payout };
  }

  // --- atomic claim: PROCESSING -> RELEASED --------------------------------
  const claimed = await payoutService.settlePayoutStatus({
    payoutId: payout._id,
    status: 'RELEASED',
    admin: SYSTEM_ACTOR,
  });
  if (!claimed.ok) {
    return { ok: false, outcome: 'CLAIM_LOST', message: claimed.message };
  }

  try {
    await razorpayRouteService.releaseTransfer(payout.razorpayTransferId);
    return { ok: true, outcome: 'RELEASED', payout: claimed.payout };
  } catch (err) {
    // The claim succeeded but the actual Razorpay call failed — nothing was
    // released. Roll back to FAILED (retry-eligible) rather than leaving the
    // payout stuck RELEASED with no transfer actually released.
    const failureReason = err?.error?.description || err.message || 'Razorpay releaseTransfer failed';
    const failed = await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'FAILED',
      failureReason,
      admin: SYSTEM_ACTOR,
    });
    return { ok: false, outcome: 'RELEASE_FAILED', message: failureReason, payout: failed.ok ? failed.payout : payout };
  }
}

module.exports = {
  initiateRazorpayTransferForSettlement,
  checkSettlementSafeForTransfer,
  releaseSinglePayout,
  settlementReleaseAt,
  isTransferDead,
  TRANSFERABLE_STATUS,
  TRANSFERABLE_STATUSES,
  LIVE_PAYOUT_STATUSES,
  SYSTEM_ACTOR,
};
