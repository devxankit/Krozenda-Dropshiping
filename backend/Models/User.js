const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    image: { type: String, default: null },
    mobileNumber: { type: String, trim: true, unique: true, sparse: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: { type: Date },
    walletBalance: { type: Number, default: 0, min: 0 },
    // Web push (FCM) device tokens — one browser/device can register more
    // than one over time, so this is a deduped array, not a single field.
    fcmTokens: { type: [String], default: [] },
    role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer' },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ mobileNumber: 1, role: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
