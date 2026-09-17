const jwt = require('jsonwebtoken');

// One secret per audience, falling back to JWT_SECRET when a role-specific
// secret isn't set yet (vendor/user auth land later).
const SECRETS = {
  admin: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET,
  vendor: process.env.JWT_VENDOR_SECRET || process.env.JWT_SECRET,
  user: process.env.JWT_SECRET,
};

const AUDIENCES = Object.keys(SECRETS);

// Access tokens are deliberately short-lived for the buyer audience: the
// client refreshes them silently via POST /auth/refresh-token (see
// userAuthController.refreshAccessToken), so a stolen access token is only
// useful for minutes rather than a week. Admin/vendor keep the 7d default
// until their panels grow a matching refresh flow — changing it here without
// a refresh endpoint on their side would just sign those users out.
const ACCESS_TOKEN_TTL = { user: '1h', admin: '7d', vendor: '7d' };
const REFRESH_TOKEN_TTL = '30d';

function signToken(aud, payload, options = {}) {
  return jwt.sign(payload, SECRETS[aud], {
    expiresIn: ACCESS_TOKEN_TTL[aud] || '7d',
    ...options,
    audience: aud,
  });
}

// A refresh token is the same signature scheme with a `typ` claim, so one can
// never be swapped for the other: verifyToken rejects a refresh token at a
// protected route (it carries typ: 'refresh'), and verifyRefreshToken rejects
// an access token at the refresh endpoint (it carries no typ).
function signRefreshToken(aud, payload, options = {}) {
  return jwt.sign({ ...payload, typ: 'refresh' }, SECRETS[aud], {
    expiresIn: REFRESH_TOKEN_TTL,
    ...options,
    audience: aud,
  });
}

function verifyRefreshToken(aud, token) {
  const decoded = verifyToken(aud, token);
  if (decoded.typ !== 'refresh') {
    const err = new Error('Not a refresh token');
    err.status = 401;
    throw err;
  }
  return decoded;
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

// Guard for the protected-route path: a refresh token must never be usable
// as a bearer credential, or its 30-day life would defeat the short access
// token entirely.
function verifyAccessToken(aud, token) {
  const decoded = verifyToken(aud, token);
  if (decoded.typ === 'refresh') {
    const err = new Error('Refresh token cannot be used as an access token');
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

module.exports = {
  signToken,
  signRefreshToken,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAnyToken,
  AUDIENCES,
};
