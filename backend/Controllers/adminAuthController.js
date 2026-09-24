const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../Models/User');
const AdminPasswordReset = require('../Models/AdminPasswordReset');
const { signToken } = require('../utils/jwt');
const { updateLanguageFor } = require('./languageController');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — matches ForgotPasswordPage copy.
const MAX_RESET_ATTEMPTS = 5;
const isProduction = process.env.ENV === 'production';

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim(), isDeleted: false })
    .select('+password')
    .populate('roleId');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  // Login runs before protectAdmin exists for this request, so the audit
  // middleware learns who signed in from here.
  res.locals.auditActor = user;

  const permissions = user.role === 'admin' ? [] : user.roleId?.permissions || [];

  const token = signToken('admin', {
    id: user._id,
    role: user.role,
    permissions,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        roleId: user.roleId?._id || null,
        roleName: user.roleId?.name || null,
        permissions,
        // Null is passed through deliberately — the client reads it as "this
        // account has never chosen" and keeps whatever this machine was
        // already showing, rather than resetting it to English.
        language: user.language || null,
      },
    },
  });
}

async function me(req, res) {
  res.json({
    success: true,
    data: {
      admin: req.admin,
      permissions: req.permissions,
    },
  });
}

// POST /admin/auth/forgot-password — always answers the same way whether or
// not the email belongs to an admin/staff account, so this endpoint can't be
// used to enumerate accounts. Mirrors vendorAuthController.forgotPassword;
// the only difference is a link-style token (this UI promises a "reset
// link") instead of a typed OTP.
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, isDeleted: false });

  let devToken;
  if (user) {
    const token = generateResetToken();
    const tokenHash = await bcrypt.hash(token, 10);
    await AdminPasswordReset.findOneAndUpdate(
      { email: normalizedEmail },
      { tokenHash, attempts: 0, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      { upsert: true }
    );

    if (!isProduction) {
      console.log(`[dev-only] Admin password reset token for ${normalizedEmail}: ${token}`);
      devToken = token;
    }
  }

  res.json({
    success: true,
    message: 'If an account exists for this email, a reset link has been sent.',
    // Only ever present outside production, where there is no real email
    // gateway configured yet — never echoed once one is wired up.
    data: devToken ? { token: devToken } : undefined,
  });
}

// POST /admin/auth/reset-password
async function resetPassword(req, res) {
  const { email, token, password, confirmPassword } = req.body;

  if (!email?.trim() || !token?.trim()) {
    return res.status(400).json({ success: false, message: 'Email and reset token are required' });
  }
  if (!password || password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 12 characters and include a capital letter and a number',
    });
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const resetRequest = await AdminPasswordReset.findOne({ email: normalizedEmail });

  if (!resetRequest || resetRequest.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: 'This reset link has expired. Request a new one.' });
  }

  if (resetRequest.attempts >= MAX_RESET_ATTEMPTS) {
    await AdminPasswordReset.deleteOne({ _id: resetRequest._id });
    return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Request a new link.' });
  }

  const isMatch = await bcrypt.compare(token.trim(), resetRequest.tokenHash);
  if (!isMatch) {
    resetRequest.attempts += 1;
    await resetRequest.save();
    return res.status(400).json({ success: false, message: 'Incorrect or expired reset link' });
  }

  const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
  if (!user) {
    await AdminPasswordReset.deleteOne({ _id: resetRequest._id });
    return res.status(404).json({ success: false, message: 'Account not found' });
  }

  user.password = password;
  await user.save();
  await AdminPasswordReset.deleteOne({ _id: resetRequest._id });

  res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
}

// PUT /admin/auth/language
const updateLanguage = updateLanguageFor(User, (req) => req.admin._id);

async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.admin._id).populate('roleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const { name, email, mobileNumber } = req.body;

    if (email && email.toLowerCase().trim() !== user.email) {
      const existing = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: user._id },
        isDeleted: false,
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (mobileNumber !== undefined) {
      const trimmedMobile = mobileNumber ? String(mobileNumber).trim() : null;
      if (trimmedMobile && trimmedMobile !== user.mobileNumber) {
        const existingMobile = await User.findOne({
          mobileNumber: trimmedMobile,
          _id: { $ne: user._id },
          isDeleted: false,
        });
        if (existingMobile) {
          return res.status(400).json({ success: false, message: 'Mobile number is already registered' });
        }
      }
      user.mobileNumber = trimmedMobile;
    }

    if (name) {
      user.name = name.trim();
    }

    if (req.file?.url) {
      user.image = req.file.url;
    } else if (req.body.image !== undefined) {
      user.image = req.body.image;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        admin: {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
          mobileNumber: user.mobileNumber,
          role: user.role,
          roleId: user.roleId?._id || user.roleId || null,
          roleName: user.roleId?.name || null,
          permissions: req.permissions,
          language: user.language || null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update profile' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
    }

    const user = await User.findById(req.admin._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (user.password && currentPassword) {
      const match = await user.comparePassword(currentPassword);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to change password' });
  }
}

module.exports = { login, me, updateLanguage, updateProfile, changePassword, forgotPassword, resetPassword };

