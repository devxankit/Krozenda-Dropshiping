const mongoose = require('mongoose');

const AUDIENCES = ['customers', 'sellers', 'both', 'specific_seller'];
const STATUSES = ['sent', 'failed'];

// Push and in-app notifications sent from /admin/marketing/campaigns.
const notificationCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, enum: AUDIENCES, required: true },
    targetVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    targetVendorName: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    audienceSize: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'sent' },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationCampaignSchema.index({ createdAt: -1 });

const NotificationCampaign = mongoose.model('NotificationCampaign', notificationCampaignSchema);
NotificationCampaign.AUDIENCES = AUDIENCES;

module.exports = NotificationCampaign;
