const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isTopCategory: { type: Boolean, default: false },
    // null = admin-created (skips review, defaults straight to APPROVED).
    // Set when a seller proposes a new category — it stays PENDING and
    // invisible to the storefront/other sellers until an admin approves it.
    createdByVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    rejectionReason: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 });
categorySchema.index({ isTopCategory: 1 });
categorySchema.index({ isActive: 1, isTopCategory: 1 });

module.exports = mongoose.model('Category', categorySchema);

