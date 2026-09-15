const User = require('../Models/User');
const Vendor = require('../Models/Vendor');

// Registration is idempotent ($addToSet) — a device calling this again on
// every app open never duplicates its token.
async function registerUserFcmToken(req, res) {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  // A shared/reused device can carry a stale token from a previously
  // logged-in account — strip it from every other account first so pushes
  // for this device only ever reach whoever is currently signed in on it.
  await User.updateMany({ _id: { $ne: req.user._id } }, { $pull: { fcmTokens: token } });
  await Vendor.updateMany({}, { $pull: { fcmTokens: token } });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { fcmTokens: token } });
  res.json({ success: true, message: 'Push token registered' });
}

async function removeUserFcmToken(req, res) {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: token } });
  res.json({ success: true, message: 'Push token removed' });
}

async function registerVendorFcmToken(req, res) {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  await Vendor.updateMany({ _id: { $ne: req.vendor._id } }, { $pull: { fcmTokens: token } });
  await User.updateMany({}, { $pull: { fcmTokens: token } });
  await Vendor.updateOne({ _id: req.vendor._id }, { $addToSet: { fcmTokens: token } });
  res.json({ success: true, message: 'Push token registered' });
}

async function removeVendorFcmToken(req, res) {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  await Vendor.updateOne({ _id: req.vendor._id }, { $pull: { fcmTokens: token } });
  res.json({ success: true, message: 'Push token removed' });
}

module.exports = { registerUserFcmToken, removeUserFcmToken, registerVendorFcmToken, removeVendorFcmToken };
