const { call } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');
const CjDispute = require('../../Models/CjDispute');
const CjOrder = require('../../Models/CjOrder');

// Phase 7 — Returns & Disputes, CJ's half only.
//
// THE SEPARATION THIS FILE EXISTS TO ENFORCE (master plan §22): a customer
// refund (Krozenda -> Razorpay -> customer) and a CJ recovery (CJ -> dispute
// -> Krozenda) are NEVER the same transaction and are not assumed to be the
// same amount. This service only ever touches CjDispute/CjOrder; it must
// never call into refundService or touch Razorpay. Reconciling the two
// belongs to the accounting layer (master plan §23), not here.
//
// Same field-name caveat as cjOrderService/cjLogisticsService: verify
// against a live CJ sandbox before production use.

const CREATE_PATH = '/v1/disputes/create';
const CANCEL_PATH = '/v1/disputes/cancel';
const DETAIL_PATH = '/v1/disputes/detail';

function authenticatedCall(request) {
  return cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() => call({ ...request, accessToken }))
  );
}

// CJ restricts disputes on orders it did not itself create via a
// non-API/manual channel — master plan §21's "specific restriction for
// API-created orders" note. Since every order this codebase creates goes
// through cjOrderService.createOrder, that restriction should not bite in
// practice, but a REJECTED response citing it is surfaced as-is rather than
// retried, since retrying an ineligibility error never helps.
async function createDispute({
  cjOrderId,
  reason,
  description = '',
  evidenceImages = [],
  requestedRecoveryAmount = 0,
  returnRequest = null,
  createdBy = null,
}) {
  const cjOrder = await CjOrder.findOne({ cjOrderId });
  if (!cjOrder) throw new Error('CJ order not found');

  const dispute = await CjDispute.create({
    cjOrder: cjOrder._id,
    cjOrderId,
    returnRequest,
    reason,
    description,
    evidenceImages,
    requestedRecoveryAmount,
    createdBy,
  });

  try {
    const { body } = await authenticatedCall({
      method: 'POST',
      path: CREATE_PATH,
      idempotent: false,
      body: {
        orderId: cjOrderId,
        disputeReason: reason,
        disputeDescription: description,
        images: evidenceImages,
      },
    });

    dispute.cjDisputeId = body?.data?.disputeId || null;
    dispute.status = 'UNDER_REVIEW';
    await dispute.save();
    return dispute;
  } catch (err) {
    dispute.status = 'REJECTED';
    dispute.lastError = err.message;
    await dispute.save();
    throw err;
  }
}

async function cancelDispute(disputeId) {
  const dispute = await CjDispute.findById(disputeId);
  if (!dispute) throw new Error('Dispute not found');
  if (!dispute.cjDisputeId) throw new Error('Dispute was never confirmed with CJ — nothing to cancel there');

  await authenticatedCall({
    method: 'POST',
    path: CANCEL_PATH,
    idempotent: false,
    body: { disputeId: dispute.cjDisputeId },
  });

  dispute.status = 'CANCELLED';
  await dispute.save();
  return dispute;
}

async function refreshDisputeStatus(disputeId) {
  const dispute = await CjDispute.findById(disputeId);
  if (!dispute?.cjDisputeId) throw new Error('Dispute has no cjDisputeId yet');

  const { body } = await authenticatedCall({
    method: 'GET',
    path: DETAIL_PATH,
    query: { disputeId: dispute.cjDisputeId },
    idempotent: true,
  });

  const data = body?.data;
  if (data?.status) {
    const statusMap = { REVIEWING: 'UNDER_REVIEW', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };
    dispute.status = statusMap[data.status] || dispute.status;
  }
  if (typeof data?.approvedAmount === 'number') dispute.approvedRecoveryAmount = data.approvedAmount;
  if (data?.resolution) dispute.resolution = data.resolution;
  await dispute.save();

  return dispute;
}

module.exports = { createDispute, cancelDispute, refreshDisputeStatus };
