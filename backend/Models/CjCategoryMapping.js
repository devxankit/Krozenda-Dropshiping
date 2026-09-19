const mongoose = require('mongoose');

// CJ category -> Krozenda category, saved once per CJ category so admin
// doesn't have to re-map it on every product onboarded from that category
// (master plan §9/§6-point-6: manual for Phase 1, but the data model is
// future-ready for an "auto-apply this rule" screen later).

const cjCategoryMappingSchema = new mongoose.Schema(
  {
    cjCategoryId: { type: String, required: true, trim: true, unique: true },
    cjCategoryName: { type: String, default: '', trim: true },
    krozendaCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CjCategoryMapping', cjCategoryMappingSchema);
