const Vendor = require('../Models/Vendor');
const { signToken } = require('../utils/jwt');
const { getImageUrl } = require('../utils/imageHelper');

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
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

async function register(req, res) {
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
  } = req.body;

  if (!vendorType || !['B2C', 'B2B'].includes(vendorType)) {
    return res.status(400).json({ success: false, message: 'Vendor type must be B2C or B2B' });
  }

  if (!name?.trim() || !email?.trim() || !mobile?.trim() || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, mobile and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const isGstRegistered = gstRegistered === true || gstRegistered === 'true';
  if (isGstRegistered && !business?.gstin?.trim()) {
    return res.status(400).json({ success: false, message: 'GSTIN is required when GST registered is Yes' });
  }

  if (vendorType === 'B2B') {
    if (!business?.businessName?.trim() || !business?.businessType) {
      return res
        .status(400)
        .json({ success: false, message: 'Business name and business type are required for B2B vendors' });
    }
    if (!contactPerson?.name?.trim() || !contactPerson?.mobile?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Authorized contact person name and mobile are required for B2B vendors' });
    }
  }

  const existing = await Vendor.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
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
    verificationStatus: 'PENDING',
    isActive: false,
  });

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

module.exports = { register, login, me, updateProfile, submitForVerification, serializeVendor };
