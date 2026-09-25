const CommissionRule = require('../Models/CommissionRule');
const { validateRuleInput } = require('./commissionResolver');
const { recordAudit } = require('./accountingAudit');

// A seller's negotiated rate, written as the one thing that is ever read for
// it: a SELLER CommissionRule. The older Finance screen ("set this seller to
// N%") and migrate-vendor-commission-rates.js both come through here, so a
// rate set from either place lands in the rule the ledger actually charges.
//
// "The" negotiated-rate rule is the seller's undated, priority-0 SELLER rule.
// Dated or higher-priority SELLER rules are promotions an admin wrote on the
// Accounting screen, and this never touches them.

function sellerLabel(vendor) {
  return vendor?.business?.businessName || vendor?.name || 'Seller';
}

/**
 * Create or update a seller's negotiated percentage rate.
 *
 * @returns {Promise<{ok:true, rule:object, created:boolean} | {ok:false, status:number, message:string}>}
 */
async function setSellerRate({ vendor, ratePercent, req = null, reason = '', note = '' }) {
  const value = Number(ratePercent);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, status: 400, message: 'Enter a commission rate between 0 and 100' };
  }

  const existing = await CommissionRule.findOne({
    scope: 'SELLER',
    vendor: vendor._id,
    isActive: true,
    startDate: null,
    endDate: null,
    priority: 0,
  });

  const input = {
    name: existing?.name || `${sellerLabel(vendor)} — negotiated rate`,
    type: 'PERCENTAGE',
    value,
    scope: 'SELLER',
    vendor: vendor._id,
    category: null,
    product: null,
    startDate: null,
    endDate: null,
    priority: 0,
    isActive: true,
  };

  const invalid = await validateRuleInput(input, { ruleId: existing?._id || null });
  if (invalid) return { ok: false, status: 400, message: invalid };

  const adminId = req?.admin?._id || null;

  if (existing) {
    const before = { type: existing.type, value: existing.value };
    existing.type = 'PERCENTAGE';
    existing.value = value;
    existing.updatedBy = adminId;
    await existing.save();
    await recordAudit({
      action: 'COMMISSION_RULE_UPDATED',
      req,
      entityType: 'CommissionRule',
      entityId: existing._id,
      before,
      after: { type: 'PERCENTAGE', value },
      reason,
    });
    return { ok: true, rule: existing, created: false };
  }

  const rule = await CommissionRule.create({ ...input, notes: note, createdBy: adminId });
  await recordAudit({
    action: 'COMMISSION_RULE_CREATED',
    req,
    entityType: 'CommissionRule',
    entityId: rule._id,
    before: null,
    after: { name: rule.name, type: rule.type, value: rule.value, scope: rule.scope, priority: rule.priority },
    reason,
  });
  return { ok: true, rule, created: true };
}

/**
 * Move every legacy Vendor.commissionRatePercent into a SELLER rule — the
 * one-off step that makes CommissionRule the only source of a rate.
 *
 * A vendor whose legacy rate equals the platform default gets NO rule: with
 * or without one they are charged the same, and giving every seller a rule
 * would bury the few genuinely negotiated rates under hundreds of copies of
 * the default. A vendor who already has an active SELLER rule is skipped too
 * — that rule was already outranking the legacy field.
 *
 * @returns {Promise<{created:Array, skipped:Array, failed:Array}>}
 */
async function migrateVendorRates({ apply = false } = {}) {
  const Vendor = require('../Models/Vendor');
  const AccountingConfig = require('../Models/AccountingConfig');

  const config = await AccountingConfig.resolve();
  const vendors = await Vendor.find({ commissionRatePercent: { $ne: null } })
    .select('name business.businessName commissionRatePercent')
    .lean();
  const withRule = new Set(
    (await CommissionRule.find({ scope: 'SELLER', isActive: true }).distinct('vendor')).map(String)
  );

  const report = { created: [], skipped: [], failed: [] };

  for (const vendor of vendors) {
    const entry = { vendorId: String(vendor._id), vendor: sellerLabel(vendor), ratePercent: vendor.commissionRatePercent };

    if (vendor.commissionRatePercent === config.defaultCommissionPercent) {
      report.skipped.push({ ...entry, reason: 'same as platform default' });
      continue;
    }
    if (withRule.has(entry.vendorId)) {
      report.skipped.push({ ...entry, reason: 'already has a SELLER rule' });
      continue;
    }
    if (!apply) {
      report.created.push(entry);
      continue;
    }

    const result = await setSellerRate({
      vendor,
      ratePercent: vendor.commissionRatePercent,
      reason: 'Migrated from Vendor.commissionRatePercent',
      note: 'Migrated from the legacy Vendor.commissionRatePercent field',
    });
    if (result.ok) report.created.push({ ...entry, ruleId: String(result.rule._id) });
    else report.failed.push({ ...entry, reason: result.message });
  }

  return report;
}

module.exports = { setSellerRate, sellerLabel, migrateVendorRates };
