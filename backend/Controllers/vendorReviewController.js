const mongoose = require('mongoose');
const Review = require('../Models/Review');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

function serializeReview(review) {
  return {
    id: review._id.toString(),
    productId: review.product?._id ? review.product._id.toString() : review.product?.toString(),
    productName: review.product?.name || '',
    productImage: review.product?.images?.[0] ? getImageUrl(review.product.images[0]) : null,
    author: review.user?.name || 'Krozenda Customer',
    rating: review.rating,
    reviewText: review.reviewText || '',
    photos: (review.photos || []).map(getImageUrl),
    vendorReply: review.vendorReply?.message
      ? { message: review.vendorReply.message, repliedAt: review.vendorReply.repliedAt }
      : null,
    createdAt: review.createdAt,
  };
}

async function listMyReviews(req, res) {
  const { tab } = req.query;
  const products = await Product.find({ vendor: req.vendor._id }).select('_id');
  const productIds = products.map((p) => p._id);

  const reviews = await Review.find({ product: { $in: productIds } })
    .populate('user', 'name')
    .populate('product', 'name images')
    .sort({ createdAt: -1 });

  const allSerialized = reviews.map(serializeReview);
  let items = allSerialized;
  if (tab === 'replied') items = items.filter((r) => r.vendorReply);
  else if (tab === 'unreplied') items = items.filter((r) => !r.vendorReply);

  const tabCounts = {
    all: allSerialized.length,
    replied: allSerialized.filter((r) => r.vendorReply).length,
    unreplied: allSerialized.filter((r) => !r.vendorReply).length,
  };

  res.json({ success: true, data: { items, page: 1, rowsPerPage: items.length || 1, totalItems: items.length, totalPages: 1, tabCounts } });
}

async function replyToReview(req, res) {
  const { id } = req.params;
  const { message } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid review id' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Reply message is required' });
  }

  const review = await Review.findById(id).populate('product', 'vendor name images').populate('user', 'name');
  if (!review || !review.product || String(review.product.vendor) !== String(req.vendor._id)) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  review.vendorReply = { message: message.trim(), repliedAt: new Date() };
  await review.save();

  res.json({ success: true, message: 'Reply posted', data: serializeReview(review) });
}

module.exports = { listMyReviews, replyToReview };
