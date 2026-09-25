const mongoose = require('mongoose');

// One document per buyer — items are looked up by product on every toggle,
// so a single array on a user-keyed document is simpler than one row per
// (user, product) pair and avoids a compound-unique-index dance.
const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        addedAt: { type: Date, default: Date.now },
        // What the buyer last saw, kept by Jobs/engagementJob so it can say
        // "back in stock" / "price dropped" once per change. Null until the
        // job first looks at the item — the first look never alerts.
        lastPrice: { type: Number, default: null },
        lastInStock: { type: Boolean, default: null },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);
