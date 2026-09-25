const CommissionRule = require('../Models/CommissionRule');
const AccountingConfig = require('../Models/AccountingConfig');
const { percentOfPaise, toPaise } = require('../utils/money');

// Resolves what commission the marketplace charges on one order line, and
// returns the WORKING as well as the number — because that working is what
// gets snapshotted onto the COMMISSION transaction so the charge can still be
// explained months later, after every rule has been edited (task §6).
//
// Priority, most specific first:
//
//     Product -> Seller -> Category -> Global -> AccountingConfig default
//
// A higher `priority` on a rule overrides that ordering; scope specificity is
// only the tie-break. Rules that are inactive, not yet started or expired are
// never considered.
//
// CommissionRule is the ONLY source of a rate. A seller's negotiated rate is a
// SELLER rule; Vendor.commissionRatePercent is a legacy field that nothing
// here reads any more (migrate-vendor-commission-rates.js moved it into
// rules). Two places to set one seller's rate is how the seller screen and
// the ledger came to disagree.

const SOURCES = Object.freeze({
  RULE: 'RULE',
  // Never produced any more. Kept because COMMISSION rows posted before the
  // migration carry it in their frozen metadata, and reports still read them.
  VENDOR_RATE: 'VENDOR_RATE',
  PLATFORM_DEFAULT: 'PLATFORM_DEFAULT',
});

// The order the chain is drawn in for an admin: most specific first.
const CHAIN_SCOPES = Object.freeze(['PRODUCT', 'SELLER', 'CATEGORY', 'GLOBAL']);

const TARGET_FOR_SCOPE = Object.freeze({
  PRODUCT: 'product',
  SELLER: 'vendor',
  CATEGORY: 'category',
  GLOBAL: null,
});

/**
 * Load every rule that could apply to a set of lines, once, so resolving a
 * 40-line order is one query rather than 40.
 *
 * @param {object} context
 * @param {Array}  context.vendorIds
 * @param {Array}  context.categoryIds
 * @param {Array}  context.productIds
 * @param {Date}   context.at  The moment the commission applies to — the
 *   order's payment date, never "now", so a rule created after the order can
 *   never reach back and claim it.
 */
async function loadRules({ vendorIds = [], categoryIds = [], productIds = [], at = new Date() }) {
  return CommissionRule.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: at } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: at } }] },
      {
        $or: [
          { scope: 'GLOBAL' },
          { scope: 'SELLER', vendor: { $in: vendorIds } },
          { scope: 'CATEGORY', category: { $in: categoryIds } },
          { scope: 'PRODUCT', product: { $in: productIds } },
        ],
      },
    ],
  }).lean();
}

function matches(rule, { vendorId, categoryId, productId }) {
  if (rule.scope === 'GLOBAL') return true;
  if (rule.scope === 'SELLER') return String(rule.vendor) === String(vendorId);
  if (rule.scope === 'CATEGORY') return Boolean(categoryId) && String(rule.category) === String(categoryId);
  if (rule.scope === 'PRODUCT') return Boolean(productId) && String(rule.product) === String(productId);
  return false;
}

// Best = highest priority, then most specific scope, then most recently
// updated. That last tie-break matters: two identically-scoped rules at the
// same priority is a configuration conflict, and resolving it deterministically
// beats taking whichever one the index happened to return first (task §6,
// "duplicate/conflicting rules must be handled").
function pickBest(candidates) {
  const ranked = candidates.slice().sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const rank = CommissionRule.SCOPE_RANK;
    if (rank[a.scope] !== rank[b.scope]) return rank[a.scope] - rank[b.scope];
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
  return ranked[0] || null;
}

/**
 * What a set of terms ({type, value}) charges on a line. The one formula,
 * shared by a live rule and by the terms frozen on an order line.
 */
function chargeFor({ type, value }, basePaise, quantity = 1) {
  if (type === 'PERCENTAGE') return percentOfPaise(basePaise, value);
  // FIXED is per unit sold, but can never exceed the line itself — otherwise
  // a 50-rupee accessory sold under a 100-rupee fixed-fee rule would push a
  // successful sale into a negative payable.
  return Math.min(toPaise(value) * Math.max(1, Math.round(Number(quantity) || 1)), basePaise);
}

/**
 * Commission for one order line.
 *
 * @param {object} line
 * @param {number} line.basePaise  What commission is charged ON. Computed by
 *   the posting engine from AccountingConfig.commissionBase — this function
 *   deliberately has no opinion about discounts.
 * @param {*} line.vendorId
 * @param {*} [line.categoryId]
 * @param {*} [line.productId]
 * @param {number} [line.quantity=1]  Units on the line — a FIXED rule is
 *   charged per unit sold.
 * @param {Array}  rules   From loadRules().
 * @param {object} config  From AccountingConfig.resolve().
 * @returns {{amountPaise:number, ratePercent:number|null, source:string, rule:object|null, workings:object}}
 */
function resolveForLine(line, rules, config) {
  const { basePaise, vendorId, categoryId, productId } = line;
  const quantity = Math.max(1, Math.round(Number(line.quantity) || 1));

  const rule = pickBest(rules.filter((candidate) => matches(candidate, { vendorId, categoryId, productId })));

  if (rule) {
    // A matched rule of 0 is an explicit "no commission" — it is returned as
    // a zero charge, never treated as "no rule" and passed down the chain.
    return {
      amountPaise: chargeFor(rule, basePaise, quantity),
      ratePercent: rule.type === 'PERCENTAGE' ? rule.value : null,
      source: SOURCES.RULE,
      rule,
      workings: {
        ruleId: String(rule._id),
        ruleName: rule.name,
        ruleScope: rule.scope,
        ruleType: rule.type,
        ruleValue: rule.value,
        quantity,
        basePaise,
      },
    };
  }

  // No rule matched: the platform default, which always exists — so a line
  // can never go uncharged for want of configuration.
  const ratePercent = config.defaultCommissionPercent;

  return {
    amountPaise: percentOfPaise(basePaise, ratePercent),
    ratePercent,
    source: SOURCES.PLATFORM_DEFAULT,
    rule: null,
    workings: { ratePercent, quantity, basePaise, source: SOURCES.PLATFORM_DEFAULT },
  };
}

