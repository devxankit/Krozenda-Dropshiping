const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true, trim: true },
    logo: { type: String, default: null },
    website: { type: String, default: '', trim: true },
    owner: { type: String, default: 'In-house', trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['live', 'pending', 'changes', 'rejected', 'draft'],
      default: 'live',
    },
    productCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 });
brandSchema.index({ slug: 1 });

module.exports = mongoose.model('Brand', brandSchema);
