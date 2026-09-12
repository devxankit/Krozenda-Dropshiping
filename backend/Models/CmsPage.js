const mongoose = require('mongoose');

const cmsPageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    content: { type: String, default: '' },
    version: { type: String, default: 'v1.0', trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
    },
    requiresAcceptance: { type: Boolean, default: false },
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true },
    updatedBy: { type: String, default: 'Admin', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

cmsPageSchema.index({ slug: 1, isDeleted: 1 });
cmsPageSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('CmsPage', cmsPageSchema);
