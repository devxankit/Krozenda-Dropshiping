const User = require('../Models/User');
const { signToken } = require('../utils/jwt');
const { getImageUrl } = require('../utils/imageHelper');

// Normalize phone to clean 10-digit format
function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

function serializeCustomer(user) {
  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name || `Customer ${user.mobileNumber?.slice(-4) || ''}`,
    mobileNumber: user.mobileNumber || '',
    phone: user.mobileNumber || '',
    email: user.email || '',
    gender: user.gender || null,
    dob: user.dob || null,
    role: user.role || 'customer',
    image: user.image ? getImageUrl(user.image) : null,
    walletBalance: user.walletBalance || 0,
    createdAt: user.createdAt,
  };
}

// POST /auth/send-otp
async function requestOtp(req, res) {
  const { mobileNumber, phone } = req.body;
  const cleanNumber = normalizePhone(mobileNumber || phone);

  if (!cleanNumber || cleanNumber.length !== 10) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid 10-digit mobile number',
    });
  }

  const existingUser = await User.findOne({
    mobileNumber: cleanNumber,
    isDeleted: false,
  });

  // Mock OTP as requested: 123456
  const mockOtp = '123456';

  res.json({
    success: true,
    message: 'OTP sent successfully',
    data: {
      mobileNumber: cleanNumber,
      otp: mockOtp,
      isRegistered: Boolean(existingUser),
    },
  });
}

// POST /auth/verify-otp
async function verifyOtp(req, res) {
  const { mobileNumber, phone, otp, name } = req.body;
  const cleanNumber = normalizePhone(mobileNumber || phone);

  if (!cleanNumber || cleanNumber.length !== 10) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid 10-digit mobile number',
    });
  }

  const cleanOtp = String(otp || '').trim();
  if (cleanOtp !== '123456') {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please enter 123456',
    });
  }

  let user = await User.findOne({
    mobileNumber: cleanNumber,
    isDeleted: false,
  });

  let isNewUser = false;

  if (!user) {
    // New customer auto-registration
    isNewUser = true;
    user = await User.create({
      name: name?.trim() || `Customer ${cleanNumber.slice(-4)}`,
      mobileNumber: cleanNumber,
      role: 'customer',
      isActive: true,
    });
  } else {
    // Existing customer login
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Update name if customer had placeholder name and a real name was passed
    if (name?.trim() && (!user.name || user.name.startsWith('Customer '))) {
      user.name = name.trim();
      await user.save();
    }
  }

  const token = signToken('user', {
    id: user._id.toString(),
    role: user.role || 'customer',
    mobileNumber: user.mobileNumber,
  });

  res.json({
    success: true,
    message: isNewUser
      ? 'Welcome to Krozenda! Account created and logged in.'
      : 'Welcome back! Logged in successfully.',
    isNewUser,
    data: {
      user: serializeCustomer(user),
      accessToken: token,
    },
  });
}

// GET /auth/me
async function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  res.json({
    success: true,
    data: { user: serializeCustomer(req.user) },
  });
}

// PUT /auth/profile — direct edit, no OTP re-verification on mobile number
// change: this backend's auth is already mock-OTP (123456 for every user),
// so gating a mobile edit behind the same mock flow would add friction
// without adding real security.
async function updateProfile(req, res) {
  const { name, email, dob, gender, mobileNumber } = req.body;

  if (email !== undefined && email) {
    const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already in use' });
    }
  }

  if (mobileNumber !== undefined && mobileNumber) {
    const cleanNumber = normalizePhone(mobileNumber);
    if (cleanNumber.length !== 10) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }
    const existing = await User.findOne({ mobileNumber: cleanNumber, _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This mobile number is already in use' });
    }
    req.user.mobileNumber = cleanNumber;
  }

  if (name !== undefined) req.user.name = name.trim();
  if (email !== undefined) req.user.email = email ? email.toLowerCase().trim() : undefined;
  if (dob !== undefined) req.user.dob = dob ? new Date(dob) : null;
  if (gender !== undefined) req.user.gender = gender || undefined;

  await req.user.save();

  res.json({ success: true, message: 'Profile updated successfully', data: { user: serializeCustomer(req.user) } });
}

// POST /auth/profile/image — multipart, field name "image" (see
// uploadMiddleware.upload / processImage, same pipeline productRoutes uses).
async function uploadProfileImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }

  req.user.image = req.file.url;
  await req.user.save();

  res.json({ success: true, message: 'Profile photo updated', data: { user: serializeCustomer(req.user) } });
}

module.exports = {
  requestOtp,
  verifyOtp,
  getMe,
  updateProfile,
  uploadProfileImage,
};
