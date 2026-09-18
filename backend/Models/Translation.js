const mongoose = require('mongoose');

// A self-populating translation memory.
//
// Google's free endpoint is unofficial, slow (~1.7s for a cold batch) and
// rate-limits aggressively, so it is treated as a one-time source: the first
// visitor who needs a string pays for the call, everyone after that reads it
// from here. Nothing is ever re-fetched unless the row is deleted, which also
// means a hand-corrected translation survives — edit the row and it sticks.
const translationSchema = new mongoose.Schema(
  {
    // sha1 of the source text, so the unique index stays inside the 1024-byte
    // index key limit no matter how long the string is.
    hash: { type: String, required: true },
    lang: { type: String, required: true, lowercase: true, trim: true },
    source: { type: String, required: true },
    text: { type: String, required: true },
    // Set when a human edited the row; the auto-translator then leaves it alone.
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

translationSchema.index({ hash: 1, lang: 1 }, { unique: true });

module.exports = mongoose.model('Translation', translationSchema);
