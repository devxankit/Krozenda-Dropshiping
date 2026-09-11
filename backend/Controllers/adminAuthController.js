const User = require('../Models/User');
const { signToken } = require('../utils/jwt');

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

module.exports = { login, me };
