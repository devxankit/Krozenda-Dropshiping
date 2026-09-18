const mongoose = require('mongoose');

// One document per buyer, mirroring Wishlist — quantity/variant live on the
// line item since the same product can be in the cart with different specs.
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, default: 1, min: 1 },
        // Which variant of the product this line is. Null on a simple product,
        // which is every line written before variants existed — so old carts
        // stay valid and keep matching on product alone.
        //
        // A cart line is identified by (product, variantId), NOT by product:
        // the same shirt in Red/L and Blue/M are two lines a seller picks,
        // packs and prices separately.
        variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
        // Display label, snapshotted so a renamed or removed variant does not
        // rewrite what the buyer thought they were adding.
        variant: { type: String, default: '', trim: true },
        // What the item cost when it went into the cart. Kept so the cart can
        // say "price changed since you added this" instead of silently
        // showing the new number as though it had always been that.
        priceAtAdd: { type: Number, default: null, min: 0 },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
