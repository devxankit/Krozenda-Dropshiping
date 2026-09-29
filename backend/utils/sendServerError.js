// For handlers that catch their own errors. Input the caller can fix (a
// Mongoose validation or cast error) is a 400 with its reason; anything else
// is a 500 that says only what failed — the error itself goes to the log,
// never to the client (driver messages can name collections, fields and
// internals). The global handler in app.js applies the same rule to errors
// that are not caught.
function sendServerError(res, err, fallbackMessage) {
  if (err && (err.name === 'ValidationError' || err.name === 'CastError')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(`[server] ${fallbackMessage}:`, err && err.stack ? err.stack : err);
  return res.status(500).json({ success: false, message: fallbackMessage });
}

module.exports = { sendServerError };
