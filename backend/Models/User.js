const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { fcmTokenSchema } = require('./fcmTokenSchema');

// Admins and staff ONLY. Buyers live in their own `customers` collection
// (see Models/Customer.js) — they were split out so that a buyer-facing query
// cannot reach a staff record by forgetting a `role` filter, and so that a
// buyer document has no `role`/`roleId` field to escalate through.
//
// `walletBalance` moved to Customer with them; it was never meaningful on a
// staff account. `gender`/`dob` stay: staffController exposes them on staff
// profiles.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    image: { type: String, default: null },
    mobileNumber: { type: String, trim: true, unique: true, sparse: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: { type: Date },
    // Push (FCM) device tokens — one account can be signed in on several
    // devices at once, so each entry carries the platform it registered
    // from. Deduped on `token` by pushTokenController.
    fcmTokens: { type: [fcmTokenSchema], default: [] },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isDeleted: 1 });
// Was { mobileNumber, role } when one collection held three audiences and a
// number could repeat across them. With only admin/staff here, mobileNumber
// is already uniquely indexed by its field definition.
userSchema.index({ email: 1, isDeleted: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
