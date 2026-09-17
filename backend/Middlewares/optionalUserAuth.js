const Customer = require('../Models/Customer');
const { verifyToken } = require('../utils/jwt');

async function optionalUserAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyToken('user', token);
    const user = await Customer.findById(decoded.id);

    if (user && !user.isDeleted && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = { optionalUserAuth };
