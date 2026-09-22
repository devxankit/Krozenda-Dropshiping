const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['select', 'multiselect', 'text', 'number'], default: 'select' },
    values: { type: [String], default: [] },
    // How many products currently reference this attribute — kept as a plain
    // counter rather than a live aggregate since nothing in the product
    // schema links back to attributes yet; defaults to 0 for now.
    usedBy: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attributeSchema.index({ name: 1 });

module.exports = mongoose.model('Attribute', attributeSchema);
