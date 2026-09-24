// One-off backfill: shortens the variant names of CJ products onboarded
// before import started doing it (see utils/variantLabels.js).
//
//   "Hole-shaped Silicone Phone Storage Case White 16×10×3cm"  ->  "White"
//
// Only the live product is touched. Orders already placed keep the name they
// were bought under — order lines are a snapshot on purpose.
//
//   node backfill-cj-variant-names.js            # show what would change
//   node backfill-cj-variant-names.js --apply    # write it
//
// Safe to run any number of times: names that are already short come out of
// the same rule unchanged.
require('dotenv').config();
const mongoose = require('mongoose');
const { shortVariantLabels } = require('./utils/variantLabels');

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URL);

  const Product = require('./Models/Product');
  const ProductFulfillmentMapping = require('./Models/ProductFulfillmentMapping');

  const mappedIds = await ProductFulfillmentMapping.find({ provider: 'CJ' }).distinct('product');
  const products = await Product.find({
    $or: [{ fulfillmentProvider: 'CJ' }, { _id: { $in: mappedIds } }],
    'variants.1': { $exists: true },
  });

  let changedProducts = 0;
  for (const product of products) {
    const labels = shortVariantLabels(product.variants.map((v) => v.name));
    const changes = product.variants
      .map((v, idx) => ({ variant: v, from: v.name, to: labels[idx] }))
      .filter(({ from, to }) => to && to !== from);
    if (changes.length === 0) continue;

    changedProducts += 1;
    console.log(`\n${product.name} (${product._id})`);
    changes.forEach(({ from, to }) => console.log(`  "${from}"  ->  "${to}"`));

    if (apply) {
      changes.forEach(({ variant, to }) => {
        variant.name = to;
      });
      await product.save();
    }
  }

  console.log(
    `\n${changedProducts} product(s) ${apply ? 'updated' : 'would change'}.${apply ? '' : ' Re-run with --apply to write.'}`
  );
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
