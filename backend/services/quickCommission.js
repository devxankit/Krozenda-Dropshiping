const CommissionRule = require('../Models/CommissionRule');
const AccountingConfig = require('../Models/AccountingConfig');
const { validateRuleInput, TARGET_FOR_SCOPE } = require('./commissionResolver');
const { recordAudit } = require('./accountingAudit');

// "Set commission, or skip" — the inline prompt shown where the admin is
// already working: approving a seller, approving a seller's category or
// product, creating or editing a category.
//
// It does not add a second commission system. It writes the same
// CommissionRule the engine already resolves (Product > Seller > Category >
// Global > default), as that target's BASE rule: undated, priority 0. Dated
// or higher-priority rules are promotions written on the Accounting ▸
// Commissions screen, and this never touches them.

const COMMISSION_PERMISSION = 'admin.accounting.commission.manage';

class CommissionInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Read the optional commission from a request body. Accepts
 * `commission: { type, value }` (JSON, or JSON-encoded over multipart) and
 * the flat multipart pair `commissionType` / `commissionValue`.
 *
 * @returns {null | {type:'PERCENTAGE'|'FIXED', value:number}}  null = skipped
 * @throws {CommissionInputError}
 */
function readCommissionInput(body = {}) {
  let raw = body.commission;
  if (typeof raw === 'string') {
    try {
      raw = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      throw new CommissionInputError('Commission could not be read');
    }
  }
  if (!raw && (body.commissionType !== undefined || body.commissionValue !== undefined)) {
    raw = { type: body.commissionType, value: body.commissionValue };
  }
  if (!raw || raw.value === undefined || raw.value === null || String(raw.value).trim() === '') return null;

  const type = String(raw.type || 'PERCENTAGE').toUpperCase();
  if (!CommissionRule.TYPES.includes(type)) throw new CommissionInputError('Commission type must be % or ₹ per unit');
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value < 0) throw new CommissionInputError('Enter a commission of zero or more');
  return { type, value };
}

function canSetCommission(req) {
  return req.admin?.role === 'admin' || (req.permissions || []).includes(COMMISSION_PERMISSION);
}

// GLOBAL has no target: its base rule is simply "the" undated priority-0
// GLOBAL rule — the common rate for every seller product that has no rule of
// its own (e.g. everything auto-approved).
function targetFields(scope, targetId) {
  const field = TARGET_FOR_SCOPE[scope];
  return field ? { [field]: targetId } : {};
}

function baseRuleQuery(scope, targetId) {
  return {
    scope,
    ...targetFields(scope, targetId),
    isActive: true,
    startDate: null,
    endDate: null,
    priority: 0,
  };
}

function ruleInput(scope, targetId, { type, value }, name) {
  return {
    name,
    type,
    value,
    scope,
    vendor: null,
    category: null,
    product: null,
    ...targetFields(scope, targetId),
    startDate: null,
    endDate: null,
    priority: 0,
    isActive: true,
  };
}

/**
 * Validate BEFORE the approval/creation it rides along with, so a bad
 * commission never leaves a seller approved with the admin thinking the rate
 * was saved. Returns null when the commission was skipped.
 *
 * @throws {CommissionInputError}
 */
async function prepareCommission(req, scope, targetId) {
  const input = readCommissionInput(req.body);
  if (!input) return null;
  if (!canSetCommission(req)) {
    throw new CommissionInputError('You do not have permission to set commission — skip it, or ask an accounting admin', 403);
  }
  if (targetId || scope === 'GLOBAL') {
    const existing = await CommissionRule.findOne(baseRuleQuery(scope, targetId)).select('_id').lean();
    const problem = await validateRuleInput(ruleInput(scope, targetId, input, 'check'), { ruleId: existing?._id || null });
    if (problem) throw new CommissionInputError(problem);
  } else {
    // A category being created has no id yet, so only the value limits can
    // be checked up front — and a brand-new target cannot have a duplicate.
    const config = await AccountingConfig.resolve();
    if (input.type === 'PERCENTAGE' && input.value > config.maxCommissionPercent) {
      throw new CommissionInputError(`Commission cannot exceed the platform limit of ${config.maxCommissionPercent}%`);
    }
    if (input.type === 'FIXED' && input.value > 1000000) {
      throw new CommissionInputError('A fixed commission that large is almost certainly a mistake');
    }
  }
  return input;
}

/**
 * Create or update the target's base rule.
 *
 * @returns {Promise<object>} the rule
 */
async function setBaseCommission({ scope, targetId, input, name, req = null, reason = '' }) {
  const adminId = req?.admin?._id || null;
  const existing = await CommissionRule.findOne(baseRuleQuery(scope, targetId));

  if (existing) {
    const before = { type: existing.type, value: existing.value };
    existing.type = input.type;
    existing.value = input.value;
    existing.updatedBy = adminId;
    await existing.save();
    await recordAudit({
      action: 'COMMISSION_RULE_UPDATED',
      req,
      entityType: 'CommissionRule',
      entityId: existing._id,
      before,
      after: { type: input.type, value: input.value },
      reason,
    });
    return existing;
  }

  const rule = await CommissionRule.create({ ...ruleInput(scope, targetId, input, name), createdBy: adminId });
  await recordAudit({
    action: 'COMMISSION_RULE_CREATED',
    req,
    entityType: 'CommissionRule',
    entityId: rule._id,
    before: null,
    after: { name: rule.name, type: rule.type, value: rule.value, scope: rule.scope, priority: rule.priority },
    reason,
  });
  return rule;
}

/**
 * The base commission of each target, for pre-filling the prompt.
 *
 * @returns {Promise<Map<string, {type:string, value:number}>>}
 */
async function baseCommissionsFor(scope, targetIds) {
  const field = TARGET_FOR_SCOPE[scope];
  const rules = await CommissionRule.find({
    scope,
    [field]: { $in: targetIds },
    isActive: true,
    startDate: null,
    endDate: null,
    priority: 0,
  })
    .select(`${field} type value`)
    .lean();
  return new Map(rules.map((r) => [String(r[field]), { type: r.type, value: r.value }]));
}

module.exports = {
  CommissionInputError,
  readCommissionInput,
  prepareCommission,
  setBaseCommission,
  baseCommissionsFor,
  canSetCommission,
};
