const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const { createNotification } = require('./notificationController');
const { getImageUrl } = require('../utils/imageHelper');
const { toPaise } = require('../utils/money');
const returnService = require('../services/returnService');
const Shipment = require('../Models/Shipment');

// Only these three buyer-facing reasons exist on this platform's return
// form; anything else gets bucketed to the closest one so the Fulfilment
// screen's reason enum (damaged/wrong_product/missing_product) never 400s.
function mapReason(reason) {
  const text = (reason || '').toLowerCase();
  if (text.includes('wrong')) return 'wrong_product';
  if (text.includes('missing')) return 'missing_product';
  return 'damaged';
}

const RETURN_STATUS_OUT = (r) => {
  if (r.status === 'PENDING') return 'awaiting_review';
  if (r.status === 'REJECTED') return 'rejected';
  // Approved, waiting for the item to come back.
  if (r.status === 'ACCEPTED') return 'approved';
  return r.requestType === 'REFUND' ? 'refunded' : 'replacement_issued';
};

function paged(items, { page = 1, rowsPerPage = 25 } = {}, tabCounts) {
  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: currentPage, rowsPerPage: perPage, totalItems, totalPages, tabCounts };
}

function serializeListItem(r) {
  return {
    id: r._id.toString(),
    subOrderId: `${r.order.toString().slice(-8).toUpperCase()}`,
    buyer: r.user?.name || '',
    seller: r.product?.vendor ? r.product.vendor.business?.businessName || r.product.vendor.name : 'Krozenda (platform)',
    reason: mapReason(r.reason),
    // What the buyer asked for; admin approves or rejects exactly that.
    requestType: r.requestType,
    raisedAt: r.createdAt,
    evidenceCount: (r.photos || []).length,
    status: RETURN_STATUS_OUT(r),
    value: toPaise(r.refundAmount || 0),
    rejectionReason: r.adminNote || '',
    // Advisory input from the seller who owns the product. Surfaced in the
    // list as well as the detail so a queue can be triaged on it — a seller
    // flagging "not my SKU" is the cheapest signal admin gets.
    sellerRecommendation: r.sellerRecommendation
      ? {
          decision: r.sellerRecommendation.decision,
          note: r.sellerRecommendation.note || '',
          at: r.sellerRecommendation.at,
        }
      : null,
  };
}

// Admin surface — list (with tab/search paging) and detail, feeding
// Fulfilment > Returns & RTO. Approve/reject reuses the same money-moving
// logic the buyer-facing return flow already relies on (credit wallet on an
// approved REFUND; no money moves on REPLACEMENT or REJECTED).
async function listReturnRequests(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const requests = await ReturnRequest.find()
    .populate('user', 'name')
    .populate({ path: 'product', select: 'vendor', populate: { path: 'vendor', select: 'name business.businessName' } })
    .sort({ createdAt: -1 })
    .lean();

  const allSerialized = requests.map(serializeListItem);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) items = items.filter((r) => r.subOrderId.toLowerCase().includes(term) || r.buyer.toLowerCase().includes(term) || r.seller.toLowerCase().includes(term));

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'awaiting_review') items = items.filter((r) => r.status === 'awaiting_review');
  else if (effectiveTab === 'in_progress') items = items.filter((r) => r.status === 'approved');
  else if (effectiveTab === 'resolved') items = items.filter((r) => r.status === 'refunded' || r.status === 'replacement_issued');
  else if (effectiveTab === 'rejected') items = items.filter((r) => r.status === 'rejected');

  const tabCounts = {
    all: allSerialized.length,
    awaiting_review: allSerialized.filter((r) => r.status === 'awaiting_review').length,
    in_progress: allSerialized.filter((r) => r.status === 'approved').length,
    resolved: allSerialized.filter((r) => r.status === 'refunded' || r.status === 'replacement_issued').length,
    rejected: allSerialized.filter((r) => r.status === 'rejected').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function getReturnDetail(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid return id' });
  }

  const r = await ReturnRequest.findById(id)
    .populate('user', 'name')
    .populate({ path: 'product', select: 'vendor sku price', populate: { path: 'vendor', select: 'name business.businessName' } });
  if (!r) {
    return res.status(404).json({ success: false, message: 'Return request not found' });
  }

  const base = serializeListItem(r);
  const [order, pickup] = await Promise.all([
    Order.findById(r.order).select('paymentMethod razorpayPaymentId items.product items.variantId items.quantity').lean(),
    r.returnShipment
      ? Shipment.findById(r.returnShipment).select('internalStatus awbCode courierName').lean()
      : null,
  ]);
  const line = order?.items?.find(
    (item) => String(item.product) === String(r.product?._id || r.product) && String(item.variantId || '') === String(r.variantId || '')
  ) || order?.items?.find((item) => String(item.product) === String(r.product?._id || r.product));
  const refundsToCard = order?.paymentMethod === 'RAZORPAY' && Boolean(order?.razorpayPaymentId);

  const step = (label, at, { reason = null, tone = 'success', actor = 'Admin' } = {}) => ({
    label,
    at: at || null,
    actor: at ? actor : null,
    reason,
    done: Boolean(at),
    tone: at ? tone : 'default',
  });

  const timeline = [
    { label: 'Requested', at: r.createdAt, actor: r.user?.name || 'Buyer', reason: r.reason, done: true, tone: 'default' },
    ...(r.sellerRecommendation
      ? [
          {
            label: `Seller recommended ${r.sellerRecommendation.decision === 'APPROVE' ? 'approving' : 'rejecting'}`,
            at: r.sellerRecommendation.at,
            actor: base.seller,
            reason: r.sellerRecommendation.note || null,
            done: true,
            tone: r.sellerRecommendation.decision === 'APPROVE' ? 'success' : 'warning',
          },
        ]
      : []),
  ];
  if (r.status === 'REJECTED') {
    if (r.acceptedAt) timeline.push(step('Approved', r.acceptedAt));
    timeline.push(step('Rejected', r.resolvedAt, { reason: r.adminNote || null, tone: 'danger' }));
  } else {
    timeline.push(step(r.status === 'PENDING' ? 'Awaiting review' : 'Approved', r.acceptedAt, { reason: r.adminNote || null }));
    if (r.pickupMode !== 'NOT_REQUIRED') {
      timeline.push(
        step(
          r.pickupMode === 'COURIER' ? `Pickup booked${pickup?.awbCode ? ` · AWB ${pickup.awbCode}` : ''}` : 'Collect the item',
          r.pickupMode === 'COURIER' ? r.acceptedAt : null,
          { actor: pickup?.courierName || 'Courier' }
        )
      );
      timeline.push(step('Item received', r.itemReceivedAt));
    }
    timeline.push(
      step(
        r.requestType === 'REFUND'
          ? `Refunded to ${r.refundDestination === 'RAZORPAY' ? 'original payment' : 'wallet'}`
          : 'Replacement order created',
        r.completedAt
      )
    );
  }

  res.json({
    success: true,
    data: {
      ...base,
      buyerNote: r.reason,
      evidence: (r.photos || []).map((photo, idx) => ({
        id: `${idx}`,
        caption: `Photo ${idx + 1}`,
        uploadedAt: r.createdAt,
        url: getImageUrl(photo),
      })),
      item: {
        name: r.productName,
        sku: r.product?.sku || '',
        quantity: line?.quantity || 1,
        unitPrice: toPaise((r.refundAmount || 0) / (line?.quantity || 1)),
      },
      policy: { windowDays: 7, raisedWithinWindow: true, allowedReason: true, returnShippingBearer: 'platform' },
      // Where the request is after approval — drives which buttons show.
      progress: {
        stage: r.status === 'ACCEPTED' ? (r.itemReceivedAt || r.pickupMode === 'NOT_REQUIRED' ? 'ready_to_complete' : 'awaiting_item') : base.status,
        pickupMode: r.pickupMode || null,
        pickupStatus: pickup?.internalStatus || null,
        pickupAwb: pickup?.awbCode || null,
        pickupCourier: pickup?.courierName || null,
        pickupError: r.pickupError || null,
        itemReceivedAt: r.itemReceivedAt || null,
        restocked: Boolean(r.restocked),
        completedAt: r.completedAt || null,
        refundDestination: r.refundDestination || (r.requestType === 'REFUND' ? (refundsToCard ? 'RAZORPAY' : 'WALLET') : null),
        razorpayRefundId: r.razorpayRefundId || null,
        replacementOrderId: r.replacementOrder ? String(r.replacementOrder) : null,
        orderId: String(r.order),
      },
      timeline,
    },
  });
}

