import mongoose from 'mongoose'

// Product review left by a buyer after delivery (frontend:
// modules/user/components/orders/RateReviewScreen.jsx). `productId` is a
// free-text identifier rather than a ref — there is no Product catalog
// collection yet (product data is still static/mocked on the frontend, see
// project context Phase 1 catalog work). `photos` stores the public
// /uploads URL returned by middlewares/upload.js's publicUrlFor(), never a
// local filesystem path or client-only blob: URL, so any user's client can
// load them directly.
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, default: '', trim: true, maxlength: 500 },
    photos: { type: [String], default: [] },
  },
  { timestamps: true },
)

reviewSchema.index({ productId: 1, createdAt: -1 })

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema)
