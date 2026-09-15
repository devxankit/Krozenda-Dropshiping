const ReturnRequest = require('../Models/ReturnRequest');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

// Read-only for the seller: approve/reject stays admin-owned (it moves
// wallet money on REFUND — see adminReturnController.decideReturnRequest),
// but a seller can see what's been requested against their own products.
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

module.exports = { listMyReturns };
