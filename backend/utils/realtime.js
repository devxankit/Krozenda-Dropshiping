// The one place anything emits over websockets.
//
// Two reasons it is a module rather than passing `io` around:
//
//  1. Controllers already take enough dependencies. A controller that wants to
//     tell a seller "you have a new order" should not also have to know how
//     the HTTP server was constructed.
//  2. The test suite and any script that imports `app` without `index.js` has
//     no socket server at all. Every function here no-ops in that case rather
//     than throwing, so nothing has to guard its own emit.

let io = null;

// Called once from index.js after the socket server exists.
function attachSocketServer(server) {
  io = server;
}

function emitTo(room, event, payload) {
  if (!io || !room) return false;
  try {
    io.to(room).emit(event, payload);
    return true;
  } catch {
    // A failed emit must never fail the request that triggered it — the row
    // is already written, and the client will see it on its next read.
    return false;
  }
}

// A notification row was created. The client uses this to bump the bell badge
// and prepend the row without polling.
function notifyUser(userId, notification) {
  return emitTo(`user:${userId}`, 'notification', notification);
}

function notifyVendor(vendorId, notification) {
  return emitTo(`vendor:${vendorId}`, 'notification', notification);
}

function notifyAdmins(notification) {
  return emitTo('admin', 'notification', notification);
}

// An order line moved. Sent to the buyer and to the seller who owns the line,
// so both sides of a marketplace order see the same state without a refresh.
function orderUpdated({ userId, vendorId, orderId, status }) {
  const payload = { orderId: String(orderId), status };
  if (userId) emitTo(`user:${userId}`, 'order:updated', payload);
  if (vendorId) emitTo(`vendor:${vendorId}`, 'order:updated', payload);
}

function shipmentUpdated({ vendorId, userId, shipmentId, orderId, status }) {
  const payload = { shipmentId: String(shipmentId), orderId: String(orderId), status };
  if (vendorId) emitTo(`vendor:${vendorId}`, 'shipment:updated', payload);
  if (userId) emitTo(`user:${userId}`, 'shipment:updated', payload);
}

module.exports = {
  attachSocketServer,
  emitTo,
  notifyUser,
  notifyVendor,
  notifyAdmins,
  orderUpdated,
  shipmentUpdated,
};
