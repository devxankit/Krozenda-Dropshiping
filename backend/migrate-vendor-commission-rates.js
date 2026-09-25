// One-off migration: makes CommissionRule the ONLY source of a commission rate.
//
// Every seller whose legacy Vendor.commissionRatePercent differs from the
// platform default gets a SELLER rule at that rate (see
// services/sellerCommissionRate.migrateVendorRates for exactly who is skipped
// and why). The legacy field itself is left in place, untouched.
//
// RUN THIS BEFORE DEPLOYING the code that stopped reading the legacy field —
// until it runs, a seller with a negotiated rate is charged the platform
// default on new orders. Orders already on the ledger keep the commission
// they were charged either way.
//
// Behaviour change to expect for the migrated sellers: a SELLER rule outranks
// CATEGORY and GLOBAL rules (Product -> Seller -> Category -> Global), where
// the legacy field used to rank below every rule.
//
//   node migrate-vendor-commission-rates.js            # show what would change
//   node migrate-vendor-commission-rates.js --apply    # write it
//
// Safe to run any number of times: a seller who already has a SELLER rule is
// skipped.
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URL);

  const { migrateVendorRates } = require('./services/sellerCommissionRate');
  const report = await migrateVendorRates({ apply });

  if (report.created.length > 0) {
    console.log(`\n${apply ? 'Created' : 'Would create'} a SELLER rule for:`);
    report.created.forEach((row) => console.log(`  ${row.vendor} (${row.vendorId}) — ${row.ratePercent}%`));
  }
  if (report.failed.length > 0) {
    console.log('\nCould not migrate (fix on Accounting > Commissions):');
    report.failed.forEach((row) => console.log(`  ${row.vendor} (${row.vendorId}) — ${row.ratePercent}%: ${row.reason}`));
  }

  const alreadyRuled = report.skipped.filter((row) => row.reason === 'already has a SELLER rule').length;
  console.log(
    `\n${report.created.length} ${apply ? 'created' : 'to create'}, ` +
      `${report.skipped.length - alreadyRuled} at the platform default, ` +
      `${alreadyRuled} already had a rule, ${report.failed.length} failed.` +
      (apply ? '' : ' Re-run with --apply to write.')
  );
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
