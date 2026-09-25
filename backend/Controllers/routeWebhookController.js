const Payout = require('../Models/Payout');
const { verifyRazorpaySignature } = require('../utils/razorpayWebhookVerify');
const payoutService = require('../services/payoutService');
const { createNotification } = require('./notificationController');
const { notifyVendorSettlementPaid } = require('../services/vendorAlertService');
const { alertAdmins } = require('../services/adminAlertService');
const { fromPaise } = require('../utils/money');

// POST /webhook/route-transfers — Razorpay Route's own event feed, separate
// from /webhook/payments per webhookRoutes.js's rule that a second provider
// (or a second EVENT FAMILY that needs different handling) gets its own
// sub-path rather than being guessed at from a shared endpoint.
//
// This is the confirmation leg of the flow started by
// razorpaySettlementIntegration.initiateRazorpayTransferForSettlement
// (creates a held transfer -> Payout PROCESSING) and continued by
// Jobs/settlementReleaseJob.js (lifts the hold -> Payout RELEASED). Neither
// of those actually knows the money moved — only Razorpay does, and it says
// so here.
//
// ASSUMPTION (not fully verifiable from the docs page fetched for this
// sub-task): Route webhooks are signed with the SAME account-level
// RAZORPAY_WEBHOOK_SECRET as payment webhooks. Razorpay's dashboard has one
// webhook secret per configured webhook URL, and typically a merchant
// subscribes both payment and Route events on one webhook config — but if
// this account has a SEPARATE webhook URL/secret configured specifically for
// Route events, this will need its own env var. Re-verify against the actual
// dashboard configuration before relying on this in production.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'ROUTE_TRANSFERS', at: new Date().toISOString(), ...entry }));
}

