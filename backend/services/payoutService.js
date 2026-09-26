const mongoose = require('mongoose');
const Payout = require('../Models/Payout');
const Settlement = require('../Models/Settlement');
const Vendor = require('../Models/Vendor');
const { nextId } = require('./accountingSequence');
const { insertRows, row } = require('./accountingPosting');
const { fromPaise } = require('../utils/money');

// Paying a seller. The two things this file exists to guarantee:
//
//  1. IDEMPOTENCY (task §8, §15 Rule 4). A payout is inserted against a
//     unique `idempotencyKey` derived from (settlement, attempt). A
//     double-clicked button, a client retry after a timeout, or two admins
//     acting at once all collide on that index, and the loser is handed the
//     payout that already exists instead of creating a second one. There is
//     no read-then-write check anywhere in here, because that is exactly the
//     pattern that loses these races.
//
//  2. OWNERSHIP (task §15 Rule 10). A payout is only ever created from a
//     settlement, and its seller is read OFF that settlement — never off the
//     request body — so seller A's payout cannot be built on seller B's
//     settlement no matter what is posted.

// Never expose a full account number. "XXXX XXXX 4582".
function maskAccount(accountNumber) {
  const digits = String(accountNumber || '').replace(/\s+/g, '');
  if (digits.length < 4) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

function auditEntry({ action, from = null, to = null, admin = null, reason = '' }) {
  return {
    action,
    from,
    to,
    by: admin?._id || null,
    byName: admin?.name || '',
    reason,
    at: new Date(),
  };
}

/**
 * Create a payout for a settlement.
 *
 * @param {object} options
 * @param {string} options.settlementId
 * @param {object} [options.admin]   req.admin, for attribution.
 * @param {string} [options.method]
 * @param {string} [options.notes]
 */
async function createPayout({ settlementId, admin = null, method = 'BANK_TRANSFER', notes = '' }) {
  if (!mongoose.isValidObjectId(settlementId)) {
    return { ok: false, status: 400, message: 'Invalid settlement id' };
  }
  if (!Payout.METHODS.includes(method)) {
    return { ok: false, status: 400, message: 'Select a valid payment method' };
  }

  const settlement = await Settlement.findById(settlementId).lean();
  if (!settlement) return { ok: false, status: 404, message: 'Settlement not found' };

  if (settlement.status === 'ON_HOLD') {
    return { ok: false, status: 400, message: 'This settlement is on hold — release it before paying' };
  }
  if (Settlement.PAID_STATUSES.includes(settlement.status)) {
    return { ok: false, status: 409, message: 'This settlement has already been paid' };
  }
  if (!['ELIGIBLE', 'PENDING', 'AWAITING_APPROVAL', 'FAILED'].includes(settlement.status)) {
    return { ok: false, status: 400, message: `A settlement in ${settlement.status} cannot be paid out` };
  }

  const amount = settlement.netPayablePaise || 0;
  if (amount <= 0) {
    return { ok: false, status: 400, message: 'There is nothing payable on this settlement' };
  }

  // A previous attempt that FAILED may be retried; one that is still live may
  // not be duplicated. The attempt number rolls forward so the failed attempt
  // stays on the record rather than being overwritten (task §22 case 16).
  const attempts = await Payout.find({ settlement: settlement._id }).sort({ attempt: -1 }).lean();
  const live = attempts.find((payout) => ['PENDING', 'PROCESSING', 'RELEASED', 'COMPLETED'].includes(payout.status));
  if (live) {
    return {
      ok: true,
      duplicate: true,
      payout: live,
      message: 'A payout for this settlement already exists',
    };
  }
  const attempt = (attempts[0]?.attempt || 0) + 1;

  // Seller and bank details come from the settlement's own vendor.
  const vendor = await Vendor.findById(settlement.vendor).select('name business.businessName bank isActive').lean();
  if (!vendor) return { ok: false, status: 404, message: 'Seller not found' };

  const bank = vendor.bank || {};
  if (!bank.accountNumber || !bank.ifsc) {
    return {
      ok: false,
      status: 400,
      message: 'This seller has no bank account on file — collect their payout details before paying',
    };
  }

  const payoutId = await nextId('payout');
  const idempotencyKey = `SETTLEMENT:${settlement._id}:ATTEMPT:${attempt}`;

  let payout;
  try {
    payout = await Payout.create({
      payoutId,
      vendor: settlement.vendor,
      settlement: settlement._id,
      amount,
      method,
      // Masked at the moment of creation; the full number never lands here.
      bankAccountMasked: maskAccount(bank.accountNumber),
      bankName: bank.bankName || '',
      ifsc: bank.ifsc || '',
      accountHolderName: bank.accountHolderName || '',
      status: 'PENDING',
      attempt,
      notes: String(notes || '').trim(),
      initiatedBy: admin?._id || null,
      initiatedByName: admin?.name || '',
      idempotencyKey,
      auditHistory: [auditEntry({ action: 'PAYOUT_INITIATED', to: 'PENDING', admin })],
    });
  } catch (err) {
    if (err.code === 11000) {
      // Lost the race. Whoever won created the payout this caller wanted, so
      // hand that one back rather than reporting a failure.
      const existing = await Payout.findOne({ idempotencyKey }).lean();
      return { ok: true, duplicate: true, payout: existing, message: 'A payout for this settlement already exists' };
    }
    throw err;
  }

  await Settlement.updateOne(
    { _id: settlement._id },
    { $set: { status: 'PROCESSING', payout: payout._id, mode: method } }
  );

  return { ok: true, payout, settlement };
}

/**
 * Move a payout to a terminal state.
 *
 * COMPLETED is the point at which money has left the platform, so that is
 * where the PAYOUT debit hits the seller's ledger — never at creation, when
 * nothing has moved yet.
 */
async function settlePayoutStatus({ payoutId, status, utr = '', providerReference = '', failureReason = '', admin = null }) {
  if (!mongoose.isValidObjectId(payoutId)) {
    return { ok: false, status: 400, message: 'Invalid payout id' };
  }
  if (!Payout.STATUSES.includes(status)) {
    return { ok: false, status: 400, message: 'Select a valid payout status' };
  }

  const current = await Payout.findById(payoutId).lean();
  if (!current) return { ok: false, status: 404, message: 'Payout not found' };

  if (!Payout.canTransition(current.status, status)) {
    return {
      ok: false,
      status: 400,
      message: `A payout in ${current.status} cannot be moved to ${status}`,
    };
  }
  if (status === 'COMPLETED' && !String(utr).trim()) {
    return { ok: false, status: 400, message: 'A completed payout needs its bank reference (UTR)' };
  }
  if (status === 'FAILED' && !String(failureReason).trim()) {
    return { ok: false, status: 400, message: 'Record why the payout failed' };
  }

  // Status-guarded so two concurrent completions cannot both win and post the
  // ledger debit twice.
  const updated = await Payout.findOneAndUpdate(
    { _id: payoutId, status: current.status },
    {
      $set: {
        status,
        utr: status === 'COMPLETED' ? String(utr).trim() : current.utr,
        providerReference: String(providerReference || '').trim() || current.providerReference,
        failureReason: status === 'FAILED' ? String(failureReason).trim() : '',
        processedAt: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : current.processedAt,
      },
      $push: {
        auditHistory: auditEntry({
          action: `PAYOUT_${status}`,
          from: current.status,
          to: status,
          admin,
          reason: failureReason || '',
        }),
      },
    },
    { new: true }
  );

  if (!updated) {
    return { ok: false, status: 409, message: 'The payout changed while you were deciding — reload and try again' };
  }

  if (status === 'COMPLETED') {
    // The money actually left. Debit the seller's ledger — idempotent on the
    // payout id, so a retried completion cannot debit them twice.
    await insertRows([
      row({
        type: 'PAYOUT',
        direction: 'DEBIT',
        amountPaise: updated.amount,
        vendor: updated.vendor,
        settlement: updated.settlement,
        payout: updated._id,
        referenceType: 'PAYOUT',
        referenceId: updated._id,
        description: `Payout ${updated.payoutId} — UTR ${updated.utr}`,
        metadata: {
          payoutNumber: updated.payoutId,
          utr: updated.utr,
          method: updated.method,
          bankAccountMasked: updated.bankAccountMasked,
          attempt: updated.attempt,
        },
        eventKey: `PAYOUT:${updated._id}`,
        createdBy: admin?._id || null,
      }),
    ]);

    await Settlement.updateOne(
      { _id: updated.settlement },
      {
        $set: {
          status: 'COMPLETED',
          paidAt: new Date(),
          utr: updated.utr,
          approvedAt: new Date(),
          approvedBy: admin?._id || null,
        },
      }
    );
  }

  if (status === 'FAILED') {
    // Nothing moved, so nothing is posted. The settlement goes back to being
    // payable so a retry can pick it up (task §22 case 16).
    await Settlement.updateOne({ _id: updated.settlement }, { $set: { status: 'FAILED' } });
  }

  if (status === 'CANCELLED') {
    await Settlement.updateOne({ _id: updated.settlement }, { $set: { status: 'ELIGIBLE', payout: null } });
  }

  return { ok: true, payout: updated, before: current };
}

/**
 * Serialize a payout for the API. Bank details are already masked in the
 * document; this is where we make sure nothing else leaks out with them.
 */
function serializePayout(payout, { vendor = null, settlement = null } = {}) {
  return {
    id: String(payout._id),
    payoutId: payout.payoutId,
    sellerId: String(payout.vendor?._id || payout.vendor),
    seller: vendor ? vendor : payout.vendor?.business?.businessName || payout.vendor?.name || '',
    settlementId: settlement || payout.settlement?.settlementId || String(payout.settlement?._id || payout.settlement),
    settlementRef: String(payout.settlement?._id || payout.settlement),
    amount: payout.amount,
    amountRupees: fromPaise(payout.amount),
    method: payout.method,
    bankAccountMasked: payout.bankAccountMasked || '',
    bankName: payout.bankName || '',
    ifsc: payout.ifsc || '',
    accountHolderName: payout.accountHolderName || '',
    utr: payout.utr || null,
    providerReference: payout.providerReference || null,
    razorpayTransferId: payout.razorpayTransferId || null,
    razorpayAccountId: payout.razorpayAccountId || null,
    status: payout.status,
    failureReason: payout.failureReason || '',
    notes: payout.notes || '',
    attempt: payout.attempt,
    initiatedBy: payout.initiatedByName || '',
    createdAt: payout.createdAt,
    processedAt: payout.processedAt,
  };
}

module.exports = { createPayout, settlePayoutStatus, serializePayout, maskAccount, auditEntry };
