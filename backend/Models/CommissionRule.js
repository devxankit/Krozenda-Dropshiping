const mongoose = require('mongoose');

// A marketplace commission rule. Rules are SCOPED and RANKED: the resolver
// (services/commissionResolver.js) picks the single most specific rule that
// is active on the order's date, so "Electronics is 10% but this one seller
// is 8% and this one SKU is 12%" is expressible without any rule needing to
// know about the others.
//
// Crucially, a rule is only ever consulted at POSTING time. The rate that was
// actually applied is snapshotted onto the COMMISSION transaction's metadata,
// so editing or deactivating a rule changes what future orders are charged
// and never what historical ones were charged (task §6, §15 Rule 6).

const TYPES = ['PERCENTAGE', 'FIXED'];

// Listed most specific first — SCOPE_RANK below turns this into the tie-break
// the resolver uses when two rules have the same `priority`.
const SCOPES = ['PRODUCT', 'SELLER', 'CATEGORY', 'GLOBAL'];

const SCOPE_RANK = Object.freeze({ PRODUCT: 0, SELLER: 1, CATEGORY: 2, GLOBAL: 3 });

const commissionRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TYPES, required: true },
    // PERCENTAGE -> percent of the commission base (0-100, additionally
    // capped by AccountingConfig.maxCommissionPercent at validation time).
    // FIXED      -> a flat amount in RUPEES per order line, converted to
    //               paise by the posting engine.
    value: { type: Number, required: true, min: 0 },

    scope: { type: String, enum: SCOPES, required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },

    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Higher wins. Equal priorities fall back to scope specificity.
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },

    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// The resolver's read path: active rules for a scope, best priority first.
commissionRuleSchema.index({ isActive: 1, scope: 1, priority: -1 });
commissionRuleSchema.index({ vendor: 1, isActive: 1 });
commissionRuleSchema.index({ category: 1, isActive: 1 });
commissionRuleSchema.index({ product: 1, isActive: 1 });

// A scope must carry the target it is scoped to, and must NOT carry the
// others — a "category" rule that also names a product is ambiguous about
// which one the resolver should have matched on.
const TARGET_FOR_SCOPE = Object.freeze({
  PRODUCT: 'product',
  SELLER: 'vendor',
  CATEGORY: 'category',
  GLOBAL: null,
});

commissionRuleSchema.pre('validate', function checkScopeTarget() {
  const required = TARGET_FOR_SCOPE[this.scope];
  const targets = ['product', 'vendor', 'category'];

  if (required && !this[required]) {
    throw new Error(`A ${this.scope.toLowerCase()} rule must name a ${required}`);
  }
  const strays = targets.filter((field) => field !== required && this[field]);
  if (strays.length > 0) {
    throw new Error(`A ${this.scope.toLowerCase()} rule cannot also target ${strays.join(', ')}`);
  }
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    throw new Error('The rule must end after it starts');
  }
});

// Is this rule in force at `at`? An inactive rule, one that has not started
// and one that has expired are all equally not applicable (task §6).
commissionRuleSchema.methods.isApplicableAt = function isApplicableAt(at = new Date()) {
  if (!this.isActive) return false;
  if (this.startDate && at < this.startDate) return false;
  if (this.endDate && at > this.endDate) return false;
  return true;
};

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);
CommissionRule.TYPES = TYPES;
CommissionRule.SCOPES = SCOPES;
CommissionRule.SCOPE_RANK = SCOPE_RANK;

module.exports = CommissionRule;
