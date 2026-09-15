const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // No `default: null` here on purpose — the sparse unique index below
    // only skips documents where the field is genuinely absent, not ones
    // explicitly set to null. A default of null meant every second product
    // created without a SKU threw an uncaught E11000 duplicate-key error.
    sku: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
    // null = platform-owned catalog item (current default for everything
    // created via the admin panel). Set once a product is attributed to a
    // marketplace seller, so order items and support tickets can be routed
    // to the right vendor instead of always falling back to Admin.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    // Vendor-created products enter the marketplace catalog PENDING until an
    // admin approves them — admin-created products (vendor: null) skip this
    // by defaulting straight to APPROVED, matching pre-marketplace behavior.
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    rejectionReason: { type: String, default: '', trim: true },
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
