const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    // Platform Identity
    name: { type: String, default: 'Krozenda', trim: true },
    legalEntity: { type: String, default: 'Krozenda Commerce Private Limited', trim: true },
    gstin: { type: String, default: '27AAECK4821M1Z9', uppercase: true, trim: true },
    supportEmail: { type: String, default: 'support@krozenda.com', lowercase: true, trim: true },
    supportPhone: { type: String, default: '+91 98765 43210', trim: true },
    footerTagline: {
      type: String,
      default: 'B2B wholesale and dropshipping marketplace connecting retailers with direct factory prices and express delivery.',
      trim: true,
    },
    copyrightText: {
      type: String,
      default: '© 2026 KroZenda Technologies Pvt Ltd. All rights reserved.',
      trim: true,
    },

    // Social Media Handles
    socialLinks: {
      whatsapp: { type: String, default: 'https://whatsapp.com' },
      instagram: { type: String, default: 'https://instagram.com' },
      linkedin: { type: String, default: 'https://linkedin.com' },
      twitter: { type: String, default: 'https://twitter.com' },
      youtube: { type: String, default: 'https://youtube.com' },
      facebook: { type: String, default: 'https://facebook.com' },
    },

    // Custom Footer Links
    quickLinks: {
      type: [
        {
          label: { type: String },
          path: { type: String },
        },
      ],
      default: [
        { label: 'All Categories', path: '/app/categories' },
        { label: 'Trending Deals', path: '/app/dashboard' },
        { label: 'Electronics & Audio', path: '/app/listing?category=electronics' },
        { label: 'Fashion & Lifestyle', path: '/app/listing?category=fashion' },
      ],
    },
    customerLinks: {
      type: [
        {
          label: { type: String },
          path: { type: String },
        },
      ],
      default: [
        { label: 'Help & Support', path: '/app/support' },
        { label: 'Track Order', path: '/app/orders' },
        { label: 'Return Policy', path: '/return-policy' },
        { label: 'Shipping Timelines', path: '/shipping-policy' },
      ],
    },
    legalLinks: {
      type: [
        {
          label: { type: String },
          path: { type: String },
        },
      ],
      default: [
        { label: 'About Us', path: '/about' },
        { label: 'Terms & Conditions', path: '/terms' },
        { label: 'Privacy Policy', path: '/privacy-policy' },
        { label: 'Sell on KroZenda', path: '/seller/login' },
      ],
    },

    timezone: { type: String, default: 'Asia/Kolkata (IST, UTC+5:30)' },
    currency: { type: String, default: 'Indian Rupee (INR)' },

    // Financial & Taxation
    defaultCommissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    commissionRate: { type: Number, default: 10, min: 0 },
    commissionType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    defaultGstRate: { type: Number, default: 18, min: 0, max: 100 },
    gstRate: { type: Number, default: 18, min: 0 },
    gstType: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    gstOnCommissionRate: { type: Number, default: 18, min: 0, max: 100 },
    commissionBase: {
      type: String,
      enum: ['LINE_NET_OF_SELLER_FUNDED_DISCOUNT', 'LINE_GROSS', 'LINE_NET'],
      default: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT',
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

platformSettingsSchema.statics.getSettings = async function getSettings() {
  let doc = await this.findOne({ key: 'GLOBAL' });
  if (!doc) {
    try {
      doc = await this.create({ key: 'GLOBAL' });
    } catch (err) {
      if (err.code === 11000) {
        doc = await this.findOne({ key: 'GLOBAL' });
      } else {
        throw err;
      }
    }
  }
  return doc;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
