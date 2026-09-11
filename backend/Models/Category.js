const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true, trim: true },
    image: { type: String, default: null },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    depth: { type: Number, default: 0, min: 0, max: 2 },
    commissionRate: { type: Number, default: null },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['live', 'pending', 'draft', 'changes', 'rejected'],
      default: 'live',
    },
    productCount: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1, isDeleted: 1 });
categorySchema.index({ slug: 1 });

module.exports = mongoose.model('Category', categorySchema);
