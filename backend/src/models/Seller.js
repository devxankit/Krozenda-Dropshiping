import mongoose from 'mongoose'
import { BUSINESS_MODEL } from '../config/constants.js'

// Core collection per project context §7. Minimal skeleton — KYC documents,
// full store config, and pickup addresses are Phase 1 feature work, not
// this scaffold. `businessModel` distinguishes a Marketplace seller from a
// Dropshipping Partner on the same collection (they are the vendor-shared
// surface on both the frontend and here).
const VENDOR_STATUS = ['pending_approval', 'approved', 'rejected', 'suspended']

const sellerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeName: { type: String, required: true, trim: true },
    businessModel: {
      type: String,
      enum: [BUSINESS_MODEL.MARKETPLACE, BUSINESS_MODEL.DROPSHIPPING],
      required: true,
    },
    status: { type: String, enum: VENDOR_STATUS, default: 'pending_approval' },
    razorpayLinkedAccountId: { type: String, default: null },
  },
  { timestamps: true },
)

export const Seller = mongoose.models.Seller ?? mongoose.model('Seller', sellerSchema)
