import mongoose from 'mongoose'

// Core collection per project context §7. Minimal skeleton for this scaffold
// — full auth fields (OTP hash/expiry, email verification, 2FA) belong to
// the real auth service build-out, not this pass.
//
// `roles[]` + `capabilities[]`, never a single `role` string — roles 8–11
// (trader/dealer/distributor/wholesaler) can hold both a seller and a buyer
// capability on one account (§2 architecture requirement).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    roles: { type: [String], default: [] },
    capabilities: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'pending',
    },
  },
  { timestamps: true },
)

export const User = mongoose.models.User ?? mongoose.model('User', userSchema)
