const Payout = require('../Models/Payout');
const { verifyRazorpaySignature } = require('../utils/razorpayWebhookVerify');
const { applyProviderStatus, METHOD } = require('../services/razorpayxSettlementIntegration');

// POST /webhook/razorpayx-payouts — RazorpayX's payout events
// (payout.queued / pending / processed / reversed / failed / rejected /
// updated ...). Configured in the RazorpayX dashboard, separately from the
// payment-gateway webhooks, with its own secret: RAZORPAYX_WEBHOOK_SECRET
// (falls back to RAZORPAY_WEBHOOK_SECRET if the same secret was reused).
//
// Every event is handled the same way — read the payout entity, find our
// Payout, and hand the entity's status to applyProviderStatus, which is
// idempotent — so a re-delivered or out-of-order event cannot move a payout
// wrongly. settlementAutomationJob's reconcile step polls as the fallback
// for events that never arrive.

function log(entry) {
  console.log(JSON.stringify({ scope: 'RAZORPAYX_PAYOUTS', at: new Date().toISOString(), ...entry }));
}

async function handleRazorpayxWebhook(req, res) {
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    log({ event: 'WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('x-razorpay-signature') || '';
  if (!verifyRazorpaySignature(req.rawBody, signature, secret)) {
    log({ event: 'WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const eventType = req.body?.event || '';
  const entity = req.body?.payload?.payout?.entity || null;

  if (!eventType.startsWith('payout.') || !entity?.id) {
    log({ event: 'WEBHOOK_IGNORED', type: eventType });
    return res.status(200).json({ success: true, message: 'Ignored' });
  }

  try {
    // By RazorpayX id; else by our payoutId, which is sent as reference_id —
    // the event can beat our own create call's response back.
    const payout =
      (await Payout.findOne({ razorpayxPayoutId: entity.id }).select('_id').lean()) ||
      (entity.reference_id
        ? await Payout.findOne({ payoutId: entity.reference_id, method: METHOD }).select('_id').lean()
        : null);

    if (!payout) {
      log({ event: 'WEBHOOK_UNRECONCILED', type: eventType, razorpayxPayoutId: entity.id });
      return res.status(200).json({ success: true, message: 'No matching payout' });
    }

    const result = await applyProviderStatus(payout._id, entity);
    log({ event: 'WEBHOOK_APPLIED', type: eventType, payoutId: String(payout._id), outcome: result.outcome });
    return res.status(200).json({ success: true, message: 'Processed' });
  } catch (err) {
    // 500 so RazorpayX retries.
    log({ event: 'WEBHOOK_ERROR', type: eventType, message: err.message });
    return res.status(500).json({ success: false, message: 'Processing failed' });
  }
}

module.exports = { handleRazorpayxWebhook };
