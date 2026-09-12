const mongoose = require('mongoose');

// One document per buyer, mirroring Wishlist — quantity/variant live on the
// line item since the same product can be in the cart with different specs.
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, default: 1, min: 1 },
        variant: { type: String, default: '', trim: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
