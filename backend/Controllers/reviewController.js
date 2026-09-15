const mongoose = require('mongoose');
const Review = require('../Models/Review');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

function serializeReview(review, { productName, author }) {
  return {
    id: review._id.toString(),
    productId: review.product.toString(),
    productName,
    rating: review.rating,
    reviewText: review.reviewText || '',
    photos: (review.photos || []).map(getImageUrl),
    author,
    createdAt: review.createdAt,
  };
}

// GET /user/reviews/reviewable — every product from this user's DELIVERED
// orders, deduped by product (most recent delivery wins), each flagged with
// whether they've already reviewed it and the product's live review count —
// this is what powers the dropdown on the Orders > Review screen.
async function getReviewableItems(req, res) {
  const orders = await Order.find({ user: req.user._id, status: 'DELIVERED' }).sort({ deliveredAt: -1 });

  const byProduct = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product.toString();
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          orderId: order._id.toString(),
          productId: key,
          name: item.name,
          image: item.image,
          price: item.price,
          deliveredAt: order.deliveredAt,
        });
      }
    }
  }

  const productIds = [...byProduct.keys()];
  const [reviews, products] = await Promise.all([
    Review.find({ user: req.user._id, product: { $in: productIds } }),
    Product.find({ _id: { $in: productIds } }).select('reviewsCount rating'),
  ]);

  const reviewByProduct = new Map(reviews.map((r) => [r.product.toString(), r]));
  const productMeta = new Map(products.map((p) => [p._id.toString(), p]));

  const items = [...byProduct.values()].map((entry) => {
    const myReview = reviewByProduct.get(entry.productId);
    const meta = productMeta.get(entry.productId);
    return {
      ...entry,
      reviewsCount: meta?.reviewsCount || 0,
      rating: meta?.rating || 0,
      alreadyReviewed: Boolean(myReview),
      myReview: myReview
        ? { rating: myReview.rating, reviewText: myReview.reviewText, photos: (myReview.photos || []).map(getImageUrl) }
        : null,
    };
  });

  res.json({ success: true, data: { items } });
}

// POST /user/reviews — one review per (user, product); submitting again for
// the same product edits it in place. Only allowed when the product was
// genuinely delivered to this user on the given order — never trust the
// client's say-so on eligibility.
async function upsertReview(req, res) {
  const { productId, orderId, rating, reviewText } = req.body;

  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid product or order id' });
  }

  const ratingNum = Number(rating);
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id, status: 'DELIVERED' });
  if (!order) {
    return res.status(403).json({ success: false, message: 'You can only review products from delivered orders' });
  }

  const orderItem = order.items.find((item) => item.product.toString() === productId);
  if (!orderItem) {
    return res.status(403).json({ success: false, message: 'This product was not part of that order' });
  }

  const photoUrls = (req.files || []).map((file) => file.url);

  // photos only ever appears in one of $set/$setOnInsert — never both — so
  // there's no risk of MongoDB's "conflict at 'photos'" update error.
  const update = photoUrls.length > 0
    ? { $set: { order: orderId, rating: ratingNum, reviewText: reviewText || '', photos: photoUrls } }
    : {
        $set: { order: orderId, rating: ratingNum, reviewText: reviewText || '' },
        $setOnInsert: { photos: [] },
      };

  const review = await Review.findOneAndUpdate(
    { user: req.user._id, product: productId },
    update,
    { upsert: true, new: true }
  );

  const stats = await Review.aggregate([
    { $match: { product: review.product } },
    { $group: { _id: '$product', count: { $sum: 1 }, avgRating: { $avg: '$rating' } } },
  ]);
  const { count = 1, avgRating = ratingNum } = stats[0] || {};

  await Product.updateOne(
    { _id: productId },
    { $set: { reviewsCount: count, rating: Math.round(avgRating * 10) / 10 } }
  );

  res.json({
    success: true,
    message: 'Review submitted',
    data: serializeReview(review, { productName: orderItem.name, author: req.user.name || 'You' }),
  });
}

// GET /user/reviews?productId= — public: anyone viewing a product detail
// page should be able to read its reviews, logged in or not. (Previously
// sat behind protectUser along with the rest of this router, which meant a
// guest's product page couldn't load its Reviews tab at all — caught via a
// live browser walkthrough: it 401'd exactly here.)
async function listProductReviews(req, res) {
  const { productId } = req.query;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const [product, reviews] = await Promise.all([
    Product.findById(productId).select('name'),
    Review.find({ product: productId }).populate('user', 'name').sort({ createdAt: -1 }),
  ]);

  const items = reviews.map((review) =>
    serializeReview(review, {
      productName: product?.name || '',
      author: review.user?.name || 'Krozenda Customer',
    })
  );

  res.json({ success: true, data: items });
}

module.exports = { getReviewableItems, upsertReview, listProductReviews };
