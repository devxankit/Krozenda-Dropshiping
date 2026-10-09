const mongoose = require('mongoose');

// Admin-authored how-to guides. `audience` decides which app shows it: the
// seller panel reads 'seller', the buyer web/mobile apps read 'customer'.
const tutorialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    audience: { type: String, enum: ['seller', 'customer'], required: true },
    // Optional: a YouTube/Vimeo/direct video link. Text-only guides leave it blank.
    videoUrl: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    order: { type: Number, default: 0 },
    updatedBy: { type: String, default: 'Admin', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tutorialSchema.index({ audience: 1, status: 1, isDeleted: 1, order: 1 });

module.exports = mongoose.model('Tutorial', tutorialSchema);
