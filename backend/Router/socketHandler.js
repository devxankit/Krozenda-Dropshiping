const { verifyAnyToken } = require('../utils/jwt');

// Realtime fan-out for notifications and order/shipment state.
//
// The handshake is AUTHENTICATED, and that is the whole design constraint: an
// unauthenticated socket used to be allowed to connect and then, if it had
// been allowed to name its own room, could have subscribed to any seller's
// order feed. So a connection with no valid token is refused outright, and
// the rooms a socket joins are derived from the token — never from anything
// the client sends.
//
// Rooms:
//   user:<id>    a buyer's own notifications and order updates
//   vendor:<id>  one seller's orders, returns and payouts
//   admin        the admin and staff whose role covers the admin-wide feed
//
// The token is read from `auth.token` (socket.io's own channel for it) rather
// than a query parameter, because query strings end up in server and proxy
// access logs.

// The admin room carries platform-wide alerts (high-value orders, failed
// payouts, CJ failures). A staff role gets it only with dashboard access —
// the same key that shows those figures on the dashboard.
const ADMIN_FEED_PERMISSION = 'admin.dashboard.view';

/**
 * Who a handshake token belongs to, and which rooms they may join. Throws on
 * anything that must not connect: a bad or refresh token, or an account that
 * no longer exists or has been switched off — the same rules the REST
 * middlewares apply (protectUser / protectVendor / protectAdmin).
 */
async function authenticateSocket(token) {
  if (!token) throw new Error('UNAUTHENTICATED');
  let aud;
  let decoded;
  try {
    ({ aud, decoded } = verifyAnyToken(token));
  } catch {
    throw new Error('UNAUTHENTICATED');
  }
  // A 30-day refresh token is for /auth/refresh-token only.
  if (decoded.typ === 'refresh') throw new Error('UNAUTHENTICATED');

  if (aud === 'user') {
    const Customer = require('../Models/Customer');
    const user = await Customer.findById(decoded.id).select('isActive isDeleted').lean();
    if (!user || user.isDeleted || !user.isActive) throw new Error('UNAUTHENTICATED');
    return { aud, subjectId: decoded.id, rooms: [`user:${decoded.id}`] };
  }

  if (aud === 'vendor') {
    const Vendor = require('../Models/Vendor');
    const vendor = await Vendor.findById(decoded.id).select('verificationStatus isActive').lean();
    if (!vendor || (vendor.verificationStatus === 'APPROVED' && !vendor.isActive)) throw new Error('UNAUTHENTICATED');
    return { aud, subjectId: decoded.id, rooms: [`vendor:${decoded.id}`] };
  }

  if (aud === 'admin') {
    const User = require('../Models/User');
    const account = await User.findById(decoded.id).select('role isActive isDeleted roleId').populate('roleId', 'permissions isActive').lean();
    if (!account || account.isDeleted || !account.isActive) throw new Error('UNAUTHENTICATED');
    const permissions = account.roleId && account.roleId.isActive !== false ? account.roleId.permissions || [] : [];
    const seesAdminFeed = account.role === 'admin' || permissions.includes(ADMIN_FEED_PERMISSION);
    return { aud, subjectId: decoded.id, rooms: seesAdminFeed ? ['admin'] : [] };
  }

  throw new Error('UNAUTHENTICATED');
}

function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const identity = await authenticateSocket(socket.handshake.auth?.token);
      // Stored on the socket, so nothing downstream has to re-read the token
      // or trust a client-supplied id.
      socket.data.audience = identity.aud;
      socket.data.subjectId = identity.subjectId;
      socket.data.rooms = identity.rooms;
      return next();
    } catch {
      // A plain Error here is delivered to the client's connect_error handler,
      // which is what the frontend listens for to stop retrying.
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    for (const room of socket.data.rooms) socket.join(room);

    // Deliberately no client-driven `join` event. Rooms come from the token
    // and nowhere else; an event that let a socket name its own room would
    // undo the check above.
    socket.on('disconnect', () => {});
  });

  // Handed to emitters (see utils/realtime) so they never import io directly
  // and so a server started without sockets simply no-ops.
  registerSocketHandlers.io = io;
  return io;
}

registerSocketHandlers.authenticateSocket = authenticateSocket;
module.exports = registerSocketHandlers;
