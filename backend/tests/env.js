// Runs inside each test file's environment, after @shelf/jest-mongodb's
// MongoEnvironment has already started (or attached to) an in-memory
// mongod and exposed its URI as global.__MONGO_URI__ — see
// node_modules/@shelf/jest-mongodb's environment.js. Real secrets
// (JWT/Razorpay keys) still come from the project's own .env; only the
// environment flag and DB target are overridden here.
require('dotenv').config();

process.env.ENV = 'test';
process.env.MONGODB_URL = global.__MONGO_URI__ || process.env.MONGO_URL;
// Uploads (KYC PDFs, product images) go to a temp folder, not backend/uploads,
// so a test run leaves nothing behind in the real uploads directory.
process.env.UPLOADS_DIR = require('path').join(require('os').tmpdir(), 'krozenda-test-uploads');
