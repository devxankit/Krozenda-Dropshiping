const User = require('../Models/User');
const Customer = require('../Models/Customer');
const Vendor = require('../Models/Vendor');
const { verifyAnyToken } = require('../utils/jwt');

// One collection per audience. The `user` audience is a buyer and resolves
// to Customer; `admin` covers both admins and staff, who share User and are
// separated by `role` there.
const OWNER_MODELS = { user: Customer, admin: User, vendor: Vendor };

// Accepts a signed-in account of ANY audience and hands the route the model
// it lives in. Only for endpoints that are byte-for-byte identical for
// buyers, vendors, admins and staff (push token registration) — every
// role-specific route keeps its own protect* middleware, because this one
// deliberately says nothing about what the caller is allowed to do.
async function protectAnyAccount(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const { aud, decoded } = verifyAnyToken(token);
    const model = OWNER_MODELS[aud];
    const account = await model.findById(decoded.id);

    if (!account || account.isDeleted) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }

    // Vendors stay reachable while PENDING/REJECTED (see protectVendor), and
    // their isActive defaults to false until approval — so only the User side
    // gates on it, matching protectUser/protectAdmin.
    if ((model === User || model === Customer) && !account.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.account = { model, doc: account, audience: aud };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

module.exports = { protectAnyAccount };
