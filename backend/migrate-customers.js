// One-off migration: move buyers out of `users` into their own `customers`
// collection.
//
//   npm run migrate:customers          -- dry run, reports only, writes nothing
//   npm run migrate:customers -- --apply   -- performs the copy
//
// WHAT IT DOES
//   Copies every `users` document with role: 'customer' into `customers`,
//   KEEPING THE SAME _id.
//
// WHY THE _id MATTERS
//   Every buyer-owned document (orders, addresses, cart, wishlist, reviews,
//   returns, tickets, wallet transactions, AI chats, coupon redemptions)
//   stores that ObjectId. Preserving it means not one of those references has
//   to be rewritten, and buyer JWTs issued before the migration keep working
//   — protectUser simply resolves the same id against the new collection.
//
// WHAT IT DOES NOT DO
//   It does not delete anything from `users`. The originals stay exactly where
//   they are, so a rollback is "point the code back at User" with no data
//   restore. Clean them up later, once you are confident, with --prune.
//
// IDEMPOTENT
//   Re-running skips buyers already present in `customers` (matched by _id),
//   so an interrupted run is safe to repeat.

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./Config/db');

// Read at call time rather than baked in at module load, so the test suite can
// drive the same code path with explicit options instead of rewriting argv.
const CLI_APPLY = process.argv.includes('--apply');
const CLI_PRUNE = process.argv.includes('--prune');

// Fields that belong to a buyer. `role`, `roleId` and `createdBy` are
// deliberately dropped — they are staff-permission concepts and a Customer
// document has no role to escalate through.
const CUSTOMER_FIELDS = [
  'name',
  'email',
  'password',
  'image',
  'mobileNumber',
  'gender',
  'dob',
  'walletBalance',
  'fcmTokens',
  'isActive',
  'isDeleted',
  'createdAt',
  'updatedAt',
];

function toCustomerDoc(user) {
  const doc = { _id: user._id };
  for (const field of CUSTOMER_FIELDS) {
    if (user[field] !== undefined) doc[field] = user[field];
  }
  // Defaults for documents predating a field.
  if (doc.walletBalance === undefined) doc.walletBalance = 0;
  if (doc.fcmTokens === undefined) doc.fcmTokens = [];
  if (doc.isActive === undefined) doc.isActive = true;
  if (doc.isDeleted === undefined) doc.isDeleted = false;
  return doc;
}

async function run({ apply = CLI_APPLY, prune = CLI_PRUNE, connect = true, close = true } = {}) {
  const APPLY = apply;
  const PRUNE = prune;

  if (connect) await connectDB();
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const customers = db.collection('customers');

  console.log(`\nDatabase: ${mongoose.connection.name}`);
  console.log(APPLY ? 'Mode: APPLY (will write)\n' : 'Mode: DRY RUN (no writes)\n');

  // Soft-deleted buyers are copied too: their orders still reference them, and
  // dropping them here would orphan that history.
  const buyers = await users.find({ role: 'customer' }).toArray();
  const existingIds = new Set(
    (await customers.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id.toString())
  );

  const toInsert = buyers.filter((u) => !existingIds.has(u._id.toString()));
  const alreadyThere = buyers.length - toInsert.length;

  console.log(`  buyers in users        : ${buyers.length}`);
  console.log(`  already in customers   : ${alreadyThere}`);
  console.log(`  to copy                : ${toInsert.length}`);

  // Surface collisions before writing anything, so the run either fully
  // succeeds or touches nothing.
  //
  // Duplicates *within* `users` cannot occur — email and mobileNumber are
  // uniquely indexed there. The case that does happen: a buyer who signed up
  // again after the split. That creates a fresh `customers` document with the
  // same email but a DIFFERENT _id, and copying their old `users` row on top
  // would hit the unique index. Those have to be reconciled by hand, because
  // only you can say which of the two accounts owns the order history.
  const existingByEmail = new Map();
  const existingByMobile = new Map();
  for (const c of await customers
    .find({}, { projection: { email: 1, mobileNumber: 1 } })
    .toArray()) {
    if (c.email) existingByEmail.set(String(c.email).toLowerCase(), c._id.toString());
    if (c.mobileNumber) existingByMobile.set(String(c.mobileNumber), c._id.toString());
  }

  const emails = new Map();
  const mobiles = new Map();
  const conflicts = [];

  for (const u of toInsert) {
    for (const [field, seen, existing] of [
      ['email', emails, existingByEmail],
      ['mobileNumber', mobiles, existingByMobile],
    ]) {
      const value = u[field];
      if (!value) continue;
      const key = field === 'email' ? String(value).toLowerCase() : String(value);

      const clash = existing.get(key);
      if (clash) {
        conflicts.push(
          `${field} "${value}": users/${u._id} would collide with existing customers/${clash}`
        );
        continue;
      }
      // Defensive: unique indexes on `users` should already rule this out.
      if (seen.has(key)) conflicts.push(`duplicate ${field} "${value}" on ${seen.get(key)} and ${u._id}`);
      else seen.set(key, u._id.toString());
    }
  }

  if (conflicts.length) {
    console.log(`\n  ${conflicts.length} CONFLICT(S) — these would fail the unique indexes:`);
    conflicts.slice(0, 20).forEach((c) => console.log(`    - ${c}`));
    if (conflicts.length > 20) console.log(`    ... and ${conflicts.length - 20} more`);
    console.log('\n  Resolve these before applying. Nothing was written.');
    if (close) await mongoose.connection.close();
    const err = new Error(`${conflicts.length} unique-index conflict(s)`);
    err.conflicts = conflicts;
    throw err;
  }

  if (!APPLY) {
    console.log('\n  Dry run only. Re-run with --apply to perform the copy.\n');
    if (close) await mongoose.connection.close();
    return { dryRun: true, buyers: buyers.length, toCopy: toInsert.length };
  }

  if (toInsert.length) {
    // ordered: false so one bad document does not abort the rest.
    const result = await customers.insertMany(toInsert.map(toCustomerDoc), { ordered: false });
    console.log(`\n  copied: ${result.insertedCount}`);
  } else {
    console.log('\n  nothing to copy');
  }

  // Indexes Mongoose would build on first use; created here so the very first
  // post-migration login is not the thing that builds them.
  await customers.createIndex({ email: 1 }, { unique: true, sparse: true });
  await customers.createIndex({ mobileNumber: 1 }, { unique: true, sparse: true });
  await customers.createIndex({ isDeleted: 1, createdAt: -1 });
  console.log('  indexes ensured');

  const finalCount = await customers.countDocuments();
  console.log(`  customers collection now holds: ${finalCount}`);

  if (PRUNE) {
    // Only ever removes buyers that are verifiably present in the new
    // collection, so a partial copy can never turn into data loss.
    const copiedIds = (await customers.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    const del = await users.deleteMany({ role: 'customer', _id: { $in: copiedIds } });
    console.log(`  pruned from users: ${del.deletedCount}`);
  } else {
    console.log('  originals left in users (pass --prune to remove them once verified)');
  }

  console.log('');
  if (close) await mongoose.connection.close();
  return { dryRun: false, buyers: buyers.length, copied: toInsert.length, total: finalCount };
}

// Only self-executes when invoked as a script. `require()`ing it — which the
// test suite does — just hands back the function.
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nMigration failed:', err.message);
      console.error('Nothing partial to undo: the copy is additive and re-runnable.\n');
      process.exit(1);
    });
}

module.exports = { run, toCustomerDoc, CUSTOMER_FIELDS };