/**
 * Every step of the chain for one line — including the ones that did NOT
 * apply — so an admin can see why a rate is what it is without opening the
 * rules screen. `applies` marks the rule resolveForLine() actually picks,
 * which is not always the most specific one: a higher `priority` wins.
 */
function explainChain(line, rules, config) {
  const { vendorId, categoryId, productId } = line;
  const matching = rules.filter((candidate) => matches(candidate, { vendorId, categoryId, productId }));
  const winner = pickBest(matching);

  const steps = CHAIN_SCOPES.map((scope) => {
    const rule = pickBest(matching.filter((candidate) => candidate.scope === scope));
    return {
      scope,
      ruleId: rule ? String(rule._id) : null,
      ruleName: rule ? rule.name : null,
      type: rule ? rule.type : null,
      value: rule ? rule.value : null,
      priority: rule ? rule.priority : null,
      applies: Boolean(rule && winner && String(rule._id) === String(winner._id)),
    };
  });

  steps.push({
    scope: 'DEFAULT',
    ruleId: null,
    ruleName: 'Platform default',
    type: 'PERCENTAGE',
    value: config.defaultCommissionPercent,
    priority: null,
    applies: !winner,
  });

  return steps;
}

/**
 * A seller's headline rate: their SELLER rule, else a GLOBAL rule, else the
 * platform default. For screens that show "this seller pays N%" — it is NOT
 * what every line is charged (a product rule, or a higher-priority category
 * rule, can still outrank it), which is why the ledger never uses it.
 *
 * @returns {Promise<Map<string, {type:string, value:number, ratePercent:number|null, source:string, ruleId:string|null}>>}
 */
async function sellerRatesFor(vendorIds, { at = new Date(), config = null } = {}) {
  const resolvedConfig = config || (await AccountingConfig.resolve());
  const ids = vendorIds.map(String);
  const rules = await loadRules({ vendorIds: ids, at });

  const rates = new Map();
  for (const vendorId of ids) {
    const rule = pickBest(
      rules.filter(
        (candidate) =>
          candidate.scope === 'GLOBAL' || (candidate.scope === 'SELLER' && String(candidate.vendor) === vendorId)
      )
    );
    rates.set(
      vendorId,
      rule
        ? {
            type: rule.type,
            value: rule.value,
            ratePercent: rule.type === 'PERCENTAGE' ? rule.value : null,
            source: rule.scope,
            ruleId: String(rule._id),
          }
        : {
            type: 'PERCENTAGE',
            value: resolvedConfig.defaultCommissionPercent,
            ratePercent: resolvedConfig.defaultCommissionPercent,
            source: 'DEFAULT',
            ruleId: null,
          }
    );
  }
  return rates;
}

/**
 * Validate a rule before it is written. Returns an error message, or null.
 * Lives here rather than in the controller so the create and update paths
 * cannot drift apart.
 */
async function validateRuleInput(input, { ruleId = null } = {}) {
  const config = await AccountingConfig.resolve();

  if (!CommissionRule.TYPES.includes(input.type)) return 'Select a valid commission type';
  if (!CommissionRule.SCOPES.includes(input.scope)) return 'Select a valid commission scope';

  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) return 'Enter a commission value of zero or more';
  if (input.type === 'PERCENTAGE' && value > config.maxCommissionPercent) {
    return `Commission cannot exceed the platform limit of ${config.maxCommissionPercent}%`;
  }
  if (input.type === 'FIXED' && value > 1000000) {
    return 'A fixed commission that large is almost certainly a mistake';
  }

  const start = input.startDate ? new Date(input.startDate) : null;
  const end = input.endDate ? new Date(input.endDate) : null;
  if (start && Number.isNaN(start.getTime())) return 'Enter a valid start date';
  if (end && Number.isNaN(end.getTime())) return 'Enter a valid end date';
  if (start && end && end <= start) return 'The rule must end after it starts';

  // A duplicate — same scope, same target, same priority, overlapping window
  // — would make which rule applies depend on a tie-break nobody intended.
  const target = TARGET_FOR_SCOPE[input.scope];
  const existing = await CommissionRule.find({
    scope: input.scope,
    isActive: true,
    ...(target ? { [target]: input[target] } : {}),
    ...(ruleId ? { _id: { $ne: ruleId } } : {}),
  }).lean();

  const priority = Number(input.priority || 0);
  const overlaps = existing.some((rule) => {
    if (rule.priority !== priority) return false;
    const ruleStart = rule.startDate ? new Date(rule.startDate) : null;
    const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;
    const startsBeforeOtherEnds = !ruleEnd || !start || start <= ruleEnd;
    const endsAfterOtherStarts = !ruleStart || !end || end >= ruleStart;
    return startsBeforeOtherEnds && endsAfterOtherStarts;
  });
  if (overlaps) {
    return 'An active rule with the same scope, target and priority already covers this period — retire it or give this one a different priority';
  }

  return null;
}

module.exports = {
  loadRules,
  resolveForLine,
  chargeFor,
  explainChain,
  sellerRatesFor,
  validateRuleInput,
  SOURCES,
  TARGET_FOR_SCOPE,
  CHAIN_SCOPES,
};
