const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { fcmTokenSchema } = require('./fcmTokenSchema');

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
    // Push (FCM) device tokens — one account can be signed in on several
    // devices at once, so each entry carries the platform it registered
    // from. Deduped on `token` by pushTokenController.
    fcmTokens: { type: [fcmTokenSchema], default: [] },
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
