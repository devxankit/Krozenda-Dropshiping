// One-off backfill: assign a barcode to every product that predates the
// field (see Models/Product.js — new products get one automatically on
// creation; this is only for what existed before that).
//
//   npm run backfill:barcodes          -- dry run, reports only, writes nothing
//   npm run backfill:barcodes -- --apply   -- performs the write
//
// IDEMPOTENT — matches on { barcode: null }, so a product this has already
// touched is never revisited, and an interrupted run is safe to repeat.
//
// One at a time, not a bulk write: each barcode reserves the next number from
// the SAME counter live traffic is drawing from (Models/Counter.js), and a
// bulk operation would have to pre-reserve a whole block up front, which
// either over-reserves (numbers burned if the run is interrupted) or under-
// reserves (a race with a product created mid-run). A few hundred products is
// a few hundred round trips either way; this platform does not have millions.

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./Config/db');
const Product = require('./Models/Product');
const { generateBarcode } = require('./utils/barcode');

const CLI_APPLY = process.argv.includes('--apply');

async function run({ apply = CLI_APPLY, connect = true, close = true } = {}) {
  if (connect) await connectDB();

  const products = await Product.find({ barcode: null }).select('_id name').lean();
  console.log(`${products.length} product(s) with no barcode.`);

  let assigned = 0;
  for (const product of products) {
    const barcode = await generateBarcode();
    if (apply) {
      // Not `Product.create` and not a bulk update: going through the
      // document so the same pre-save guard that protects a normal create
      // (`if (!this.isNew || this.barcode) return`) is not what's assigning
      // this — this script assigns explicitly, on an existing document,
      // which the hook's `isNew` check would otherwise skip entirely.
      await Product.updateOne({ _id: product._id, barcode: null }, { $set: { barcode } });
    }
    console.log(`${apply ? 'assigned' : 'would assign'} ${barcode}  ${product.name}`);
    assigned += 1;
  }

  console.log(apply ? `Backfilled ${assigned} product(s).` : `Dry run — ${assigned} product(s) would be backfilled. Re-run with --apply.`);

  if (close) await mongoose.connection.close();
  return { total: products.length, assigned };
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { run };
