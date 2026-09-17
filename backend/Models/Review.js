const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, default: '', trim: true, maxlength: 500 },
    photos: { type: [String], default: [] },
    // Seller's public reply to this review, shown under it — set once via
    // vendorReviewController, never editable by the reviewing buyer.
    vendorReply: {
      type: { message: { type: String, default: '', trim: true, maxlength: 500 }, repliedAt: { type: Date, default: null } },
      default: () => ({ message: '', repliedAt: null }),
      _id: false,
    },
  },
  { timestamps: true }
);

// One review per user per product — reviewing again edits the existing one
// in place (see reviewController.upsertReview), matching how most storefronts
// behave rather than allowing a pile of duplicate reviews per re-purchase.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
