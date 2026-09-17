const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { fcmTokenSchema } = require('./fcmTokenSchema');

// Buyers, in their own collection.
//
// Previously buyers, admins and staff all shared `users` behind a `role`
// discriminator, which meant every buyer-facing query carried a
// `role: 'customer'` filter that was easy to forget — and forgetting it on
// one query was enough to leak staff records into a customer list. Splitting
// the collection makes the audience structural: there is no admin document in
// here to accidentally match.
//
// Note what is NOT here: `role`, `roleId` and `createdBy`. Those are
// staff-permission concepts and stay on User. A document in this collection
// is a customer by virtue of the collection it is in, so there is no role
// field to tamper with and no privilege to escalate to.
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    // Optional. Buyers sign in with a mobile OTP; a password is only set if
    // they use PUT /auth/change-password (see userAuthController).
    password: { type: String, select: false },
    image: { type: String, default: null },
    mobileNumber: { type: String, trim: true, unique: true, sparse: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: { type: Date },
    walletBalance: { type: Number, default: 0, min: 0 },
    // Push (FCM) device tokens — one account can be signed in on several
    // devices at once, so each entry carries the platform it registered from.
    // Deduped on `token` by pushTokenController.
    fcmTokens: { type: [fcmTokenSchema], default: [] },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// `users` indexed { role, isDeleted } and { mobileNumber, role }; with the
// audience now implied by the collection, the role half of both is dead
// weight. The unique sparse indexes on email/mobileNumber come from the field
// definitions above and are not repeated here.
customerSchema.index({ isDeleted: 1, createdAt: -1 });

customerSchema.pre('save', async function hashPassword() {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

customerSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Customer', customerSchema);
