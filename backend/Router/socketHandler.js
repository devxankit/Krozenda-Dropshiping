// TODO: authenticate the socket handshake and join role-specific rooms
// (admin / vendor:<id> / user:<id>) once notification and order/vendor
// status events are implemented.
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });
}

module.exports = registerSocketHandlers;
