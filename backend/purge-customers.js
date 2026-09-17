// DESTRUCTIVE. Removes every buyer account and everything derived from it.
//
//   npm run purge:customers                       -- dry run, counts only
//   npm run purge:customers -- --apply --i-understand   -- actually deletes
//
// Both flags are required to write. --apply alone does nothing, so this
// cannot be triggered by autocompleting a half-typed command.
//
// WHAT GOES
//   Buyer accounts (customers, and users with role 'customer'), and every
//   document owned by or derived from them: orders, cart, wishlist, addresses,
//   wallet transactions, reviews, return requests, buyer support tickets,
//   buyer notifications, AI chats, coupon redemptions — plus the rows hanging
//   off those orders (RTOs, settlements, accounting entries), which would
//   otherwise point at orders that no longer exist.
//
// WHAT STAYS
//   Admins and staff, sellers, the product catalog, categories, brands,
//   banners, CMS pages, FAQs, coupons themselves, commission rules and
//   vendor-raised tickets. None of those belong to a buyer.
//
// COUNTERS
//   Product.rating / Product.reviewsCount and Coupon.usedCount are
//   denormalised copies of data this script deletes. They are recomputed at
//   the end, otherwise the storefront would keep showing ratings from reviews
//   that no longer exist and coupons would stay "used up" forever.
//
// NOT UNDOABLE. Take a backup first.

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./Config/db');

const CLI_APPLY = process.argv.includes('--apply');
const CLI_CONFIRM = process.argv.includes('--i-understand');

