const mongoose = require('mongoose');

// General-purpose monotonic counter. A single $inc on an upserted document is
// atomic in MongoDB, so two concurrent callers reserving a number can never be
// handed the same one — no read-then-write race is possible.
//
// Deliberately separate from Models/AccountingCounter.js: that one backs the
// accounting module's own TXN-/STL-/PAY- identifiers, and product barcodes are
// not an accounting concept. Reusing it would couple catalog creation to the
// accounting module for no reason other than "a counter already exists".
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.statics.next = async function next(key) {
  const counter = await this.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.value;
};

module.exports = mongoose.model('Counter', counterSchema);
