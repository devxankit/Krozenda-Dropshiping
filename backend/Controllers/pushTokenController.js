const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const { DEVICE_TYPES } = require('../Models/fcmTokenSchema');

// Both `token` and `deviceType` come from the client: the browser sends
// 'web', the mobile apps send 'app'.
function parseBody(req) {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  const deviceType =
    typeof req.body.deviceType === 'string' ? req.body.deviceType.trim().toLowerCase() : '';
  return { token, deviceType };
}

function validationError({ token, deviceType }) {
  if (!token) return 'token is required';
  if (!deviceType) return 'deviceType is required';
  if (!DEVICE_TYPES.includes(deviceType)) {
    return `deviceType must be one of: ${DEVICE_TYPES.join(', ')}`;
  }
  return null;
}

// Registration is idempotent — a device calling this again on every app open
// never duplicates its token. It is a pull-then-push rather than $addToSet
// because $addToSet compares the whole subdocument, so the same token
// arriving with a different deviceType would be stored twice.
//
// The pull also covers every *other* account: a shared/reused device can
// carry a stale token from a previously logged-in user, and pushes for this
// device must only ever reach whoever is currently signed in on it.
async function registerFcmToken({ ownerModel, ownerId, token, deviceType }) {
  await Promise.all([
    User.updateMany({ 'fcmTokens.token': token }, { $pull: { fcmTokens: { token } } }),
    Vendor.updateMany({ 'fcmTokens.token': token }, { $pull: { fcmTokens: { token } } }),
  ]);
  await ownerModel.updateOne({ _id: ownerId }, { $push: { fcmTokens: { token, deviceType } } });
}

async function registerUserFcmToken(req, res) {
  const body = parseBody(req);
  const error = validationError(body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  await registerFcmToken({ ownerModel: User, ownerId: req.user._id, ...body });
  res.json({ success: true, message: 'Fcm token registered' });
}

// Removal only needs the token — a device signing out drops its entry
// whatever platform it registered from.
async function removeUserFcmToken(req, res) {
  const { token } = parseBody(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  await User.updateOne({ _id: req.user._id }, { $pull: { fcmTokens: { token } } });
  res.json({ success: true, message: 'Push token removed' });
}

async function registerVendorFcmToken(req, res) {
  const body = parseBody(req);
  const error = validationError(body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  await registerFcmToken({ ownerModel: Vendor, ownerId: req.vendor._id, ...body });
  res.json({ success: true, message: 'Fcm token registered' });
}

async function removeVendorFcmToken(req, res) {
  const { token } = parseBody(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  await Vendor.updateOne({ _id: req.vendor._id }, { $pull: { fcmTokens: { token } } });
  res.json({ success: true, message: 'Push token removed' });
}

module.exports = { registerUserFcmToken, removeUserFcmToken, registerVendorFcmToken, removeVendorFcmToken };
