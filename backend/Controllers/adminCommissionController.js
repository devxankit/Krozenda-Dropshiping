const mongoose = require('mongoose');
const CommissionRule = require('../Models/CommissionRule');
const AccountingConfig = require('../Models/AccountingConfig');
const AccountingTransaction = require('../Models/AccountingTransaction');
const Vendor = require('../Models/Vendor');
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const {
  loadRules,
  resolveForLine,
  explainChain,
  validateRuleInput,
  TARGET_FOR_SCOPE,
} = require('../services/commissionResolver');
const { commissionBaseFor } = require('../services/accountingPosting');
const { toPaise } = require('../utils/money');
const { recordAudit } = require('../services/accountingAudit');
const { paged, vendorLabel } = require('./adminAccountingController');

// Admin > Accounting > Commissions. Rules for what the marketplace charges.
//
// The one thing to keep in mind editing anything here: a rule is consulted
// only when a COMMISSION row is posted, and the rate it produced is frozen
// onto that row's metadata. Nothing in this file can change what a past order
// was charged, by design (task §6, §15 Rule 6) — `appliedCount` below is
// there to make that consequence visible before someone edits a live rule.

const SCOPE_LABEL = Object.freeze({
  GLOBAL: 'All sellers',
  SELLER: 'Seller',
  CATEGORY: 'Category',
  PRODUCT: 'Product',
});

async function decorateRules(rules) {
  const vendorIds = rules.filter((rule) => rule.vendor).map((rule) => rule.vendor);
  const categoryIds = rules.filter((rule) => rule.category).map((rule) => rule.category);
  const productIds = rules.filter((rule) => rule.product).map((rule) => rule.product);

  const [vendors, categories, products, usage] = await Promise.all([
    Vendor.find({ _id: { $in: vendorIds } }).select('name business.businessName').lean(),
    Category.find({ _id: { $in: categoryIds } }).select('name').lean(),
    Product.find({ _id: { $in: productIds } }).select('name').lean(),
    // How many historical commission rows each rule produced. This is read
    // off the ledger's frozen metadata, so it is a true count of what the
    // rule has already charged — not an estimate.
    AccountingTransaction.aggregate([
      { $match: { type: 'COMMISSION', 'metadata.ruleId': { $ne: null } } },
      { $group: { _id: '$metadata.ruleId', count: { $sum: 1 }, total: { $sum: '$debit' } } },
    ]),
  ]);

  const vendorById = new Map(vendors.map((v) => [String(v._id), v]));
  const categoryById = new Map(categories.map((c) => [String(c._id), c]));
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const usageById = new Map(usage.map((u) => [String(u._id), u]));

  return rules.map((rule) => {
    const applied = usageById.get(String(rule._id));
    let target = SCOPE_LABEL.GLOBAL;
    if (rule.scope === 'SELLER') target = vendorLabel(vendorById.get(String(rule.vendor)));
    else if (rule.scope === 'CATEGORY') target = categoryById.get(String(rule.category))?.name || 'Unknown category';
    else if (rule.scope === 'PRODUCT') target = productById.get(String(rule.product))?.name || 'Unknown product';

    const now = new Date();
    const expired = Boolean(rule.endDate && new Date(rule.endDate) < now);
    const scheduled = Boolean(rule.startDate && new Date(rule.startDate) > now);

    return {
      id: String(rule._id),
      name: rule.name,
      type: rule.type,
      value: rule.value,
      scope: rule.scope,
      scopeLabel: SCOPE_LABEL[rule.scope],
      target,
      sellerId: rule.vendor ? String(rule.vendor) : null,
      categoryId: rule.category ? String(rule.category) : null,
      productId: rule.product ? String(rule.product) : null,
      startDate: rule.startDate,
      endDate: rule.endDate,
      priority: rule.priority,
      isActive: rule.isActive,
      // What an operator actually needs to know: is this rule doing anything
      // right now?
      state: !rule.isActive ? 'INACTIVE' : expired ? 'EXPIRED' : scheduled ? 'SCHEDULED' : 'ACTIVE',
      appliedCount: applied?.count || 0,
      appliedAmount: applied?.total || 0,
      notes: rule.notes || '',
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  });
}

async function listCommissionRules(req, res) {
  const { tab, scope, search, page, rowsPerPage } = req.query;

  const rules = await CommissionRule.find().sort({ priority: -1, createdAt: -1 }).lean();
  const decorated = await decorateRules(rules);

  let items = decorated;
  if (scope && CommissionRule.SCOPES.includes(scope)) items = items.filter((rule) => rule.scope === scope);

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (rule) => rule.name.toLowerCase().includes(term) || rule.target.toLowerCase().includes(term)
    );
  }

  if (tab === 'active') items = items.filter((rule) => rule.state === 'ACTIVE');
  else if (tab === 'scheduled') items = items.filter((rule) => rule.state === 'SCHEDULED');
  else if (tab === 'expired') items = items.filter((rule) => rule.state === 'EXPIRED');
  else if (tab === 'inactive') items = items.filter((rule) => rule.state === 'INACTIVE');

  const tabCounts = {
    all: decorated.length,
    active: decorated.filter((rule) => rule.state === 'ACTIVE').length,
    scheduled: decorated.filter((rule) => rule.state === 'SCHEDULED').length,
    expired: decorated.filter((rule) => rule.state === 'EXPIRED').length,
    inactive: decorated.filter((rule) => rule.state === 'INACTIVE').length,
  };

  const config = await AccountingConfig.resolve();

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      ...paged(items, { page, rowsPerPage }, tabCounts),
      policy: {
        defaultCommissionPercent: config.defaultCommissionPercent,
        maxCommissionPercent: config.maxCommissionPercent,
        commissionBase: config.commissionBase,
      },
    },
  });
}

