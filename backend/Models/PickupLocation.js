const mongoose = require('mongoose');

// A seller warehouse a shipment can be collected from.
//
// This did not exist before: Vendor carries ONE flat `address` sub-document
// with no phone number, and Shiprocket requires a registered pickup location
// with a contact name, phone and a nickname that is unique within the carrier
// account. So this is a new collection rather than an extension of
// Vendor.address (task §18, §10).
//
// The grouping key for a shipment is (order, vendor, pickupLocation) — so a
// seller shipping one order from two warehouses correctly produces two
// shipments, each with its own AWB.

const REGISTRATION_STATUSES = [
  'NOT_REGISTERED', // exists locally only
  'REGISTERED', // accepted by the carrier, usable as a pickup point
  'REGISTRATION_FAILED',
];

const pickupLocationSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },

    // Seller-facing label ("Indore Warehouse").
    nickname: { type: String, required: true, trim: true, maxlength: 60 },

    // --- contact (Shiprocket requires all three) ---------------------------
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    // Vendor.address has no phone field, which is precisely why this is here.
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },

    // --- address ------------------------------------------------------------
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, default: '', trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },

    // --- carrier registration ------------------------------------------------
    // The nickname as the CARRIER knows it. Shiprocket identifies a pickup
    // location by this string in create/adhoc, and it must be unique within
    // that carrier account — so it is generated rather than taken verbatim
    // from `nickname`, which is only unique within OUR database.
    shiprocketLocationName: { type: String, default: '', trim: true },
    registrationStatus: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: 'NOT_REGISTERED',
    },
    registrationError: { type: String, default: '', trim: true },
    registeredAt: { type: Date, default: null },
    // Which carrier account this location was registered INTO. A seller who
    // switches from the platform account to their own has to re-register,
    // because the location does not exist in the new account.
    registeredIntegration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingIntegration',
      default: null,
    },

    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A seller's own nicknames must be distinct, so the picker is unambiguous.
pickupLocationSchema.index({ vendor: 1, nickname: 1 }, { unique: true });
// The common lookup: "this seller's usable pickup points".
pickupLocationSchema.index({ vendor: 1, isActive: 1, isDefault: -1 });

// At most one default per seller. Enforced in a hook rather than an index
// because "at most one document with isDefault: true per vendor" is not
// expressible as a unique index without a sparse-partial trick that would also
// forbid a seller having zero defaults.
// No `next` parameter: under Mongoose 9 an async hook signals completion by
// resolving, and `next` is not passed — calling it throws "next is not a
// function". Matches how Customer/User/Vendor declare their own async hooks.
pickupLocationSchema.pre('save', async function clearOtherDefaults() {
  if (!this.isDefault || !this.isModified('isDefault')) return;
  await this.constructor.updateMany(
    { vendor: this.vendor, _id: { $ne: this._id }, isDefault: true },
    { $set: { isDefault: false } }
  );
});

const PickupLocation = mongoose.model('PickupLocation', pickupLocationSchema);
PickupLocation.REGISTRATION_STATUSES = REGISTRATION_STATUSES;

module.exports = PickupLocation;