async function handleRouteWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    log({ event: 'ROUTE_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('x-razorpay-signature') || '';
  if (!verifyRazorpaySignature(req.rawBody, signature, secret)) {
    log({ event: 'ROUTE_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const eventType = req.body?.event || '';
  const transferEntity = req.body?.payload?.transfer?.entity || null;
  const settlementEntity = req.body?.payload?.settlement?.entity || null;

  log({ event: 'ROUTE_WEBHOOK_RECEIVED', type: eventType });

  try {
    if (eventType === 'transfer.processed' && transferEntity) {
      await handleTransferProcessed(transferEntity);
    } else if (eventType === 'transfer.failed' && transferEntity) {
      await handleTransferFailed(transferEntity);
    } else if (eventType === 'settlement.processed' && settlementEntity) {
      // Reconciliation/logging only — see the sub-task notes: this event
      // confirms Razorpay's own bank settlement of an already-processed
      // transfer, which is a fact about Razorpay's books, not evidence this
      // codebase needs to act on beyond an audit trail. No amount or bank
      // detail is logged, only ids.
      log({
        event: 'ROUTE_SETTLEMENT_PROCESSED',
        razorpaySettlementId: settlementEntity.id || null,
      });
    } else {
      log({ event: 'ROUTE_WEBHOOK_IGNORED', type: eventType });
    }

    return res.status(200).json({ success: true, message: 'Processed' });
  } catch (err) {
    // 500 so Razorpay retries — same rationale as paymentWebhookController.
    log({ event: 'ROUTE_WEBHOOK_ERROR', type: eventType, message: err.message });
    return res.status(500).json({ success: false, message: 'Processing failed' });
  }
}

async function handleTransferProcessed(transferEntity) {
  const transferId = transferEntity.id;
  const payout = await Payout.findOne({ razorpayTransferId: transferId });

  if (!payout) {
    // Never make Razorpay retry forever on a webhook that can't be resolved.
    log({
      event: 'ROUTE_WEBHOOK_UNRECONCILED_TRANSFER',
      razorpayTransferId: transferId,
      reason: 'transfer.processed has no matching Payout — needs manual reconciliation',
    });
    return;
  }

  if (payout.status === 'COMPLETED') {
    log({ event: 'ROUTE_WEBHOOK_DUPLICATE', payoutId: String(payout._id), status: payout.status });
    return;
  }

  if (!['RELEASED', 'PROCESSING'].includes(payout.status)) {
    // Already FAILED/CANCELLED — a late-arriving webhook for a payout this
    // codebase has since moved on from. Don't fight the state machine.
    log({
      event: 'ROUTE_WEBHOOK_STALE_TRANSITION',
      payoutId: String(payout._id),
      currentStatus: payout.status,
      attemptedStatus: 'COMPLETED',
    });
    return;
  }

  // Sanity-log only — never overwrite our own stored amount from the webhook.
  if (Number.isInteger(transferEntity.amount) && transferEntity.amount !== payout.amount) {
    log({
      event: 'ROUTE_WEBHOOK_AMOUNT_MISMATCH',
      payoutId: String(payout._id),
      storedAmountPaise: payout.amount,
      webhookAmountPaise: transferEntity.amount,
    });
  }

  const settled = await payoutService.settlePayoutStatus({
    payoutId: payout._id,
    status: 'COMPLETED',
    utr: transferId,
    providerReference: transferId,
  });

  if (!settled.ok) {
    // A lost race (another process already transitioned it) is not an error
    // worth retrying over — log and move on.
    log({ event: 'ROUTE_WEBHOOK_COMPLETE_FAILED', payoutId: String(payout._id), message: settled.message });
    return;
  }

  // settlePayoutStatus's COMPLETED branch already moves the linked Settlement
  // to status 'COMPLETED' (a Settlement.PAID_STATUS) and sets paidAt — no
  // further Settlement write is needed here.

  log({ event: 'ROUTE_TRANSFER_CONFIRMED', payoutId: String(payout._id), razorpayTransferId: transferId });

  await notifyVendorOfSettlement(settled.payout);
}

async function handleTransferFailed(transferEntity) {
  const transferId = transferEntity.id;
  const payout = await Payout.findOne({ razorpayTransferId: transferId });

  if (!payout) {
    log({
      event: 'ROUTE_WEBHOOK_UNRECONCILED_TRANSFER',
      razorpayTransferId: transferId,
      reason: 'transfer.failed has no matching Payout — needs manual reconciliation',
    });
    return;
  }

  if (['FAILED', 'COMPLETED'].includes(payout.status)) {
    log({ event: 'ROUTE_WEBHOOK_DUPLICATE', payoutId: String(payout._id), status: payout.status });
    return;
  }

  const failureReason =
    transferEntity.error?.description || transferEntity.error?.reason || 'Razorpay reported transfer.failed';

  const settled = await payoutService.settlePayoutStatus({
    payoutId: payout._id,
    status: 'FAILED',
    failureReason,
  });

  if (!settled.ok) {
    log({ event: 'ROUTE_WEBHOOK_FAIL_TRANSITION_FAILED', payoutId: String(payout._id), message: settled.message });
    return;
  }

  log({ event: 'ROUTE_TRANSFER_FAILED', payoutId: String(payout._id), razorpayTransferId: transferId, failureReason });

  await notifyVendorOfFailure(settled.payout, failureReason);
}

async function notifyVendorOfSettlement(payout) {
  try {
    const amountRupees = fromPaise(payout.amount).toFixed(2);
    await createNotification({
      vendorId: payout.vendor,
      type: 'WALLET',
      title: 'Settlement processed',
      message: `Your settlement of ₹${amountRupees} has been processed and transferred to your bank account.`,
      actionType: 'WALLET',
      actionRefId: payout.settlement,
    });
    await notifyVendorSettlementPaid({
      vendorId: payout.vendor,
      amount: Number(amountRupees),
      reference: payout.razorpayTransferId ? `Ref ${payout.razorpayTransferId}` : '',
      key: payout.settlement ? `SETTLEMENT:${payout.settlement}` : `PAYOUT:${payout._id}`,
    });
  } catch (err) {
    // Best-effort — createNotification already swallows its own errors, but
    // guard here too since this runs inside a webhook handler that must 200.
    log({ event: 'ROUTE_WEBHOOK_NOTIFY_FAILED', payoutId: String(payout._id), message: err.message });
  }
}

async function notifyVendorOfFailure(payout, failureReason) {
  try {
    const amountRupees = fromPaise(payout.amount).toFixed(2);
    await createNotification({
      vendorId: payout.vendor,
      type: 'WALLET',
      title: 'Settlement failed',
      message: `Your settlement of ₹${amountRupees} could not be transferred. Our team has been notified.`,
      actionType: 'WALLET',
      actionRefId: payout.settlement,
    });
    // The seller was just told "our team has been notified" — make it true.
    await alertAdmins({
      event: 'SETTLEMENT_FAILED',
      title: 'Seller settlement failed',
      message: `A ₹${amountRupees} Razorpay Route transfer to a seller failed${failureReason ? `: ${failureReason}` : ''}. Check the seller's bank details and retry.`,
      link: '/admin/finance/settlements',
      key: `SETTLEMENT_FAILED:${payout._id}:${payout.razorpayTransferId || ''}`,
      urgent: true,
    });
  } catch (err) {
    log({ event: 'ROUTE_WEBHOOK_NOTIFY_FAILED', payoutId: String(payout._id), message: err.message });
  }
}

module.exports = { handleRouteWebhook };