async function run({ apply = CLI_APPLY, confirm = CLI_CONFIRM, connect = true, close = true } = {}) {
  if (connect) await connectDB();
  const db = mongoose.connection.db;
  const c = (name) => db.collection(name);

  const writing = apply && confirm;

  console.log(`\nDatabase: ${mongoose.connection.name}`);
  console.log(writing ? 'Mode: APPLY — THIS WILL DELETE\n' : 'Mode: DRY RUN (no writes)\n');

  // --- Identify every buyer, in both places they can currently live --------
  const [newCustomers, legacyBuyers] = await Promise.all([
    c('customers').find({}, { projection: { _id: 1 } }).toArray(),
    c('users').find({ role: 'customer' }, { projection: { _id: 1 } }).toArray(),
  ]);

  const buyerIds = [...new Set([...newCustomers, ...legacyBuyers].map((d) => d._id.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  console.log(`  buyers in customers : ${newCustomers.length}`);
  console.log(`  buyers in users     : ${legacyBuyers.length}`);
  console.log(`  distinct buyers     : ${buyerIds.length}\n`);

  if (buyerIds.length === 0) {
    console.log('  No buyers found. Nothing to do.\n');
    if (close) await mongoose.connection.close();
    return { buyers: 0, deleted: {} };
  }

  // Orders are the hinge: several collections reference them rather than the
  // buyer, so their ids are needed before the orders themselves go.
  const orders = await c('orders')
    .find({ user: { $in: buyerIds } }, { projection: { _id: 1, 'items.product': 1, couponCode: 1 } })
    .toArray();
  const orderIds = orders.map((o) => o._id);

  // Products that will need their review counters recomputed.
  const reviewedProducts = await c('reviews').distinct('product', { user: { $in: buyerIds } });

  const byBuyer = { $in: buyerIds };
  const byOrder = { $in: orderIds };

  // Ordered so that anything referencing orders goes before the orders do.
  const TARGETS = [
    // Derived from orders
    ['rtos', { order: byOrder }, 'RTO records for those orders'],
    ['settlements', { order: byOrder }, 'settlement lines for those orders'],
    ['accountingtransactions', { $or: [{ order: byOrder }, { customer: byBuyer }] }, 'ledger entries'],

    // Owned by the buyer
    ['orders', { user: byBuyer }, 'orders'],
    ['addresses', { user: byBuyer }, 'saved addresses'],
    ['carts', { user: byBuyer }, 'carts'],
    ['wishlists', { user: byBuyer }, 'wishlists'],
    ['wallettransactions', { user: byBuyer }, 'wallet transactions'],
    ['reviews', { user: byBuyer }, 'reviews'],
    ['returnrequests', { user: byBuyer }, 'return requests'],
    ['aiconversations', { user: byBuyer }, 'AI conversations'],
    ['aimessages', { user: byBuyer }, 'AI messages'],
    ['couponredemptions', { userId: byBuyer }, 'coupon redemptions'],
    ['couponuserusages', { userId: byBuyer }, 'coupon usage counters'],

    // Shared collections — buyer rows only. Vendor-raised tickets and
    // vendor-targeted notifications are left alone.
    ['tickets', { user: byBuyer, raisedByRole: 'customer' }, 'buyer support tickets'],
    ['notifications', { user: byBuyer }, 'buyer notifications'],

    // The accounts themselves, last.
    ['customers', {}, 'buyer accounts (customers)'],
    ['users', { role: 'customer' }, 'buyer accounts (legacy, in users)'],
  ];

  const deleted = {};
  let total = 0;

  for (const [collection, filter, label] of TARGETS) {
    const count = await c(collection).countDocuments(filter);
    if (count === 0) continue;

    if (writing) {
      const res = await c(collection).deleteMany(filter);
      deleted[collection] = res.deletedCount;
      total += res.deletedCount;
      console.log(`  deleted ${String(res.deletedCount).padStart(6)}  ${label}`);
    } else {
      deleted[collection] = count;
      total += count;
      console.log(`  would delete ${String(count).padStart(6)}  ${label}`);
    }
  }

  console.log(`\n  ${writing ? 'deleted' : 'would delete'}: ${total} documents`);

  // --- Recompute the denormalised counters --------------------------------
  if (writing) {
    if (reviewedProducts.length) {
      // Any surviving reviews (there should be none, but do not assume) are
      // re-aggregated; products left with nothing go back to the "no reviews
      // yet" state the storefront checks for.
      const surviving = await c('reviews')
        .aggregate([
          { $match: { product: { $in: reviewedProducts } } },
          { $group: { _id: '$product', rating: { $avg: '$rating' }, count: { $sum: 1 } } },
        ])
        .toArray();
      const bySurviving = new Map(surviving.map((r) => [r._id.toString(), r]));

      const ops = reviewedProducts.map((productId) => {
        const row = bySurviving.get(productId.toString());
        return {
          updateOne: {
            filter: { _id: productId },
            update: {
              $set: {
                rating: row ? Math.round(row.rating * 10) / 10 : 0,
                reviewsCount: row ? row.count : 0,
              },
            },
          },
        };
      });
      if (ops.length) await c('products').bulkWrite(ops);
      console.log(`  recomputed review counters on ${ops.length} product(s)`);
    }

    // Coupons are not deleted, but their usage counters counted redemptions
    // that no longer exist.
    const remaining = await c('couponredemptions')
      .aggregate([{ $group: { _id: '$couponId', count: { $sum: 1 } } }])
      .toArray();
    const byCoupon = new Map(remaining.map((r) => [r._id ? r._id.toString() : '', r.count]));
    const coupons = await c('coupons').find({}, { projection: { _id: 1 } }).toArray();
    if (coupons.length) {
      await c('coupons').bulkWrite(
        coupons.map((coupon) => ({
          updateOne: {
            filter: { _id: coupon._id },
            update: { $set: { usedCount: byCoupon.get(coupon._id.toString()) || 0 } },
          },
        }))
      );
      console.log(`  recomputed usedCount on ${coupons.length} coupon(s)`);
    }
  }

  if (!writing) {
    console.log('\n  Dry run only. Nothing was written.');
    console.log('  To actually delete:  npm run purge:customers -- --apply --i-understand\n');
  } else {
    console.log('\n  Done.');
    // Stock was decremented when those orders were placed and is NOT restored
    // here: silently adding it back would double-count against a reseed, and
    // only you know which of the two you want.
    console.log('  NOTE: product stock is unchanged. Deleted orders had already');
    console.log('        decremented it — re-run `npm run seed` if you want the');
    console.log('        catalog back at its seeded quantities.\n');
  }

  if (close) await mongoose.connection.close();
  return { buyers: buyerIds.length, deleted, applied: writing };
}

if (require.main === module) {
  if (CLI_APPLY && !CLI_CONFIRM) {
    console.error('\nRefusing to run: --apply also needs --i-understand.');
    console.error('This permanently deletes every buyer account and all their data.\n');
    process.exit(1);
  }
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nPurge failed:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
