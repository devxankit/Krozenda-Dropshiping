const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 });

module.exports = mongoose.model('Brand', brandSchema);
