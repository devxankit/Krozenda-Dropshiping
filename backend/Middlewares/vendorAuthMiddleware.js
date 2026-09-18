const Vendor = require('../Models/Vendor');
const { verifyToken } = require('../utils/jwt');

// Login/`me` must work regardless of verificationStatus — a pending or
// rejected vendor still needs to sign in to see their status and resubmit.
// Gating on approval happens at the route/UI layer, not here.
async function protectVendor(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = verifyToken('vendor', token);
    const vendor = await Vendor.findById(decoded.id);

    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }

    // A brand-new vendor is APPROVED=false/isActive=false by default and must
    // still be able to log in to see their pending status (see comment
    // above) — so this only blocks the OTHER case isActive=false covers: an
    // admin deactivating/suspending a vendor that was already APPROVED
    // (adminVendorController.js toggleActive). That vendor's still-valid JWT
    // must stop working immediately, not just at its next login.
    if (vendor.verificationStatus === 'APPROVED' && !vendor.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.vendor = vendor;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

module.exports = { protectVendor };
