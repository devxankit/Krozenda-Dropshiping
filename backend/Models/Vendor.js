const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { fcmTokenSchema } = require('./fcmTokenSchema');

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

// Only the Razorpay linked-account identifier is stored here, never secrets;
// isSettlementEligible must be true and onboardingStatus must be 'ACTIVE'
// before any transfer can be created for this vendor.
const razorpaySchema = new mongoose.Schema(
  {
    accountId: { type: String },           // Razorpay Linked Account id (acc_xxx) — not a secret
    onboardingStatus: {
      type: String,
      enum: ['NOT_STARTED','PENDING','ONBOARDING','KYC_PENDING','ACTIVE','REJECTED','SUSPENDED'],
      default: 'NOT_STARTED',
    },
    kycStatus: { type: String },
    isSettlementEligible: { type: Boolean, default: false },
    lastSyncedAt: { type: Date },

    // Recovery owed BACK from this vendor because a refund/return was
    // approved after their Razorpay Route payout for that line had already
    // been RELEASED or COMPLETED — money that may have already left for the
    // seller's bank, so it cannot be clawed back with an automatic Route
    // reversal (see refundService.js's Scenario C handling). This is a
    // running total in integer paise, incremented there and intended to be
    // subtracted from a FUTURE settlement's payable for this vendor.
    //
    // NOT YET WIRED: settlementService.js's collectEligibleLines/
    // generateSettlements (the only settlement generator) does not currently
    // read or deduct this field when computing a new settlement's
    // netPayablePaise — that wiring is out of scope for the sub-task that
    // added this field and is a required follow-up. Until it lands, this is
    // a correct record of what is owed back, not an amount actually being
    // withheld anywhere automatically.
    pendingRecoveryPaise: { type: Number, default: 0, min: 0 },
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
    razorpay: { type: razorpaySchema, default: () => ({}) },

    verificationStatus: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rejectionReason: { type: String, default: '' },
    // The panel's UI language. On the ACCOUNT rather than the device, so it
    // follows this person to another machine and only ever changes when they
    // change it. Null means "never chosen", which is NOT the same as English.
    // Not validated against an enum here: the supported list lives in
    // services/translationService.js and is checked at the endpoint, so
    // trimming that list later cannot make existing documents fail validation
    // on an unrelated save.
    language: { type: String, default: null, lowercase: true, trim: true },
    isActive: { type: Boolean, default: false },

    // Push (FCM) device tokens — see User.fcmTokens for the same shape.
    fcmTokens: { type: [fcmTokenSchema], default: [] },

    // Platform commission taken off each delivered item's line total —
    // admin-set, read-only from the vendor side (see vendorEarningsController).
    commissionRatePercent: { type: Number, default: 10, min: 0, max: 100 },

    // Tier 2 of the package-measurement fallback chain (product dimensions ->
    // THIS -> platform default -> seller's Verify Package override). A seller
    // who ships one standard carton size sets it once here instead of
    // measuring every parcel. Null means "no default, use the platform's".
    defaultPackage: {
      type: new mongoose.Schema(
        {
          lengthCm: { type: Number, default: null, min: 0 },
          breadthCm: { type: Number, default: null, min: 0 },
          heightCm: { type: Number, default: null, min: 0 },
          weightKg: { type: Number, default: null, min: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
    notificationPrefs: {
      type: {
        orderUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
      },
      default: () => ({ orderUpdates: true, promotions: true }),
      _id: false,
    },
  },
  { timestamps: true }
);

vendorSchema.index({ vendorType: 1, verificationStatus: 1 });

vendorSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

vendorSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
