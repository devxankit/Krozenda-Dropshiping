const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const { DEVICE_TYPES } = require('../Models/fcmTokenSchema');

// One endpoint serves every audience: which collection the token lands in
// comes from the JWT (see protectAnyAccount), never from the body, so a
// caller can only ever register a device against its own account.

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
// The pull also covers every *other* account, across both collections: a
// shared or reused device can carry a stale token from whoever was signed in
// before — including on the other side of the marketplace — and pushes for
// this device must only ever reach whoever is currently signed in on it.
async function registerFcmToken(req, res) {
  const body = parseBody(req);
  const error = validationError(body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  const { token, deviceType } = body;
  const { model, doc } = req.account;

  await Promise.all([
    User.updateMany({ 'fcmTokens.token': token }, { $pull: { fcmTokens: { token } } }),
    Vendor.updateMany({ 'fcmTokens.token': token }, { $pull: { fcmTokens: { token } } }),
  ]);
  await model.updateOne({ _id: doc._id }, { $push: { fcmTokens: { token, deviceType } } });

  res.json({ success: true, message: 'Fcm token registered' });
}

// Removal only needs the token — a device signing out drops its entry
// whatever platform it registered from.
async function removeFcmToken(req, res) {
  const { token } = parseBody(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }

  const { model, doc } = req.account;
  await model.updateOne({ _id: doc._id }, { $pull: { fcmTokens: { token } } });

  res.json({ success: true, message: 'Push token removed' });
}

module.exports = { registerFcmToken, removeFcmToken };
