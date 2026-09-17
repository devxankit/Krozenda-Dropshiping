const mongoose = require('mongoose');

const TYPES = ['home', 'office', 'other'];

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    type: { type: String, enum: TYPES, default: 'home' },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: '', trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1 });

const Address = mongoose.model('Address', addressSchema);
Address.TYPES = TYPES;

module.exports = Address;
