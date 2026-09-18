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
//   admin        every admin and staff session
//
// The token is read from `auth.token` (socket.io's own channel for it) rather
// than a query parameter, because query strings end up in server and proxy
// access logs.

function roomsFor(aud, decoded) {
  if (aud === 'vendor') return [`vendor:${decoded.id}`];
  if (aud === 'user') return [`user:${decoded.id}`];
  if (aud === 'admin') return ['admin'];
  return [];
}

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // A plain Error here is delivered to the client's connect_error handler,
      // which is what the frontend listens for to stop retrying.
      return next(new Error('UNAUTHENTICATED'));
    }

    try {
      const { aud, decoded } = verifyAnyToken(token);
      const rooms = roomsFor(aud, decoded);
      if (rooms.length === 0) return next(new Error('UNAUTHENTICATED'));

      // Stored on the socket, so nothing downstream has to re-read the token
      // or trust a client-supplied id.
      socket.data.audience = aud;
      socket.data.subjectId = decoded.id;
      socket.data.rooms = rooms;
      return next();
    } catch {
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

module.exports = registerSocketHandlers;
