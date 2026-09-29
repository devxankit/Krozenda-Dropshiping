// One-off backfill: sets Product.vendorSuspended for every seller product,
// from the seller's current state (suspended / not approved → true).
//
// Why this exists: the flag was added after sellers were already live, and
// it is only maintained going forward (Vendor save hook, Product creation).
// Until this runs, products of a seller who was ALREADY suspended or
// unapproved stay on the storefront. Safe to run any number of times.
//
//   node backfill-vendor-suspended.js            dry run — prints counts only
//   node backfill-vendor-suspended.js --apply    writes
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URL);

  const Vendor = require('./Models/Vendor');
  const Product = require('./Models/Product');

  const trading = await Vendor.find({ verificationStatus: 'APPROVED', isActive: true }).distinct('_id');
  const toSuspend = { vendor: { $ne: null, $nin: trading }, vendorSuspended: { $ne: true } };
  const toRestore = { vendor: { $in: trading }, vendorSuspended: true };

  const [suspendCount, restoreCount] = await Promise.all([
    Product.countDocuments(toSuspend),
    Product.countDocuments(toRestore),
  ]);
  console.log(`${trading.length} seller(s) can trade.`);
  console.log(`${suspendCount} product(s) of non-trading sellers to hide; ${restoreCount} to restore.`);

  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  } else {
    const hidden = await Product.updateMany(toSuspend, { $set: { vendorSuspended: true } });
    const restored = await Product.updateMany(toRestore, { $set: { vendorSuspended: false } });
    console.log(`Hid ${hidden.modifiedCount}, restored ${restored.modifiedCount}.`);
  }
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
