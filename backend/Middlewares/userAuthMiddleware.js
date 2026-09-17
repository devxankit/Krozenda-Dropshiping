const Customer = require('../Models/Customer');
const { verifyAccessToken } = require('../utils/jwt');

async function protectUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = verifyAccessToken('user', token);
    const user = await Customer.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    // TOKEN_EXPIRED is what tells the client to try a silent refresh rather
    // than bin the session — every other 401 here means the token is
    // structurally bad and refreshing it would be pointless.
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: expired ? 'Your session has expired. Please sign in again.' : 'Not authorized, invalid token',
    });
  }
}

module.exports = { protectUser };
