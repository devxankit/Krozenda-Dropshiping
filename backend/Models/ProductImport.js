const mongoose = require('mongoose');

// One CSV upload, from the moment it arrives to the moment someone decides on
// it. Nothing in a batch is visible to buyers: its rows live in
// ProductImportRow, and only approving the batch turns them into Products.
//
// Status flow:
//   PROCESSING      rows are being validated and their image URLs fetched
//   PENDING_REVIEW  staged, waiting for the uploader to approve or reject
//   APPROVING       approval is writing products (guards a double submit)
//   APPROVED        products created/merged — counts below say how many
//   REJECTED        discarded by the uploader; nothing was written
//   FAILED          processing or approval broke, or no row could be written
const productImportSchema = new mongoose.Schema(
  {
    // Who the batch belongs to. Admin batches create platform products
    // (vendor: null); a vendor's batch creates that vendor's products and
    // is only ever visible to that vendor.
    ownerType: { type: String, enum: ['ADMIN', 'VENDOR'], required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, default: '', trim: true },

    fileName: { type: String, default: '', trim: true },
    // What to do with a row whose SKU is already one of the owner's products:
    // SKIP leaves the existing product alone, UPDATE merges the row into it.
    duplicateMode: { type: String, enum: ['SKIP', 'UPDATE'], default: 'SKIP' },
    // STAGED (seller panel): rows wait in ProductImportRow and approving the
    // batch creates the products. PREVIEW (admin panel): valid rows become
    // Draft products flagged importPreview straight away, shown in the
    // product list with a Preview badge, and go live only when approved there.
    mode: { type: String, enum: ['STAGED', 'PREVIEW'], default: 'STAGED' },

    status: {
      type: String,
      enum: ['PROCESSING', 'PENDING_REVIEW', 'APPROVING', 'APPROVED', 'REJECTED', 'FAILED'],
      default: 'PROCESSING',
    },
    errorMessage: { type: String, default: '' },
    rejectionReason: { type: String, default: '', trim: true },

    progress: {
      processed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // Counts at review time...
    totalRows: { type: Number, default: 0 }, // CSV data lines
    productCount: { type: Number, default: 0 }, // products after grouping variant lines
    validCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    // ...and after approval.
    createdCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    // PREVIEW mode: how many of the created previews have been approved.
    approvedCount: { type: Number, default: 0 },

    processedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

productImportSchema.index({ ownerType: 1, vendor: 1, createdAt: -1 });
productImportSchema.index({ status: 1, updatedAt: 1 });

module.exports = mongoose.model('ProductImport', productImportSchema);
