const CjDispute = require('../Models/CjDispute');
const cjDisputeService = require('../services/cj/cjDisputeService');

// GET /admin/cj/disputes?status=&pageNum=&pageSize=
async function listDisputes(req, res) {
  const { status } = req.query;
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
  const filter = status ? { status } : {};

  const [rows, total] = await Promise.all([
    CjDispute.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate('cjOrder', 'cjOrderId status')
      .populate('returnRequest'),
    CjDispute.countDocuments(filter),
  ]);

  res.json({ success: true, data: { list: rows, pageNum, pageSize, total } });
}

// GET /admin/cj/disputes/:id
async function getDispute(req, res) {
  const dispute = await CjDispute.findById(req.params.id).populate('cjOrder').populate('returnRequest');
  if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });
  res.json({ success: true, data: dispute });
}

// POST /admin/cj/disputes
// body: { cjOrderId, reason, description?, evidenceImages?, requestedRecoveryAmount?, returnRequestId? }
async function createDispute(req, res) {
  const { cjOrderId, reason, description, evidenceImages, requestedRecoveryAmount, returnRequestId } = req.body || {};

  if (!cjOrderId || !reason) {
    return res.status(400).json({ success: false, message: 'cjOrderId and reason are required' });
  }

  try {
    const dispute = await cjDisputeService.createDispute({
      cjOrderId,
      reason,
      description,
      evidenceImages: Array.isArray(evidenceImages) ? evidenceImages : [],
      requestedRecoveryAmount: Number(requestedRecoveryAmount) || 0,
      returnRequest: returnRequestId || null,
      createdBy: req.admin?._id || null,
    });
    res.status(201).json({ success: true, message: 'Dispute created', data: dispute });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/cj/disputes/:id/cancel
async function cancelDispute(req, res) {
  try {
    const dispute = await cjDisputeService.cancelDispute(req.params.id);
    res.json({ success: true, message: 'Dispute cancelled', data: dispute });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/cj/disputes/:id/refresh-status
async function refreshStatus(req, res) {
  try {
    const dispute = await cjDisputeService.refreshDisputeStatus(req.params.id);
    res.json({ success: true, message: 'Status refreshed', data: dispute });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { listDisputes, getDispute, createDispute, cancelDispute, refreshStatus };
