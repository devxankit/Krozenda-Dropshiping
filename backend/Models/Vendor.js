const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// One shared shape for both vendor types — B2C leaves most of this blank,
// B2B fills it in. Keeping a single `vendors` collection (rather than
// separate B2B/B2C models) means the admin side never has to query two
// collections to list every vendor.
const businessSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true, default: '' },
    tradeName: { type: String, trim: true, default: '' },
    businessType: {
      type: String,
      enum: [
        'proprietorship',
        'partnership',
        'llp',
        'private_limited',
        'public_limited',
        'huf',
        'society_trust',
        'other',
        null,
      ],
      default: null,
    },
    pan: { type: String, trim: true, uppercase: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    udyamNumber: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const contactPersonSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    mobile: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    addressLine: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false }
);

const bankSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifsc: { type: String, trim: true, uppercase: true, default: '' },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    // Seller type on this marketplace — not a government registration
    // category. Drives which fields the registration wizard requires.
    vendorType: { type: String, enum: ['B2C', 'B2B'], required: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    profileImage: { type: String, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    gstRegistered: { type: Boolean, default: false },

    business: { type: businessSchema, default: () => ({}) },
    contactPerson: { type: contactPersonSchema, default: () => ({}) },
    address: { type: addressSchema, default: () => ({}) },
    bank: { type: bankSchema, default: () => ({}) },

    verificationStatus: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rejectionReason: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vendorSchema.index({ vendorType: 1, verificationStatus: 1 });

vendorSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
