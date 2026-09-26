// One-off backfill: COD orders that were delivered before the
// "COD is paid on delivery" rule (Models/Order.js, markCodPaidOnDelivery)
// still show payment PENDING. This marks them PAID.
//
// Only paymentStatus changes. codRemittedAt and the ledger are untouched —
// whether the courier has remitted the cash is still recorded separately.
//
//   node migrate-cod-delivered-paid.js            # show what would change
//   node migrate-cod-delivered-paid.js --apply    # write it
//
// Safe to run any number of times.
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URL);
  const Order = require('./Models/Order');

  const candidates = await Order.find({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: { $ne: 'CANCELLED' } })
    .select('_id status total items.status')
    .lean();
  const delivered = candidates.filter((order) => Order.isFullyDelivered(order));

  console.log(`${delivered.length} delivered COD order(s) still marked PENDING:`);
  delivered.forEach((order) => console.log(`  ${order._id} — ₹${order.total} (${order.status})`));

  if (apply && delivered.length > 0) {
    const result = await Order.updateMany(
      { _id: { $in: delivered.map((order) => order._id) }, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'PAID' } }
    );
    console.log(`\nMarked ${result.modifiedCount} order(s) PAID.`);
  } else if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
