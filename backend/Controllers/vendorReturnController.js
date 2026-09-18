const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

// The seller can see every request raised against their own products and
// record a RECOMMENDATION on it, but the decision itself stays admin-owned:
// approving a REFUND credits the buyer's wallet (see
// adminReturnController.decideReturnRequest), and a seller must not be the
// judge of a claim against their own product.
function serializeReturn(r) {
  return {
    id: r._id.toString(),
    orderId: r.order.toString(),
    productId: r.product.toString(),
    productName: r.productName,
    productImage: r.productImage ? getImageUrl(r.productImage) : null,
    customer: { name: r.user?.name || '', mobileNumber: r.user?.mobileNumber || '' },
    requestType: r.requestType,
    reason: r.reason,
    photos: (r.photos || []).map(getImageUrl),
    status: r.status,
    adminNote: r.adminNote || '',
    sellerRecommendation: r.sellerRecommendation
      ? {
          decision: r.sellerRecommendation.decision,
          note: r.sellerRecommendation.note || '',
          at: r.sellerRecommendation.at,
        }
      : null,
    refundAmount: r.refundAmount,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  };
}

async function listMyReturns(req, res) {
  const { tab } = req.query;
  const products = await Product.find({ vendor: req.vendor._id }).select('_id');
  const productIds = products.map((p) => p._id);

  const requests = await ReturnRequest.find({ product: { $in: productIds } })
    .populate('user', 'name mobileNumber')
    .sort({ createdAt: -1 });

  const allSerialized = requests.map(serializeReturn);
  let items = allSerialized;
  const effectiveStatus = tab && tab !== 'all' ? tab.toUpperCase() : null;
  if (effectiveStatus) items = items.filter((r) => r.status === effectiveStatus);

  const tabCounts = { all: allSerialized.length };
  for (const s of ReturnRequest.STATUSES) tabCounts[s.toLowerCase()] = allSerialized.filter((r) => r.status === s).length;

  res.json({ success: true, data: { items, page: 1, rowsPerPage: items.length || 1, totalItems: items.length, totalPages: 1, tabCounts } });
}

// POST /vendor/returns/:id/recommend
//
// Advisory input on a return raised against one of THIS seller's products.
// Three things this deliberately does not do: it does not change `status`, it
// does not touch `refundAmount`, and it does not shortcut admin review. It
// only records what the seller thinks and why.
async function recommendOnReturn(req, res) {
  const { id } = req.params;
  const { decision, note } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid return id' });
  }
  if (!ReturnRequest.SELLER_RECOMMENDATIONS.includes(decision)) {
    return res.status(400).json({ success: false, message: 'Recommendation must be APPROVE or REJECT' });
  }

  const request = await ReturnRequest.findById(id).populate('user', 'name mobileNumber');
  if (!request) {
    return res.status(404).json({ success: false, message: 'Return request not found' });
  }

  // Ownership is checked against the PRODUCT, the same way listMyReturns scopes
  // its query — a seller may only speak to returns on their own catalog.
  const product = await Product.findOne({ _id: request.product, vendor: req.vendor._id }).select('_id');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Return request not found' });
  }

  // Once admin has decided, the seller's opinion is history, not input.
  if (request.status !== 'PENDING') {
    return res.status(409).json({
      success: false,
      message: `This request has already been ${request.status.toLowerCase()} — a recommendation can no longer be added.`,
    });
  }

  request.sellerRecommendation = {
    decision,
    note: typeof note === 'string' ? note.trim().slice(0, 1000) : '',
    vendor: req.vendor._id,
    at: new Date(),
  };
  await request.save();

  // No notification is raised here on purpose. The Notification model belongs
  // to exactly one of a buyer or a vendor (see its pre-validate guard) — there
  // is no admin channel — so an "admin, a seller responded" notification would
  // throw on write and be swallowed. Admin sees the recommendation on the
  // request itself in the returns queue, which is where they are deciding.

  res.json({
    success: true,
    message: 'Recommendation recorded. An admin makes the final decision.',
    data: serializeReturn(request),
  });
}

module.exports = { listMyReturns, recommendOnReturn };
