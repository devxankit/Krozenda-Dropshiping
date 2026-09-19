const mongoose = require('mongoose');

// Audit trail for every CJ sync operation (stock, price, variant, webhook-
// triggered or polled) — master plan §13. Admin's Sync Logs screen reads
// this directly; nothing here drives business logic itself.

const cjSyncLogSchema = new mongoose.Schema(
  {
    entity: { type: String, enum: ['PRODUCT', 'VARIANT', 'ORDER'], required: true },
    entityId: { type: String, required: true, trim: true }, // cjProductId or cjVariantId
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    operation: { type: String, enum: ['STOCK_SYNC', 'PRICE_SYNC', 'VARIANT_SYNC', 'WEBHOOK'], required: true },
    trigger: { type: String, enum: ['SCHEDULED', 'MANUAL', 'WEBHOOK'], default: 'SCHEDULED' },
    requestId: { type: String, default: '' },
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    error: { type: String, default: '' },
    retryCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

cjSyncLogSchema.index({ createdAt: -1 });
cjSyncLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CjSyncLog', cjSyncLogSchema);