// Normalises a request body into the shape the model and validator expect.
// Returns { error } or { input }.
function readRuleBody(body) {
  const scope = String(body.scope || '').toUpperCase();
  const target = TARGET_FOR_SCOPE[scope];

  const input = {
    name: String(body.name || '').trim(),
    type: String(body.type || '').toUpperCase(),
    value: Number(body.value),
    scope,
    vendor: null,
    category: null,
    product: null,
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
    priority: Number(body.priority || 0),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    notes: String(body.notes || '').trim(),
  };

  if (!input.name) return { error: 'Give the rule a name' };
  if (!Number.isFinite(input.priority)) return { error: 'Enter a whole number for priority' };

  if (target) {
    const raw = body.sellerId || body.categoryId || body.productId || body[target];
    if (!mongoose.isValidObjectId(raw)) {
      return { error: `Select the ${scope.toLowerCase()} this rule applies to` };
    }
    input[target] = new mongoose.Types.ObjectId(raw);
  }

  return { input };
}

// The referenced seller/category/product has to exist — a rule pointing at a
// deleted product would silently never match (task §17, object id validation).
async function targetExists(input) {
  if (input.vendor) return Vendor.exists({ _id: input.vendor });
  if (input.category) return Category.exists({ _id: input.category });
  if (input.product) return Product.exists({ _id: input.product });
  return true;
}

