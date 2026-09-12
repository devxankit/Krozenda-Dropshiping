const mongoose = require('mongoose');

// documentType is free-form (e.g. "PAN_DOCUMENT", "GST_CERTIFICATE",
// "FSSAI_LICENSE") rather than a fixed enum, since category-specific
// compliance documents (FSSAI, BIS, WPC, EPR, ...) vary by what the vendor
// sells and new ones shouldn't require a schema change.
const vendorDocumentSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    documentType: { type: String, required: true, trim: true },
    documentLabel: { type: String, trim: true, default: '' },
    documentNumber: { type: String, trim: true, default: '' },
    documentUrl: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    rejectionReason: { type: String, default: '' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vendorDocumentSchema.index({ vendorId: 1 });

module.exports = mongoose.model('VendorDocument', vendorDocumentSchema);
