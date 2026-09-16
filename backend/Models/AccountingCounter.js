const mongoose = require('mongoose');

// Monotonic counters behind the human-facing TXN-/STL-/PAY- identifiers.
// A single $inc on an upserted document is atomic in MongoDB, so two
// concurrent postings can never be handed the same number — which matters,
// because those identifiers carry unique indexes on their own collections.
const accountingCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountingCounter', accountingCounterSchema);
