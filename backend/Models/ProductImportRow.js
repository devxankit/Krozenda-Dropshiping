const mongoose = require('mongoose');

// One staged product from a CSV import (a product plus its variant lines).
// This is the "temporary/pending" copy the uploader reviews — it is never
// read by the storefront, and turns into a real Product only when its batch
// is approved. See ProductImport for the batch lifecycle.
const productImportRowSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductImport', required: true },
    index: { type: Number, required: true },
    // Spreadsheet line numbers (header is line 1), so an error points at a
    // row the uploader can actually find.
    lines: { type: [Number], default: [] },

    // VALID / INVALID at review time; CREATED / UPDATED / SKIPPED / FAILED
    // once the batch is approved.
    status: {
      type: String,
      enum: ['VALID', 'INVALID', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED'],
      required: true,
    },
    // What approval will do with a VALID row, decided by the SKU match.
    action: { type: String, enum: ['CREATE', 'UPDATE', 'SKIP', null], default: null },
    existingProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    existingProductName: { type: String, default: '' },
    // Deselected by the reviewer: stays in the batch, is not imported.
    excluded: { type: Boolean, default: false },

    // Named `issues`/`notes` rather than `errors` — `errors` is reserved on a
    // mongoose document.
    issues: { type: [String], default: [] },
    notes: { type: [String], default: [] },

    // The normalised product. Holds only the fields the CSV actually filled,
    // so an UPDATE merges exactly those; defaults are applied on CREATE.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Every image file this row staged on disk, so the ones that never make
    // it into the catalog can be deleted.
    stagedImages: { type: [String], default: [] },

    resultProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    resultMessage: { type: String, default: '' },
  },
  { timestamps: true, minimize: false }
);

productImportRowSchema.index({ batch: 1, index: 1 });
productImportRowSchema.index({ batch: 1, status: 1 });

module.exports = mongoose.model('ProductImportRow', productImportRowSchema);
