const User = require('../Models/User');
const { verifyToken } = require('../utils/jwt');

async function protectUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = verifyToken('user', token);
    const user = await User.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

module.exports = { protectUser };
