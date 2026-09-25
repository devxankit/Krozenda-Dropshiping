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
    // Food categories need the proposing seller's FSSAI licence approved
    // before admin can approve the category (see utils/fssai.js).
    isFood: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 });
categorySchema.index({ isTopCategory: 1 });
categorySchema.index({ isActive: 1, isTopCategory: 1 });

module.exports = mongoose.model('Category', categorySchema);

