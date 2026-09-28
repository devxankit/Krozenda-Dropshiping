const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Customer = require('../Models/Customer');
const OtpRequest = require('../Models/OtpRequest');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { getImageUrl } = require('../utils/imageHelper');
const { sendOtpSms } = require('../utils/smsService');
const { updateLanguageFor } = require('./languageController');

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
//
// 1111111111 is pinned here rather than left to .env so the demo login behaves
// identically on staging and production without anyone having to remember to
// wire an env var on each server. Pinning it is safe: Indian mobile numbers
// start with 6-9, so 1111111111 can never be issued to a real buyer and no
// real account is reachable through this bypass.
const PERMANENT_TEST_NUMBERS = ['1111111111'];

// Extra numbers, comma separated in .env; unset or empty just leaves the
// permanent list above in force.
function isBypassNumber(mobileNumber) {
  if (PERMANENT_TEST_NUMBERS.includes(mobileNumber)) return true;
  return (process.env.TEST_PHONE_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .includes(mobileNumber);
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Resend limits. The per-code attempt cap alone was not a limit: asking for
// a new code reset it, so guessing was unbounded (and every ask cost an SMS).
// With these, one number gets at most MAX_SENDS_PER_WINDOW codes an hour —
// MAX_OTP_ATTEMPTS guesses each — against a million possible codes.
const RESEND_COOLDOWN_MS = 30 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;

// HMAC, not bcrypt: a 6-digit code has a million values, so a slow hash adds
// nothing a leaked table would not give up anyway — the attempt and resend
// caps are what protect it. bcryptjs is pure JS on the event loop and was
// the single slowest thing in a login (load test: 11 logins/s).
function hashOtp(mobileNumber, otp) {
  const pepper = process.env.JWT_SECRET || 'krozenda-otp';
  return crypto.createHmac('sha256', pepper).update(`${mobileNumber}:${otp}`).digest('hex');
}

async function otpMatches(mobileNumber, otp, storedHash) {
  if (!storedHash) return false;
  // A code issued before this change, still inside its 5 minutes.
  if (storedHash.startsWith('$2')) return bcrypt.compare(otp, storedHash);
  const candidate = Buffer.from(hashOtp(mobileNumber, otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function maskNumber(mobileNumber) {
  return `${mobileNumber.slice(0, 2)}******${mobileNumber.slice(-2)}`;
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
    role: 'customer',
    image: user.image ? getImageUrl(user.image) : null,
    walletBalance: user.walletBalance || 0,
    // Drives the UI language on whatever device this session opens on.
    // Null is passed through deliberately — the client reads it as "this
    // account has never chosen", and adopts whatever the visitor had picked
    // before signing in rather than resetting them to English.
    language: user.language || null,
    business: {
      companyName: user.business?.companyName || '',
      gstin: user.business?.gstin || '',
      pan: user.business?.pan || '',
      tradeType: user.business?.tradeType || '',
    },
    createdAt: user.createdAt,
  };
}

// Both the OTP login and the refresh endpoint mint tokens the same way, so
// the pair can never drift (e.g. a refresh handing back a token with a
// different payload shape than login did).
function issueTokens(user) {
  const payload = {
    id: user._id.toString(),
    role: 'customer',
    mobileNumber: user.mobileNumber,
  };
  return {
    accessToken: signToken('user', payload),
    refreshToken: signRefreshToken('user', payload),
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

  const existingCustomer = await Customer.findOne({
    mobileNumber: cleanNumber,
    isDeleted: false,
  });

  const useLiveSms = isProduction && !isBypassNumber(cleanNumber);
  const otp = useLiveSms ? generateOtp() : DEV_FIXED_OTP;

  // Rate limit, then store — as ONE conditional write. The filter pins the
  // lastSentAt this request read, so of two parallel sends only one can
  // match; the other upserts into the unique mobileNumber and is refused.
  // Bypass numbers (reviewers, QA handsets) always get the fixed code, so
  // limiting their resends protects nothing and only stalls a reviewer.
  const rateLimited = !isBypassNumber(cleanNumber);
  const now = Date.now();
  const previous = await OtpRequest.findOne({ mobileNumber: cleanNumber }).lean();
  const sinceLast =
    rateLimited && previous?.lastSentAt ? now - new Date(previous.lastSentAt).getTime() : Infinity;
  if (sinceLast < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: 'OTP_RESEND_COOLDOWN',
      message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
      data: { retryAfterSeconds },
    });
  }
  const windowOpen = previous?.windowStartedAt && now - new Date(previous.windowStartedAt).getTime() < SEND_WINDOW_MS;
  const windowStartedAt = windowOpen ? new Date(previous.windowStartedAt) : new Date(now);
  const sendCount = windowOpen ? previous.sendCount || 0 : 0;
  if (rateLimited && sendCount >= MAX_SENDS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((windowStartedAt.getTime() + SEND_WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: 'OTP_SEND_LIMIT',
      message: 'Too many OTP requests for this number. Please try again later.',
      data: { retryAfterSeconds },
    });
  }

  try {
    await OtpRequest.findOneAndUpdate(
      { mobileNumber: cleanNumber, lastSentAt: previous ? previous.lastSentAt : null },
      {
        $set: {
          otpHash: hashOtp(cleanNumber, otp),
          attempts: 0,
          otpExpiresAt: new Date(now + OTP_TTL_MS),
          lastSentAt: new Date(now),
          windowStartedAt,
          sendCount: sendCount + 1,
          expiresAt: new Date(windowStartedAt.getTime() + SEND_WINDOW_MS),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    return res.status(429).json({
      success: false,
      code: 'OTP_RESEND_COOLDOWN',
      message: 'An OTP was just sent to this number. Please wait before requesting another.',
    });
  }

  // The code itself only ever reaches the logs outside production. In
  // production it goes to the buyer's phone and nowhere else: a log line
  // with the code in it lets anyone who can read the logs sign in as anyone.
  if (isProduction) {
    console.log(`[requestOtp] OTP issued for ${maskNumber(cleanNumber)}`);
  } else {
    console.log(`[requestOtp] OTP for ${cleanNumber}: ${otp}`);
  }

  if (useLiveSms) {
    // OTP goes out over SMS only.
    try {
      await sendOtpSms(cleanNumber, otp);
    } catch (err) {
      console.error('[requestOtp] SMS send failed:', err.message);
      // A code that never arrived must not hold the buyer behind the resend
      // cooldown. It still counts toward the hourly cap.
      await OtpRequest.updateOne(
        { mobileNumber: cleanNumber },
        { $set: { otpHash: null, lastSentAt: previous?.lastSentAt || null } }
      );
      return res.status(502).json({ success: false, message: 'Could not send OTP right now. Please try again.' });
    }
  } else if (isProduction) {
    // Bypass number in production: no SMS, and the code is the fixed
    // DEV_FIXED_OTP the reviewers/QA handsets already know.
    console.log(`[requestOtp] Bypass number ${maskNumber(cleanNumber)}, SMS skipped.`);
  }

  res.json({
    success: true,
    message: 'OTP sent successfully',
    data: {
      mobileNumber: cleanNumber,
      // Only ever present outside production — in production the OTP only
      // ever reaches the buyer's phone via the SMS gateway above.
      ...(isProduction ? {} : { otp }),
      isRegistered: Boolean(existingCustomer),
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

  const otpRequest = await OtpRequest.findOne({ mobileNumber: cleanNumber }).lean();
  const codeExpiresAt = otpRequest?.otpExpiresAt || otpRequest?.expiresAt;
  if (!otpRequest || !otpRequest.otpHash || codeExpiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'OTP expired or not requested. Please request a new one.',
    });
  }

  // Take the attempt BEFORE checking the code, atomically. A read-then-save
  // counter let fifty parallel guesses all see "0 attempts so far".
  const reserved = await OtpRequest.findOneAndUpdate(
    { _id: otpRequest._id, otpHash: otpRequest.otpHash, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!reserved) {
    // Locked: the code is dead, but the row (and its resend window) stays.
    await OtpRequest.updateOne({ _id: otpRequest._id, otpHash: otpRequest.otpHash }, { $set: { otpHash: null } });
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts. Please request a new OTP.',
    });
  }

  if (!(await otpMatches(cleanNumber, cleanOtp, otpRequest.otpHash))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please try again.',
    });
  }

  // Single-use: consumed atomically, so two parallel correct submissions
  // cannot both sign in on one code.
  const consumed = await OtpRequest.findOneAndUpdate(
    { _id: otpRequest._id, otpHash: otpRequest.otpHash },
    { $set: { otpHash: null, attempts: 0 } }
  );
  if (!consumed) {
    return res.status(400).json({
      success: false,
      message: 'OTP expired or not requested. Please request a new one.',
    });
  }

  let user = await Customer.findOne({
    mobileNumber: cleanNumber,
    isDeleted: false,
  });

  let isNewUser = false;

  if (!user) {
    // New customer auto-registration
    isNewUser = true;
    try {
      user = await Customer.create({
        name: name?.trim() || `Customer ${cleanNumber.slice(-4)}`,
        mobileNumber: cleanNumber,
        isActive: true,
      });
    } catch (err) {
      // Concurrent verify-otp calls for the same number can both pass the
      // `!user` check above; the unique index on mobileNumber turns the
      // loser into a duplicate-key error instead of a duplicate account.
      if (err.code === 11000) {
        isNewUser = false;
        user = await Customer.findOne({ mobileNumber: cleanNumber, isDeleted: false });
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

  const { accessToken, refreshToken } = issueTokens(user);

  res.json({
    success: true,
    message: isNewUser
      ? 'Welcome to Krozenda! Account created and logged in.'
      : 'Welcome back! Logged in successfully.',
    isNewUser,
    data: {
      user: serializeCustomer(user),
      accessToken,
      refreshToken,
    },
  });
}

// POST /auth/refresh-token — trades a valid refresh token for a fresh access
// token (and a rotated refresh token). The account is re-checked on every
// call, so deactivating or deleting a customer kills their sessions at the
// next refresh rather than leaving a 30-day token live.
//
// Deliberately NOT behind protectUser: the whole point is that it is reachable
// when the access token has already expired.
async function refreshAccessToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ success: false, code: 'NO_REFRESH_TOKEN', message: 'Refresh token is required' });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken('user', refreshToken);
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Your session has expired. Please sign in again.',
    });
  }

  const user = await Customer.findById(decoded.id);
  if (!user || user.isDeleted || !user.isActive) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Your session is no longer valid. Please sign in again.',
    });
  }

  const tokens = issueTokens(user);
  res.json({ success: true, data: { ...tokens, user: serializeCustomer(user) } });
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
  const { name, email, dob, gender, mobileNumber, business } = req.body;

  if (email !== undefined && email) {
    if (!EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    const existing = await Customer.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user._id } });
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
      const existing = await Customer.findOne({ mobileNumber: cleanNumber, _id: { $ne: req.user._id } });
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
  if (business !== undefined && business) {
    const gstin = typeof business.gstin === 'string' ? business.gstin.trim().toUpperCase() : '';
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 15-character GSTIN' });
    }
    req.user.business = {
      companyName: typeof business.companyName === 'string' ? business.companyName.trim() : req.user.business?.companyName || '',
      gstin: gstin || req.user.business?.gstin || '',
      pan: typeof business.pan === 'string' ? business.pan.trim().toUpperCase() : req.user.business?.pan || '',
      tradeType: typeof business.tradeType === 'string' ? business.tradeType.trim() : req.user.business?.tradeType || '',
    };
  }

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

  const user = await Customer.findById(req.user._id).select('+password');
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
  const user = await Customer.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.isDeleted = true;
  user.isActive = false;
  // A deleted account gets no more pushes on any of its devices.
  user.fcmTokens = [];
  await user.save();

  res.json({ success: true, message: 'Account deleted successfully' });
}

// PUT /auth/language — see Controllers/languageController.js; the admin and
// vendor panels mount the same implementation against their own collections.
const updateLanguage = updateLanguageFor(Customer, (req) => req.user._id);

module.exports = {
  requestOtp,
  updateLanguage,
  verifyOtp,
  refreshAccessToken,
  getMe,
  updateProfile,
  uploadProfileImage,
  changePassword,
  deleteAccount,
  // Exported so the bypass list can be asserted directly: isProduction is
  // frozen at module load, so a test can't otherwise reach the production
  // branch of requestOtp without re-requiring the whole app.
  isBypassNumber,
};
