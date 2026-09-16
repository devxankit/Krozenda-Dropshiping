const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../Models/User');
const OtpRequest = require('../Models/OtpRequest');
const { signToken } = require('../utils/jwt');
const { getImageUrl } = require('../utils/imageHelper');
const { sendOtpSms } = require('../utils/smsService');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const isProduction = process.env.ENV === 'production';
// Every dev/staging login uses this same fixed code — never random — so
// nobody needs a live SMS account (or to read server logs) to test the OTP
// flow locally. Production always generates a real random one below.
const DEV_FIXED_OTP = '123456';

// Numbers that skip the SMS gateway even in production and get DEV_FIXED_OTP
// instead — for app-store reviewers and our own QA handsets, so verifying a
// build never depends on a live SMS arriving (and never burns a credit).
// Comma separated in .env; unset or empty disables the bypass entirely.
function isBypassNumber(mobileNumber) {
  return (process.env.TEST_PHONE_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .includes(mobileNumber);
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const useLiveSms = isProduction && !isBypassNumber(cleanNumber);
  const otp = useLiveSms ? generateOtp() : DEV_FIXED_OTP;
  const otpHash = await bcrypt.hash(otp, 10);

  await OtpRequest.findOneAndUpdate(
    { mobileNumber: cleanNumber },
    { otpHash, attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true }
  );

  // Always visible in server logs, on every path — the SMS gateway has been
  // unreliable, so this is the fallback way to read/hand out an OTP without
  // depending on it actually arriving on the phone.
  console.log(`[requestOtp] OTP for ${cleanNumber}: ${otp}`);

  if (useLiveSms) {
    try {
      await sendOtpSms(cleanNumber, otp);
    } catch (err) {
      console.error('[requestOtp] SMS send failed:', err.message);
      return res.status(502).json({ success: false, message: 'Could not send OTP right now. Please try again.' });
    }
  } else if (isProduction) {
    // Bypass number in production: the OTP is never sent over SMS and never
    // returned in the response body — read it from the log line above.
    console.log(`[requestOtp] Bypass number ${cleanNumber}, SMS skipped.`);
  }

  res.json({
    success: true,
    message: 'OTP sent successfully',
    data: {
      mobileNumber: cleanNumber,
      // Only ever present outside production — in production the OTP only
      // ever reaches the buyer's phone via the SMS gateway above.
      ...(isProduction ? {} : { otp }),
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

  const otpRequest = await OtpRequest.findOne({ mobileNumber: cleanNumber });
  if (!otpRequest || otpRequest.expiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'OTP expired or not requested. Please request a new one.',
    });
  }

  if (otpRequest.attempts >= MAX_OTP_ATTEMPTS) {
    await otpRequest.deleteOne();
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts. Please request a new OTP.',
    });
  }

  const otpMatches = await bcrypt.compare(cleanOtp, otpRequest.otpHash);
  if (!otpMatches) {
    otpRequest.attempts += 1;
    await otpRequest.save();
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please try again.',
    });
  }

  // OTP is single-use — consume it before any further processing.
  await otpRequest.deleteOne();

  let user = await User.findOne({
    mobileNumber: cleanNumber,
    isDeleted: false,
  });

  let isNewUser = false;

  if (!user) {
    // New customer auto-registration
    isNewUser = true;
    try {
      user = await User.create({
        name: name?.trim() || `Customer ${cleanNumber.slice(-4)}`,
        mobileNumber: cleanNumber,
        role: 'customer',
        isActive: true,
      });
    } catch (err) {
      // Concurrent verify-otp calls for the same number can both pass the
      // `!user` check above; the unique index on mobileNumber turns the
      // loser into a duplicate-key error instead of a duplicate account.
      if (err.code === 11000) {
        isNewUser = false;
        user = await User.findOne({ mobileNumber: cleanNumber, isDeleted: false });
      } else {
        throw err;
      }
    }
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

// PUT /auth/profile — mobile number is one-time-settable only (see the
// "cannot be changed" branch below) precisely because it isn't re-verified
// by OTP here; a user with one already set can never move to a different
// number through this endpoint.
async function updateProfile(req, res) {
  const { name, email, dob, gender, mobileNumber } = req.body;

  if (email !== undefined && email) {
    if (!EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already in use' });
    }
  }

  if (mobileNumber !== undefined && mobileNumber) {
    const cleanNumber = normalizePhone(mobileNumber);
    if (req.user.mobileNumber && cleanNumber !== normalizePhone(req.user.mobileNumber)) {
      return res.status(400).json({ success: false, message: 'Mobile number cannot be changed' });
    }
    if (!req.user.mobileNumber) {
      if (cleanNumber.length !== 10) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
      }
      const existing = await User.findOne({ mobileNumber: cleanNumber, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'This mobile number is already in use' });
      }
      req.user.mobileNumber = cleanNumber;
    }
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

// PUT /auth/change-password
async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters and include a letter and a number',
    });
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // If user already has a password set, verify currentPassword
  if (user.password) {
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required' });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
}

// DELETE /auth/account
async function deleteAccount(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.isDeleted = true;
  user.isActive = false;
  await user.save();

  res.json({ success: true, message: 'Account deleted successfully' });
}

module.exports = {
  requestOtp,
  verifyOtp,
  getMe,
  updateProfile,
  uploadProfileImage,
  changePassword,
  deleteAccount,
};