// One response shape for every write below: the updated list row.
async function respondWithRow(res, requestId, message) {
  const row = await ReturnRequest.findById(requestId)
    .populate('user', 'name')
    .populate({ path: 'product', select: 'vendor', populate: { path: 'vendor', select: 'name business.businessName' } });
  return res.json({ success: true, message, data: serializeListItem(row) });
}

function sendFailure(res, result) {
  // 409 from the service means "already decided" — the screen treats it as a
  // plain refusal.
  return res.status(result.status === 409 ? 400 : result.status || 400).json({ success: false, message: result.message });
}

// POST /admin/returns/:id/decide  { decision, reason, requireItemBack, restock }
// APPROVED accepts the return (books the pickup; no money yet). REJECTED
// needs a reason, which the buyer sees.
async function decideReturnRequest(req, res) {
  const { id } = req.params;
  const { decision, reason, adminNote, requireItemBack, restock } = req.body;
  const note = String(reason || adminNote || '').trim();
  const normalizedDecision = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedDecision)) {
    return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
  }

  const result =
    normalizedDecision === 'APPROVED'
      ? await returnService.acceptReturn({
          requestId: id,
          admin: req.admin,
          note,
          requireItemBack: requireItemBack !== false && requireItemBack !== 'false',
          restock: restock === true || restock === 'true',
        })
      : await returnService.rejectReturn({ requestId: id, admin: req.admin, reason: note });
  if (!result.ok) return sendFailure(res, result);
  return respondWithRow(res, id, `Request ${normalizedDecision === 'APPROVED' ? 'approved' : 'rejected'}`);
}

// POST /admin/returns/:id/received — the item is back (collected by hand, or
// the courier scan was missed).
async function markReturnReceived(req, res) {
  const result = await returnService.markItemReceived({ requestId: req.params.id });
  if (!result.ok) return sendFailure(res, result);
  return respondWithRow(res, req.params.id, 'Item marked received');
}

// POST /admin/returns/:id/complete  { restock }
async function completeReturnRequest(req, res) {
  const { restock } = req.body;
  const result = await returnService.completeReturn({
    requestId: req.params.id,
    admin: req.admin,
    restock: restock === true || restock === 'true',
  });
  if (!result.ok) return sendFailure(res, result);
  return respondWithRow(res, req.params.id, 'Return completed');
}

module.exports = { listReturnRequests, getReturnDetail, decideReturnRequest, markReturnReceived, completeReturnRequest };
