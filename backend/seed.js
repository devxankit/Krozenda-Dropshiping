// Manual seeder. Boot no longer seeds anything, so run this explicitly
// (`npm run seed`) when a database needs the admin, demo vendors and catalog.
require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('./Config/db');
const ensureAdmin = require('./Router/seedAdmin');
const ensureDemoVendors = require('./Router/seedVendors');
const seedCatalog = require('./Router/seedCatalog');

async function run() {
  await connectDB();
  await ensureAdmin();
  await ensureDemoVendors();
  await seedCatalog();
  await mongoose.connection.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
