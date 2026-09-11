const User = require('../Models/User');
const { verifyToken } = require('../utils/jwt');

async function protectAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = verifyToken('admin', token);
    const user = await User.findById(decoded.id).populate('roleId');

    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.admin = user;
    // Resolved fresh on every request (not baked into the JWT), so a role's
    // permissions changing takes effect immediately without re-login. Kept
    // separate from the Mongoose doc rather than assigned onto it, since
    // `permissions` is no longer a schema field on User.
    req.permissions = user.role === 'admin' ? [] : user.roleId?.permissions || [];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

// Admin-only routes (e.g. staff management) — staff can never pass this,
// regardless of their role's permissions[].
function requireRole(role) {
  return (req, res, next) => {
    if (!req.admin || req.admin.role !== role) {
      return res.status(403).json({ success: false, message: 'Not authorized for this action' });
    }
    next();
  };
}

// Admin bypasses all permission checks; staff must have the exact key on
// their assigned role.
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    if (req.admin.role === 'admin' || req.permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({ success: false, message: 'You do not have access to this module' });
  };
}

module.exports = { protectAdmin, requireRole, requirePermission };
