const Review = require('../Models/Review');
const Product = require('../Models/Product');

// Product type is derived, not stored — see Product.vendor / Product.fulfillmentProvider.
function productType(product) {
  if (!product) return 'admin';
  if (product.fulfillmentProvider === 'CJ') return 'dropship';
  if (product.vendor) return 'vendor';
  return 'admin';
}

function serializeReview(review) {
  const product = review.product;
  return {
    id: review._id.toString(),
    productId: product?._id ? product._id.toString() : '',
    product: product?.name || 'Deleted product',
    sku: product?.sku || '',
    productType: productType(product),
    buyer: review.user?.name || 'Krozenda Customer',
    rating: review.rating,
    title: review.reviewText ? review.reviewText.slice(0, 60) : '',
    body: review.reviewText || '',
    submittedAt: review.createdAt ? review.createdAt.toISOString().slice(0, 10) : '',
    verifiedPurchase: true, // reviews always require a delivered order (see Review.order, required)
    status: 'published', // no moderation workflow exists on Review yet
    flagged: false,
  };
}

// GET /admin/marketing/reviews
async function listReviews(req, res) {
  const { tab = 'all', page = 1, rowsPerPage = 25, search = '', rating } = req.query;

  const filter = {};
  if (rating) filter.rating = Number(rating);

  if (search) {
    const matchingProducts = await Product.find({ name: { $regex: search, $options: 'i' } }).select('_id');
    filter.product = { $in: matchingProducts.map((p) => p._id) };
  }

  const allReviews = await Review.find(filter)
    .populate('user', 'name')
    .populate('product', 'name sku vendor fulfillmentProvider')
    .sort({ createdAt: -1 });

  const allSerialized = allReviews.map(serializeReview);

  const tabCounts = {
    all: allSerialized.length,
    admin: allSerialized.filter((r) => r.productType === 'admin').length,
    vendor: allSerialized.filter((r) => r.productType === 'vendor').length,
    dropship: allSerialized.filter((r) => r.productType === 'dropship').length,
  };

  const filtered = tab === 'all' ? allSerialized : allSerialized.filter((r) => r.productType === tab);

  const pageNum = Math.max(1, Number(page) || 1);
  const limit = Math.max(1, Number(rowsPerPage) || 25);
  const items = filtered.slice((pageNum - 1) * limit, pageNum * limit);

  res.json({
    success: true,
    data: {
      items,
      page: pageNum,
      rowsPerPage: limit,
      totalItems: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      tabCounts,
    },
  });
}

module.exports = { listReviews };
