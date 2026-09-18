const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Vendor = require('../Models/Vendor');
const VendorPasswordReset = require('../Models/VendorPasswordReset');
const { signToken } = require('../utils/jwt');
const { getImageUrl } = require('../utils/imageHelper');
const { updateLanguageFor } = require('./languageController');

const RESET_OTP_TTL_MS = 5 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
const isProduction = process.env.ENV === 'production';

function generateResetOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function serializeVendor(vendor) {
  return {
    id: vendor._id.toString(),
    vendorType: vendor.vendorType,
    name: vendor.name,
    email: vendor.email,
    mobile: vendor.mobile,
    profileImage: getImageUrl(vendor.profileImage),
    category: vendor.category ? vendor.category.toString() : null,
    gstRegistered: vendor.gstRegistered,
    business: vendor.business || {},
    contactPerson: vendor.contactPerson || {},
    address: vendor.address || {},
    bank: vendor.bank || {},
    verificationStatus: vendor.verificationStatus,
    rejectionReason: vendor.rejectionReason || '',
    isActive: vendor.isActive,
    // Null means the account has never chosen; see languageController.
    language: vendor.language || null,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

// Shared by the vendor's own sign-up and by an admin onboarding a partner
// from the panel, so the two can never disagree about what a valid B2B or
// B2C vendor looks like. Returns { error } or { vendor } rather than
// touching the response, since the two callers reply differently.
async function createVendorAccount(payload, { verificationStatus = 'PENDING', isActive = false } = {}) {
  const {
    vendorType,
    name,
    email,
    mobile,
    password,
    confirmPassword,
    category,
    gstRegistered,
    business,
    contactPerson,
    address,
    bank,
  } = payload;

  if (!vendorType || !['B2C', 'B2B'].includes(vendorType)) {
    return { error: { status: 400, message: 'Vendor type must be B2C or B2B' } };
  }

  if (!name?.trim() || !email?.trim() || !mobile?.trim() || !password) {
    return { error: { status: 400, message: 'Name, email, mobile and password are required' } };
  }

  if (password.length < 6) {
    return { error: { status: 400, message: 'Password must be at least 6 characters' } };
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { error: { status: 400, message: 'Passwords do not match' } };
  }

  const isGstRegistered = gstRegistered === true || gstRegistered === 'true';
  if (isGstRegistered && !business?.gstin?.trim()) {
    return { error: { status: 400, message: 'GSTIN is required when GST registered is Yes' } };
  }

  if (vendorType === 'B2B') {
    if (!business?.businessName?.trim() || !business?.businessType) {
      return { error: { status: 400, message: 'Business name and business type are required for B2B vendors' } };
    }
    if (!contactPerson?.name?.trim() || !contactPerson?.mobile?.trim()) {
      return {
        error: {
          status: 400,
          message: 'Authorized contact person name and mobile are required for B2B vendors',
        },
      };
    }
  }

  const existing = await Vendor.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return { error: { status: 409, message: 'An account with this email already exists' } };
  }

  const vendor = await Vendor.create({
    vendorType,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    mobile: mobile.trim(),
    password,
    category: category || null,
    gstRegistered: isGstRegistered,
    business: business || {},
    contactPerson: vendorType === 'B2B' ? contactPerson || {} : {},
    address: address || {},
    bank: bank || {},
    verificationStatus,
    isActive,
  });

  return { vendor };
}

async function register(req, res) {
  const { error, vendor } = await createVendorAccount(req.body);
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  const token = signToken('vendor', { id: vendor._id, vendorType: vendor.vendorType });

  res.status(201).json({
    success: true,
    message: 'Registration submitted. Continue to upload your documents.',
    data: { token, vendor: serializeVendor(vendor) },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!vendor || !(await vendor.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = signToken('vendor', { id: vendor._id, vendorType: vendor.vendorType });

  res.json({
    success: true,
    message: 'Login successful',
    data: { token, vendor: serializeVendor(vendor) },
  });
}

// POST /vendor/auth/forgot-password — always answers the same way whether
// or not the email is registered, so this endpoint can't be used to
// enumerate vendor accounts. The OTP itself is only ever generated (and, in
// dev, echoed back — see requestOtp in userAuthController.js for the same
// no-SMS-gateway-yet convention) when a matching vendor actually exists.
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const vendor = await Vendor.findOne({ email: normalizedEmail });

  let devOtp;
  if (vendor) {
    const otp = generateResetOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    await VendorPasswordReset.findOneAndUpdate(
      { email: normalizedEmail },
      { otpHash, attempts: 0, expiresAt: new Date(Date.now() + RESET_OTP_TTL_MS) },
      { upsert: true }
    );

    if (!isProduction) {
      console.log(`[dev-only] Vendor password reset OTP for ${normalizedEmail}: ${otp}`);
      devOtp = otp;
    }
  }

  res.json({
    success: true,
    message: 'If an account exists for this email, a reset code has been sent.',
    // Only ever present outside production, where there is no real email
    // gateway configured yet — never echoed once one is wired up.
    data: devOtp ? { otp: devOtp } : undefined,
  });
}

// POST /vendor/auth/reset-password
async function resetPassword(req, res) {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (!email?.trim() || !otp?.trim()) {
    return res.status(400).json({ success: false, message: 'Email and reset code are required' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const resetRequest = await VendorPasswordReset.findOne({ email: normalizedEmail });

  if (!resetRequest || resetRequest.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: 'This reset code has expired. Request a new one.' });
  }

  if (resetRequest.attempts >= MAX_RESET_ATTEMPTS) {
    await VendorPasswordReset.deleteOne({ _id: resetRequest._id });
    return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
  }

  const isMatch = await bcrypt.compare(otp.trim(), resetRequest.otpHash);
  if (!isMatch) {
    resetRequest.attempts += 1;
    await resetRequest.save();
    return res.status(400).json({ success: false, message: 'Incorrect reset code' });
  }

  const vendor = await Vendor.findOne({ email: normalizedEmail });
  if (!vendor) {
    await VendorPasswordReset.deleteOne({ _id: resetRequest._id });
    return res.status(404).json({ success: false, message: 'Account not found' });
  }

  vendor.password = newPassword;
  await vendor.save();
  await VendorPasswordReset.deleteOne({ _id: resetRequest._id });

  res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
}

async function me(req, res) {
  res.json({ success: true, data: { vendor: serializeVendor(req.vendor) } });
}

async function updateProfile(req, res) {
  const { name, mobile, category, gstRegistered, business, contactPerson, address, bank } = req.body;
  const vendor = req.vendor;

  if (name?.trim()) vendor.name = name.trim();
  if (mobile?.trim()) vendor.mobile = mobile.trim();
  if (category !== undefined) vendor.category = category || null;
  if (gstRegistered !== undefined) vendor.gstRegistered = gstRegistered === true || gstRegistered === 'true';
  if (business) vendor.business = { ...vendor.business.toObject(), ...business };
  if (contactPerson) vendor.contactPerson = { ...vendor.contactPerson.toObject(), ...contactPerson };
  if (address) vendor.address = { ...vendor.address.toObject(), ...address };
  if (bank) vendor.bank = { ...vendor.bank.toObject(), ...bank };

  await vendor.save();

  res.json({ success: true, message: 'Profile updated successfully', data: { vendor: serializeVendor(vendor) } });
}

// Moves the application into the review queue. Allowed from PENDING (first
// submission) and REJECTED (resubmission after fixing the flagged issue) —
// blocked once it's already being looked at or has been approved.
async function submitForVerification(req, res) {
  const vendor = req.vendor;

  if (!['PENDING', 'REJECTED'].includes(vendor.verificationStatus)) {
    return res.status(400).json({
      success: false,
      message: `Application cannot be submitted from status ${vendor.verificationStatus}`,
    });
  }

  vendor.verificationStatus = 'UNDER_REVIEW';
  vendor.rejectionReason = '';
  await vendor.save();

  res.json({
    success: true,
    message: 'Submitted for verification',
    data: { vendor: serializeVendor(vendor) },
  });
}

// PUT /vendor/auth/language — shared by the seller and partner panels, which
// are two front-ends over the same Vendor account.
const updateLanguage = updateLanguageFor(Vendor, (req) => req.vendor._id);

module.exports = {
  updateLanguage,
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  submitForVerification,
  serializeVendor,
  createVendorAccount,
};
