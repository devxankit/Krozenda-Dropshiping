const jwt = require('jsonwebtoken');

// One secret per audience, falling back to JWT_SECRET when a role-specific
// secret isn't set yet (vendor/user auth land later).
const SECRETS = {
  admin: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET,
  vendor: process.env.JWT_VENDOR_SECRET || process.env.JWT_SECRET,
  user: process.env.JWT_SECRET,
};

const AUDIENCES = Object.keys(SECRETS);

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

// Audience-agnostic verification, for the handful of endpoints that any
// signed-in account may call regardless of what it is (see
// protectAnyAccount). The `aud` claim is read off the UNVERIFIED payload
// purely to choose a secret — verifyToken then does the real signature check
// and re-asserts the claim, so a forged audience only ever means the wrong
// secret and a rejected token.
function verifyAnyToken(token) {
  const decoded = jwt.decode(token);
  const aud = typeof decoded === 'object' && decoded ? decoded.aud : null;

  if (!AUDIENCES.includes(aud)) {
    const err = new Error('Invalid token audience');
    err.status = 401;
    throw err;
  }

  return { aud, decoded: verifyToken(aud, token) };
}

module.exports = { signToken, verifyToken, verifyAnyToken, AUDIENCES };
