const mongoose = require('mongoose');

// 'web' comes from the browser (service-worker push), 'app' from the mobile
// apps — Android and iOS share one value, since nothing on the server side
// branches on the platform. Shared by User and Vendor so the enum can never
// drift between the two collections.
const DEVICE_TYPES = ['web', 'app'];

// One registered push device. `_id: false` because the token itself is the
// identity — pushTokenController pulls by `token` and re-pushes rather than
// using $addToSet, so re-registering the same token from a new platform
// updates the entry instead of leaving two copies behind.
const fcmTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    deviceType: { type: String, enum: DEVICE_TYPES, required: true },
  },
  { _id: false, timestamps: false }
);

module.exports = { fcmTokenSchema, DEVICE_TYPES };
