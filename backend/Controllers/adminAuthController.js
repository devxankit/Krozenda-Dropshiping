const User = require('../Models/User');
const { signToken } = require('../utils/jwt');
const { updateLanguageFor } = require('./languageController');

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

module.exports = { login, me, updateLanguage, updateProfile, changePassword };