async function createCommissionRule(req, res) {
  const { error, input } = readRuleBody(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  if (!(await targetExists(input))) {
    return res.status(400).json({ success: false, message: 'That seller, category or product no longer exists' });
  }

  const invalid = await validateRuleInput(input);
  if (invalid) return res.status(400).json({ success: false, message: invalid });

  const rule = await CommissionRule.create({ ...input, createdBy: req.admin?._id || null });

  await recordAudit({
    action: 'COMMISSION_RULE_CREATED',
    req,
    entityType: 'CommissionRule',
    entityId: rule._id,
    before: null,
    after: { name: rule.name, type: rule.type, value: rule.value, scope: rule.scope, priority: rule.priority },
  });

  const [serialized] = await decorateRules([rule.toObject()]);
  res.status(201).json({ success: true, message: 'Commission rule created', data: serialized });
}

async function updateCommissionRule(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule id' });
  }

  const existing = await CommissionRule.findById(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Commission rule not found' });

  const { error, input } = readRuleBody({ ...req.body, scope: req.body.scope || existing.scope });
  if (error) return res.status(400).json({ success: false, message: error });

  if (!(await targetExists(input))) {
    return res.status(400).json({ success: false, message: 'That seller, category or product no longer exists' });
  }

  const invalid = await validateRuleInput(input, { ruleId: existing._id });
  if (invalid) return res.status(400).json({ success: false, message: invalid });

  const before = {
    name: existing.name,
    type: existing.type,
    value: existing.value,
    scope: existing.scope,
    priority: existing.priority,
    startDate: existing.startDate,
    endDate: existing.endDate,
  };

  Object.assign(existing, input, { updatedBy: req.admin?._id || null });
  await existing.save();

  await recordAudit({
    action: 'COMMISSION_RULE_UPDATED',
    req,
    entityType: 'CommissionRule',
    entityId: existing._id,
    before,
    after: { name: existing.name, type: existing.type, value: existing.value, scope: existing.scope, priority: existing.priority },
    reason: String(req.body.reason || '').trim(),
  });

  const [serialized] = await decorateRules([existing.toObject()]);
  res.json({
    success: true,
    // Said plainly, because it is the question an operator will have.
    message: 'Commission rule updated — orders already charged keep the rate they were charged',
    data: serialized,
  });
}

// PATCH .../commissions/:id/status — retiring a rule rather than deleting it,
// so the rule that charged a historical order is still there to explain it.
async function setCommissionRuleStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule id' });
  }
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Specify whether the rule should be active' });
  }

  const existing = await CommissionRule.findById(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Commission rule not found' });

  // Reactivating has to pass the same conflict check a new rule would, or a
  // retired duplicate could be switched back on into an ambiguous state.
  if (isActive && !existing.isActive) {
    const invalid = await validateRuleInput(existing.toObject(), { ruleId: existing._id });
    if (invalid) return res.status(400).json({ success: false, message: invalid });
  }

  const before = { isActive: existing.isActive };
  existing.isActive = isActive;
  existing.updatedBy = req.admin?._id || null;
  await existing.save();

  await recordAudit({
    action: 'COMMISSION_RULE_STATUS_CHANGED',
    req,
    entityType: 'CommissionRule',
    entityId: existing._id,
    before,
    after: { isActive },
    reason: String(req.body.reason || '').trim(),
  });

  const [serialized] = await decorateRules([existing.toObject()]);
  res.json({
    success: true,
    message: isActive ? 'Commission rule activated' : 'Commission rule retired',
    data: serialized,
  });
}

// Options for the rule form's scope pickers.
async function getCommissionRuleOptions(req, res) {
  const [vendors, categories] = await Promise.all([
    Vendor.find({ isActive: true }).select('name business.businessName').sort({ name: 1 }).lean(),
    Category.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
  ]);

  // Products are searched rather than listed — a catalog can be large enough
  // that shipping all of it to a dropdown is the wrong shape.
  const term = String(req.query.product || '').trim();
  const products = term
    ? await Product.find({ name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })
        .select('name')
        .limit(20)
        .lean()
    : [];

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      sellers: vendors.map((vendor) => ({ value: String(vendor._id), label: vendorLabel(vendor) })),
      categories: categories.map((category) => ({ value: String(category._id), label: category.name })),
      products: products.map((product) => ({ value: String(product._id), label: product.name })),
    },
  });
}

// ---------------------------------------------------------------------------
// Preview — "what would this line be charged?"
// ---------------------------------------------------------------------------

