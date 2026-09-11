const jwt = require('jsonwebtoken');

// One secret per audience, falling back to JWT_SECRET when a role-specific
// secret isn't set yet (vendor/user auth land later).
const SECRETS = {
  admin: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET,
  vendor: process.env.JWT_VENDOR_SECRET || process.env.JWT_SECRET,
  user: process.env.JWT_SECRET,
};

function signToken(aud, payload, options = {}) {
  return jwt.sign(payload, SECRETS[aud], { expiresIn: '7d', ...options, audience: aud });
}

function verifyToken(aud, token) {
  const decoded = jwt.verify(token, SECRETS[aud]);

  // Explicit check so a cross-role token is rejected even if the secrets
  // ever ended up matching (e.g. all three fell back to JWT_SECRET).
  if (decoded.aud !== aud) {
    const err = new Error('Invalid token audience');
    err.status = 401;
    throw err;
  }

  return decoded;
}

module.exports = { signToken, verifyToken };
