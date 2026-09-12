const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    order: { type: Number, default: 0 },
    updatedBy: { type: String, default: 'Admin', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

faqSchema.index({ status: 1, isDeleted: 1 });
faqSchema.index({ order: 1 });

module.exports = mongoose.model('Faq', faqSchema);
