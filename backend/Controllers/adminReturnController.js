const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Product = require('../Models/Product');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');
const { createNotification } = require('./notificationController');
const { getImageUrl } = require('../utils/imageHelper');
const { toPaise } = require('../utils/money');

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
    raisedAt: r.createdAt,
    evidenceCount: (r.photos || []).length,
    status: RETURN_STATUS_OUT(r),
    value: toPaise(r.refundAmount || 0),
    rejectionReason: r.adminNote || '',
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
  else if (effectiveTab === 'resolved') items = items.filter((r) => r.status === 'refunded' || r.status === 'replacement_issued');
  else if (effectiveTab === 'rejected') items = items.filter((r) => r.status === 'rejected');

  const tabCounts = {
    all: allSerialized.length,
    awaiting_review: allSerialized.filter((r) => r.status === 'awaiting_review').length,
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
  res.json({
    success: true,
    data: {
      ...base,
      buyerNote: r.reason,
      evidence: (r.photos || []).map((p, idx) => ({ id: `${idx}`, caption: `Photo ${idx + 1}`, uploadedAt: r.createdAt })).map((e) => ({ ...e, url: getImageUrl(r.photos[Number(e.id)]) })),
      item: { name: r.productName, sku: r.product?.sku || '', quantity: 1, unitPrice: toPaise(r.product?.price || r.refundAmount || 0) },
      policy: { windowDays: 7, raisedWithinWindow: true, allowedReason: true, returnShippingBearer: 'platform' },
      timeline: [
        { label: 'Requested', at: r.createdAt, actor: r.user?.name || 'Buyer', reason: r.reason, done: true, tone: 'default' },
        {
          label: r.status === 'PENDING' ? 'Awaiting review' : r.status === 'APPROVED' ? 'Approved' : 'Rejected',
          at: r.resolvedAt,
          actor: r.resolvedAt ? 'Admin' : null,
          reason: r.adminNote || null,
          done: r.status !== 'PENDING',
          tone: r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'default',
        },
      ],
    },
  });
}

async function decideReturnRequest(req, res) {
  const { id } = req.params;
  const { decision, reason, adminNote } = req.body;
  const note = reason || adminNote;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid request id' });
  }
  const normalizedDecision = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedDecision)) {
    return res.status(400).json({ success: false, message: 'Decision must be APPROVED or REJECTED' });
  }

  const request = await ReturnRequest.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: normalizedDecision, adminNote: note || '', resolvedAt: new Date() } },
    { new: true }
  )
    .populate('user', 'name')
    .populate({ path: 'product', select: 'vendor', populate: { path: 'vendor', select: 'name business.businessName' } });
  if (!request) {
    const exists = await ReturnRequest.exists({ _id: id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? 'This request has already been decided' : 'Return request not found',
    });
  }

  if (normalizedDecision === 'APPROVED' && request.requestType === 'REFUND') {
    const user = await User.findByIdAndUpdate(request.user._id, { $inc: { walletBalance: request.refundAmount } }, { new: true });
    await WalletTransaction.create({
      user: request.user._id,
      type: 'CREDIT',
      amount: request.refundAmount,
      balanceAfter: user.walletBalance,
      source: 'ORDER_REFUND',
      orderId: request.order,
      status: 'SUCCESS',
    });
  }

  await createNotification({
    userId: request.user._id,
    type: 'ORDER',
    title: normalizedDecision === 'APPROVED' ? 'Return Request Approved' : 'Return Request Rejected',
    message:
      normalizedDecision === 'APPROVED'
        ? request.requestType === 'REFUND'
          ? `Your refund of ₹${request.refundAmount.toLocaleString('en-IN')} for ${request.productName} has been credited to your Wallet.`
          : `Your replacement request for ${request.productName} has been approved.`
        : `Your return request for ${request.productName} was rejected.${note ? ` Reason: ${note}` : ''}`,
    actionType: normalizedDecision === 'APPROVED' && request.requestType === 'REFUND' ? 'WALLET' : 'ORDER',
    actionRefId: normalizedDecision === 'APPROVED' && request.requestType === 'REFUND' ? null : request.order,
  });

  res.json({ success: true, message: `Request ${normalizedDecision.toLowerCase()}`, data: serializeListItem(request) });
}

module.exports = { listReturnRequests, getReturnDetail, decideReturnRequest };
