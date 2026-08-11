import mongoose from 'mongoose'
import { BUSINESS_MODEL } from '../config/constants.js'

// Core collection per project context §7. Minimal skeleton — full store
// config and pickup addresses are still Phase 1 feature work, not this
// scaffold. `businessModel` distinguishes a Marketplace seller from a
// Dropshipping Partner on the same collection (they are the vendor-shared
// surface on both the frontend and here).
const VENDOR_STATUS = ['pending_approval', 'approved', 'rejected', 'suspended']

// documentType is free text (e.g. "PAN", "GST Certificate", "Aadhaar") —
// there's no fixed KYC checklist yet, see modules/seller/constants.js.
// `url` is the public /uploads URL from middlewares/upload.js's
// publicUrlFor(), same convention as Review.photos — never a local
// filesystem path.
const kycDocumentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    documentType: { type: String, default: 'other', trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

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
    kycDocuments: { type: [kycDocumentSchema], default: [] },
  },
  { timestamps: true },
)

export const Seller = mongoose.models.Seller ?? mongoose.model('Seller', sellerSchema)
