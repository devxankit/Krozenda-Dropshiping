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

/**
 * Initiate (or return the already-existing) Razorpay Route transfer for one
 * ELIGIBLE settlement.
 *
 * @param {string} settlementId
 * @param {object} [options]
 * @param {boolean} [options.force]  Skip the sellerSettlementMode==='AUTO'
 *   gate — for a later admin "release now" manual action. Every other safety
 *   check below still applies regardless of `force`.
 * @returns {Promise<object>} { ok, outcome, ...detail } — outcome is one of
 *   'TRANSFER_CREATED' | 'ALREADY_EXISTS' | 'HELD' | 'SKIPPED_MANUAL_MODE' | 'FAILED'.
 */
async function initiateRazorpayTransferForSettlement(settlementId, { force = false } = {}) {
  const settlement = await Settlement.findById(settlementId).lean();
  if (!settlement) {
    return { ok: false, outcome: 'NOT_FOUND', message: 'Settlement not found' };
  }

  // --- idempotency: a transfer already exists for this settlement --------
  const existingPayout = await Payout.findOne({
    settlement: settlement._id,
    method: 'RAZORPAY_ROUTE',
    razorpayTransferId: { $exists: true, $ne: null },
  }).lean();
  if (existingPayout) {
    return {
      ok: true,
      outcome: 'ALREADY_EXISTS',
      message: 'A Razorpay Route transfer already exists for this settlement — no-op',
      payout: existingPayout,
    };
  }

  // --- settlement must be in the transferable state -----------------------
  if (settlement.status !== TRANSFERABLE_STATUS) {
    return {
      ok: false,
      outcome: 'NOT_TRANSFERABLE',
      message: `Settlement is ${settlement.status}, not ${TRANSFERABLE_STATUS} — nothing to transfer`,
    };
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
  if (!force) {
    const config = await AccountingConfig.resolve();
    if (config.sellerSettlementMode !== 'AUTO') {
      return {
        ok: true,
        outcome: 'SKIPPED_MANUAL_MODE',
        message: 'sellerSettlementMode is MANUAL — awaiting an explicit admin release',
      };
    }
  }

  // --- resolve the underlying Razorpay payment(s) --------------------------
  // A Settlement's items[] each carry their own `order`, and
  // settlementService.generateSettlements batches every eligible delivered
  // line for a vendor in one call — which can span multiple orders, and
  // therefore multiple distinct captured Razorpay payments. Razorpay Route
  // transfers are created against ONE captured payment
  // (razorpay.payments.transfer(paymentId, ...)), so a settlement backed by
  // more than one distinct payment cannot be expressed as a single transfer.
  //
  // Decision: rather than silently transferring against only one of several
  // payments (wrong amount attribution) or splitting into several payouts
  // under a schema that only carries ONE razorpayTransferId per Payout
  // (backend/Models/Payout.js — a schema change is out of scope for this
  // sub-task), a genuinely multi-payment settlement is held for a human to
  // resolve rather than guessed at. Every settlement produced by the current
  // generateSettlements in a normal COD/prepaid mix will usually collapse to
  // one distinct paymentId per vendor batch in the common case (a batch
  // drawn from a short delivery window for one vendor); the multi-payment
  // case is the one this sub-task flags rather than silently mishandles.
  const distinctPaymentIds = new Set(
    orders.filter((order) => order.paymentMethod === 'RAZORPAY').map((order) => order.razorpayPaymentId).filter(Boolean)
  );

  if (distinctPaymentIds.size === 0) {
    // Every line is COD/WALLET — there is no captured Razorpay payment to
    // transfer against at all. Not a Route case; hold for a human to pay
    // this out by a non-Route method instead.
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
        'This settlement spans more than one captured Razorpay payment; automated single-transfer Route payout is not supported yet — see comments in razorpaySettlementIntegration.js',
      hold,
    };
  }

  const [razorpayPaymentId] = distinctPaymentIds;

  // --- create the Payout record (pre-transfer state) -----------------------
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
  const onHoldUntil = settlement.eligibleAt || new Date();

  // --- call out to Razorpay -------------------------------------------------
  let transfer;
  try {
    transfer = await razorpayRouteService.createHeldTransfer({
      razorpayPaymentId,
      vendorAccountId: rzp.accountId,
      amountPaise: settlement.netPayablePaise,
      onHoldUntil,
      notes: { settlementId: settlement.settlementId || String(settlement._id) },
    });
  } catch (err) {
    // Nothing moved. Mark the Payout FAILED (via the sanctioned state
    // machine) so the settlement rolls back to a retryable state — see
    // payoutService.settlePayoutStatus's FAILED branch, which sets the
    // Settlement back to FAILED rather than any PAID/terminal status, ready
    // for a future retry job to pick up. Never swallowed: re-thrown below.
    await payoutService.settlePayoutStatus({
      payoutId: payout._id,
      status: 'FAILED',
      failureReason: err?.error?.description || err.message || 'Razorpay transfer creation failed',
      admin: SYSTEM_ACTOR,
    });
    return {
      ok: false,
      outcome: 'FAILED',
      message: err?.error?.description || err.message || 'Razorpay transfer creation failed',
      payoutId: payout._id,
      error: err,
    };
  }

  // --- success: record the transfer and move the Payout to PROCESSING ------
  await Payout.updateOne(
    { _id: payout._id },
    { $set: { razorpayTransferId: transfer.id, razorpayAccountId: rzp.accountId } }
  );
  const settled = await payoutService.settlePayoutStatus({
    payoutId: payout._id,
    status: 'PROCESSING',
    providerReference: transfer.id,
    admin: SYSTEM_ACTOR,
  });

  return {
    ok: true,
    outcome: 'TRANSFER_CREATED',
    payout: settled.ok ? settled.payout : payout,
    transferId: transfer.id,
    razorpayPaymentId,
    amountPaise: settlement.netPayablePaise,
    onHoldUntil,
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
  TRANSFERABLE_STATUS,
  SYSTEM_ACTOR,
};