// POST .../commissions/preview
//
// Runs the SAME resolver and commission base the posting engine uses, so the
// number an admin previews is the number an order placed right now would
// post. Nothing is written. Amounts in the response are integer paise, like
// every other figure on the Accounting screens.
//
// Body: productId and/or vendorId / categoryId, plus sellingPrice and
// discount (rupees, PER UNIT), quantity, and who funded the discount.
async function previewCommission(req, res) {
  const body = req.body || {};

  for (const field of ['productId', 'vendorId', 'categoryId']) {
    if (body[field] && !mongoose.isValidObjectId(body[field])) {
      return res.status(400).json({ success: false, message: `Invalid ${field}` });
    }
  }

  let product = null;
  if (body.productId) {
    product = await Product.findById(body.productId).select('name price vendor category').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const vendorId = body.vendorId || (product?.vendor ? String(product.vendor) : null);
  const categoryId = body.categoryId || (product?.category ? String(product.category) : null);
  if (!vendorId && !categoryId && !product) {
    return res.status(400).json({ success: false, message: 'Select a product, seller or category to preview' });
  }
  // Only seller lines are charged commission (see postOrderSale) — a product
  // the platform sells itself has no one to charge it to.
  if (product && !vendorId) {
    return res.status(400).json({
      success: false,
      message: 'This product is sold by the platform itself — no commission applies to it',
    });
  }

  const isBlank = (value) => value === undefined || value === null || value === '';
  const quantity = isBlank(body.quantity) ? 1 : Number(body.quantity);
  const unitPrice = isBlank(body.sellingPrice) ? product?.price : Number(body.sellingPrice);
  const unitDiscount = isBlank(body.discount) ? 0 : Number(body.discount);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    return res.status(400).json({ success: false, message: 'Enter a whole-number quantity of at least 1' });
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ success: false, message: 'Enter a selling price of zero or more' });
  }
  if (!Number.isFinite(unitDiscount) || unitDiscount < 0 || unitDiscount > unitPrice) {
    return res.status(400).json({ success: false, message: 'The discount must be between zero and the selling price' });
  }

  const fundedBy = String(body.discountFundedBy || 'SELLER').toUpperCase();
  if (!['SELLER', 'PLATFORM'].includes(fundedBy)) {
    return res.status(400).json({ success: false, message: 'discountFundedBy must be SELLER or PLATFORM' });
  }

  const at = body.at ? new Date(body.at) : new Date();
  if (Number.isNaN(at.getTime())) return res.status(400).json({ success: false, message: 'Enter a valid date' });

  const config = await AccountingConfig.resolve();

  // The line in the same shape explodeOrderLines() hands the posting engine.
  const grossPaise = toPaise(unitPrice) * quantity;
  const discountPaise = toPaise(unitDiscount) * quantity;
  const sellerFundedDiscountPaise = fundedBy === 'SELLER' ? discountPaise : 0;
  const line = {
    grossPaise,
    discountPaise,
    sellerGrossPaise: grossPaise - sellerFundedDiscountPaise,
  };
  const basePaise = commissionBaseFor(line, config);

  const rules = await loadRules({
    vendorIds: vendorId ? [vendorId] : [],
    categoryIds: categoryId ? [categoryId] : [],
    productIds: product ? [String(product._id)] : [],
    at,
  });
  const target = { basePaise, vendorId, categoryId, productId: product ? String(product._id) : null, quantity };
  const commission = resolveForLine(target, rules, config);

  res.json({
    success: true,
    message: 'Commission calculated successfully',
    data: {
      productName: product?.name || null,
      quantity,
      grossAmount: grossPaise,
      discount: discountPaise,
      discountFundedBy: fundedBy,
      commissionBasis: config.commissionBase,
      commissionBase: basePaise,
      commissionType: commission.rule ? commission.rule.type : 'PERCENTAGE',
      commissionRate: commission.ratePercent,
      // For a FIXED rule: the rupee charge per unit.
      commissionValue: commission.rule ? commission.rule.value : commission.ratePercent,
      commissionAmount: commission.amountPaise,
      source: commission.rule ? commission.rule.scope : 'DEFAULT',
      ruleId: commission.rule ? String(commission.rule._id) : null,
      ruleName: commission.rule ? commission.rule.name : 'Platform default',
      // Before gateway fees, shipping and refunds — the commission's effect
      // on its own.
      sellerPayable: line.sellerGrossPaise - commission.amountPaise,
      chain: explainChain(target, rules, config),
    },
  });
}

