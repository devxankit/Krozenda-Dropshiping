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
    // Shipping weight in KILOGRAMS. Nullable, and stays nullable: Decision B
    // makes dimensions optional and falls back to a vendor default, then a
    // platform default, then the seller's own "Verify Package" measurement.
    weight: { type: Number, default: null, min: 0 },
    // Shipping dimensions in CENTIMETRES. All three or none — a partial set
    // cannot produce a volumetric weight, so utils/packaging treats it as
    // absent (see hasDimensions).
    dimensions: {
      type: new mongoose.Schema(
        {
          lengthCm: { type: Number, default: null, min: 0 },
          breadthCm: { type: Number, default: null, min: 0 },
          heightCm: { type: Number, default: null, min: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
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

productSchema.index({ sku: 1 }, { unique: true, sparse: true });

// Index set derived from what listPublicProducts actually issues, not from
// "one index per field" — every storefront query starts with the same
// { isActive, approvalStatus } pair, so that pair leads each compound index
// and the remaining keys cover the filter and the sort together. A sort the
// index can serve is the difference between a scan-and-sort and a range read.
//
// Deliberately NOT indexed: isFlashsale/isTrending on their own (both are
// boolean and hugely non-selective; they only ever appear alongside the
// isActive+approvalStatus prefix, which the compound indexes below cover).
productSchema.index({ isActive: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, category: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, brand: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, isFlashsale: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, isTrending: 1, createdAt: -1 });
productSchema.index({ isActive: 1, approvalStatus: 1, rating: -1, reviewsCount: -1 });

// Search. A text index is what keeps `?search=` off a collection-wide regex
// scan as the catalog grows; the regex path stays as the fallback for partial
// and mid-word matches, which $text cannot do.
productSchema.index({ name: 'text', sku: 'text' }, { weights: { name: 10, sku: 4 }, name: 'product_text' });
// Plain prefix index on name, still used by the regex path and by
// admin-side name lookups.
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
