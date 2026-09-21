// One-off backfill: sets Product.fulfillmentProvider = 'CJ' for every
// product already linked to a CJ ProductFulfillmentMapping.
//
// Why this exists: `fulfillmentProvider` was added after CJ onboarding was
// already live, so it is only set going forward by cjOnboardingService.
// Anything onboarded before that ships with the field missing, which makes
// it invisible to the public catalog's "dropship only" filter. Safe to run
// any number of times — it only touches products currently missing the flag.
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);

  const Product = require('./Models/Product');
  const ProductFulfillmentMapping = require('./Models/ProductFulfillmentMapping');

  const productIds = await ProductFulfillmentMapping.find({ provider: 'CJ' }).distinct('product');
  console.log(`Found ${productIds.length} CJ-mapped product(s).`);

  const result = await Product.updateMany(
    { _id: { $in: productIds }, fulfillmentProvider: { $ne: 'CJ' } },
    { $set: { fulfillmentProvider: 'CJ' } }
  );

  console.log(`Backfilled fulfillmentProvider='CJ' on ${result.modifiedCount} product(s).`);
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