// ---------------------------------------------------------------------------
// Summary — the commission dashboard, read straight off the ledger
// ---------------------------------------------------------------------------

function monthStart(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

// GET .../commissions/summary
//
// No separate commission-status field exists or is needed: the frozen
// COMMISSION rows, the REFUND_REVERSAL rows that hand commission back (the
// only thing that row type is ever written for), and the order line's own
// status already say everything.
//
//   PENDING    charged on a line that has not been delivered yet
//   EARNED     charged on a delivered line, net of any partial refund
//   REVERSED   handed back because the buyer was refunded (return, refund)
//   CANCELLED  handed back because the line was cancelled
async function getCommissionSummary(req, res) {
  const now = new Date();
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);

  const [lines, months] = await Promise.all([
    AccountingTransaction.aggregate([
      { $match: { type: { $in: ['COMMISSION', 'REFUND_REVERSAL'] }, vendor: { $ne: null } } },
      {
        $group: {
          _id: { order: '$order', product: '$product', vendor: '$vendor' },
          chargedPaise: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
          backPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
        },
      },
    ]),
    // Net commission by the month it was POSTED in: a charge counts in the
    // month it was charged, a reversal in the month it was reversed.
    AccountingTransaction.aggregate([
      {
        $match: {
          type: { $in: ['COMMISSION', 'REFUND_REVERSAL'] },
          vendor: { $ne: null },
          createdAt: { $gte: lastMonth },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $gte: ['$createdAt', thisMonth] }, 'this', 'last'] },
          netPaise: { $sum: { $subtract: ['$debit', '$credit'] } },
        },
      },
    ]),
  ]);

  const orders = await Order.find({ _id: { $in: [...new Set(lines.map((l) => String(l._id.order)))] } })
    .select('status items.product items.vendor items.status')
    .lean();
  // Cancelling a whole order sets only the order's status, not each line's,
  // so an order-level CANCELLED wins over whatever its lines still say.
  const statusOf = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      statusOf.set(
        `${order._id}:${item.product}:${item.vendor}`,
        order.status === 'CANCELLED' ? 'CANCELLED' : item.status
      );
    }
  }

  const summary = {
    totalCharged: 0,
    netCommission: 0,
    pending: 0,
    earned: 0,
    reversed: 0,
    cancelled: 0,
    thisMonth: 0,
    lastMonth: 0,
    lines: lines.length,
  };

  for (const line of lines) {
    const status = statusOf.get(`${line._id.order}:${line._id.product}:${line._id.vendor}`);
    const net = line.chargedPaise - line.backPaise;
    summary.totalCharged += line.chargedPaise;
    summary.netCommission += net;

    if (status === 'CANCELLED') summary.cancelled += line.backPaise;
    else summary.reversed += line.backPaise;

    if (status === 'DELIVERED') summary.earned += net;
    else if (status !== 'CANCELLED') summary.pending += net;
  }

  for (const month of months) {
    if (month._id === 'this') summary.thisMonth = month.netPaise;
    else summary.lastMonth = month.netPaise;
  }

  res.json({ success: true, message: 'Accounting data fetched successfully', data: summary });
}

// ---------------------------------------------------------------------------
// Accounting policy (task §11 — "make the fee calculation configurable")
// ---------------------------------------------------------------------------

function serializeConfig(config) {
  return {
    defaultCommissionPercent: config.defaultCommissionPercent,
    maxCommissionPercent: config.maxCommissionPercent,
    commissionBase: config.commissionBase,
    gatewayFeePercent: config.gatewayFeePercent,
    gatewayFeeFixed: config.gatewayFeeFixed,
    gatewayFeeBearer: config.gatewayFeeBearer,
    shippingRevenueBearer: config.shippingRevenueBearer,
    settlementHoldDays: config.settlementHoldDays,
    requireCodRemittanceBeforeSettlement: config.requireCodRemittanceBeforeSettlement,
    sellerSettlementMode: config.sellerSettlementMode,
    sellerSettlementWindowDays: config.sellerSettlementWindowDays,
    currency: config.currency,
    updatedAt: config.updatedAt,
  };
}

