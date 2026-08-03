import mongoose from 'mongoose'

// Core collection per project context §7. One parent order per checkout —
// see SubOrder.js for the per-vendor split (§6.1 multi-vendor cart
// splitting). Minimal skeleton for this scaffold.
const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentRef: { type: String, default: null },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
)

export const Order = mongoose.models.Order ?? mongoose.model('Order', orderSchema)
