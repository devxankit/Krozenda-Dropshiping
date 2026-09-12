const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isTopCategory: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 });
categorySchema.index({ isTopCategory: 1 });
categorySchema.index({ isActive: 1, isTopCategory: 1 });

module.exports = mongoose.model('Category', categorySchema);