async function getAccountingConfig(req, res) {
  const config = await AccountingConfig.resolve();
  res.json({ success: true, message: 'Accounting data fetched successfully', data: serializeConfig(config) });
}

const NUMERIC_BOUNDS = Object.freeze({
  defaultCommissionPercent: [0, 100],
  maxCommissionPercent: [0, 100],
  gatewayFeePercent: [0, 100],
  gatewayFeeFixed: [0, 100000],
  settlementHoldDays: [0, 180],
});

async function updateAccountingConfig(req, res) {
  const current = await AccountingConfig.resolve();
  const update = {};

  for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    if (req.body[field] === undefined) continue;
    const value = Number(req.body[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      return res.status(400).json({ success: false, message: `Enter a value between ${min} and ${max} for ${field}` });
    }
    update[field] = value;
  }

  for (const field of ['gatewayFeeBearer', 'shippingRevenueBearer']) {
    if (req.body[field] === undefined) continue;
    const value = String(req.body[field]).toUpperCase();
    if (!AccountingConfig.FEE_BEARERS.includes(value)) {
      return res.status(400).json({ success: false, message: `${field} must be PLATFORM or SELLER` });
    }
    update[field] = value;
  }

  if (req.body.commissionBase !== undefined) {
    const value = String(req.body.commissionBase).toUpperCase();
    if (!AccountingConfig.COMMISSION_BASES.includes(value)) {
      return res.status(400).json({ success: false, message: 'Select a valid commission base' });
    }
    update.commissionBase = value;
  }

  if (req.body.requireCodRemittanceBeforeSettlement !== undefined) {
    update.requireCodRemittanceBeforeSettlement = Boolean(req.body.requireCodRemittanceBeforeSettlement);
  }

  if (req.body.sellerSettlementMode !== undefined) {
    const value = String(req.body.sellerSettlementMode).toUpperCase();
    if (!['AUTO', 'MANUAL'].includes(value)) {
      return res.status(400).json({ success: false, message: 'sellerSettlementMode must be AUTO or MANUAL' });
    }
    update.sellerSettlementMode = value;
  }

  if (req.body.sellerSettlementWindowDays !== undefined) {
    const value = Number(req.body.sellerSettlementWindowDays);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ success: false, message: 'Enter a non-negative number of days for sellerSettlementWindowDays' });
    }
    update.sellerSettlementWindowDays = value;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ success: false, message: 'Nothing to update' });
  }

  const nextDefault = update.defaultCommissionPercent ?? current.defaultCommissionPercent;
  const nextMax = update.maxCommissionPercent ?? current.maxCommissionPercent;
  if (nextDefault > nextMax) {
    return res.status(400).json({ success: false, message: 'The default commission cannot exceed the platform limit' });
  }

  const before = Object.fromEntries(Object.keys(update).map((key) => [key, current[key]]));

  const updated = await AccountingConfig.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $set: { ...update, updatedBy: req.admin?._id || null } },
    { new: true }
  ).lean();

  await recordAudit({
    action: 'ACCOUNTING_CONFIG_UPDATED',
    req,
    entityType: 'AccountingConfig',
    entityId: 'GLOBAL',
    before,
    after: update,
    reason: String(req.body.reason || '').trim(),
  });

  res.json({
    success: true,
    message: 'Accounting policy updated — it applies to transactions posted from now on',
    data: serializeConfig(updated),
  });
}

module.exports = {
  listCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  setCommissionRuleStatus,
  getCommissionRuleOptions,
  previewCommission,
  getCommissionSummary,
  getAccountingConfig,
  updateAccountingConfig,
  decorateRules,
};
