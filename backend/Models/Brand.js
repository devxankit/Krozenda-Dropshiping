const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    // Same seller-proposal flow as Category — see its createdByVendor comment.
    createdByVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    rejectionReason: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 });

module.exports = mongoose.model('Brand', brandSchema);
