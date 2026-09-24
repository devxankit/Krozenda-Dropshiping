// One-off migration for split checkouts (a CJ dropship order + a standard
// order paid by one Razorpay payment) and per-variant returns.
//
// Why this exists: MongoDB never drops an index just because the schema
// stopped declaring it. The old unique indexes
//   Order          razorpayPaymentId_1         (one order per payment)
//   Order          user_1_idempotencyKey_1     (one order per checkout key)
//   ReturnRequest  order_1_product_1           (one return per product)
// would keep rejecting the second order of every split checkout, and the
// return for a second variant, until they are dropped. The replacements are
// declared in the models and created here.
//
// RUN THIS BEFORE DEPLOYING the split-order code. Safe to run any number of
// times — a legacy index that is already gone is skipped.
require('dotenv').config();
const mongoose = require('mongoose');

async function dropLegacy(Model) {
  const existing = new Set((await Model.collection.indexes()).map((index) => index.name));
  for (const name of Model.LEGACY_INDEX_NAMES) {
    if (!existing.has(name)) {
      console.log(`${Model.modelName}: ${name} already absent`);
      continue;
    }
    await Model.collection.dropIndex(name);
    console.log(`${Model.modelName}: dropped ${name}`);
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);

  const Order = require('./Models/Order');
  const ReturnRequest = require('./Models/ReturnRequest');

  for (const Model of [Order, ReturnRequest]) {
    await dropLegacy(Model);
    // createIndexes, not syncIndexes: syncIndexes would also drop any index
    // someone added by hand in production. This only adds what is missing.
    await Model.createIndexes();
    console.log(`${Model.modelName}: declared indexes created`);
  }

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Index migration failed:', err);
    process.exit(1);
  });
