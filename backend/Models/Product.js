const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    weight: { type: Number, default: null, min: 0 },
    images: { type: [String], default: [] },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    isFlashsale: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    // 0 means "no reviews yet" — the storefront hides the rating badge
    // rather than showing a fabricated score for a brand new product.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ category: 1 });
productSchema.index({ isFlashsale: 1 });
productSchema.index({ isTrending: 1 });

module.exports = mongoose.model('Product', productSchema);
