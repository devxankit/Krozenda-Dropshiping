const path = require('path');

// Where uploaded and downloaded images/documents live on disk, and what
// app.js serves at /uploads. UPLOADS_DIR overrides it — the test suite points
// it at a temp folder so running the tests never leaves files (KYC PDFs,
// product images) in the real uploads directory.
const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

module.exports = { UPLOADS_ROOT };
