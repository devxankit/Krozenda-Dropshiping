const mongoose = require('mongoose');

// The marketplace's money POLICY, as one editable singleton document rather
// than constants buried in the posting engine. Every figure the ledger
// derives that is not read off an Order (gateway fee, who bears it, the
// payout hold window, what commission is charged on) resolves through here,
// so changing a policy is an admin action with an audit trail — not a deploy.
//
// Defaults below reproduce the behaviour this platform already had before the
// Accounting module existed: a 10% commission (Vendor.commissionRatePercent's
// own default) and a 7-day hold (adminFinanceController.HOLD_DAYS, which
// mirrors returnController's buyer-facing return window). They are the
// starting values of a mutable record, not hardcoded financial values.
const FEE_BEARERS = ['PLATFORM', 'SELLER'];

// What the platform's commission percentage is actually charged ON.
//   LINE_NET_OF_SELLER_FUNDED_DISCOUNT — the default and the fair reading:
//     a discount the SELLER funded (their own coupon) lowers the base, a
//     discount the PLATFORM funded does not, because the seller was paid in
//     full for that line either way.
//   LINE_GROSS    — always the undiscounted line total.
//   LINE_NET      — always net of every discount, whoever funded it.
const COMMISSION_BASES = [
  'LINE_NET_OF_SELLER_FUNDED_DISCOUNT',
  'LINE_GROSS',
  'LINE_NET',
];

const accountingConfigSchema = new mongoose.Schema(
  {
    // Enforces the singleton: a second document cannot be inserted.
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    // --- commission ------------------------------------------------------
    // Fallback when no CommissionRule matches a line. Always present, so a
    // line can never go uncharged for want of configuration.
    defaultCommissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    // Business ceiling a CommissionRule is validated against (task §6).
    maxCommissionPercent: { type: Number, default: 30, min: 0, max: 100 },
    commissionBase: { type: String, enum: COMMISSION_BASES, default: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT' },

    // --- payment gateway --------------------------------------------------
    // Applied to online (RAZORPAY) captures only. COD and wallet payments
    // never attract a gateway fee.
    gatewayFeePercent: { type: Number, default: 2, min: 0, max: 100 },
    gatewayFeeFixed: { type: Number, default: 0, min: 0 }, // rupees
    // Who the fee is charged to. PLATFORM (the default) means it is a cost of
    // running the marketplace and never touches the seller's payable.
    gatewayFeeBearer: { type: String, enum: FEE_BEARERS, default: 'PLATFORM' },

    // --- shipping ---------------------------------------------------------
    // Who keeps the shipping fee the buyer paid.
    shippingRevenueBearer: { type: String, enum: FEE_BEARERS, default: 'PLATFORM' },

    // --- settlement -------------------------------------------------------
    // Days a delivered line is held before it can be settled, so a return
    // raised inside the window is netted off before the money leaves.
    settlementHoldDays: { type: Number, default: 7, min: 0, max: 180 },
    // A COD line is only settleable once the courier has actually remitted
    // the cash — see task §12 and accountingPosting.recordCodRemittance.
    requireCodRemittanceBeforeSettlement: { type: Boolean, default: true },

    // Whether an ELIGIBLE settlement's Razorpay Route transfer is created
    // automatically (by a future cron job) or only on an admin's explicit
    // manual-release action. AUTO is the default so eligible sellers keep
    // getting paid without a human having to click through every batch;
    // MANUAL is the escape hatch for a seller/category that needs a human
    // to look before money moves.
    sellerSettlementMode: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO' },
    // Kept separate from settlementHoldDays above: that one governs when a
    // delivered LINE becomes eligible to join a settlement batch; this one
    // is the additional window (from a batch's eligibleAt) before its
    // Razorpay transfer's on_hold_until releases the money to the seller —
    // giving admin a further buffer to catch a problem on an already-batched
    // settlement before Razorpay actually settles the transfer.
    sellerSettlementWindowDays: { type: Number, default: 7, min: 0 },

    currency: { type: String, default: 'INR', immutable: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Read-through singleton. Uses an upsert rather than create() so two
// concurrent first reads cannot race into a duplicate-key error.
accountingConfigSchema.statics.resolve = async function resolve() {
  return this.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const AccountingConfig = mongoose.model('AccountingConfig', accountingConfigSchema);
AccountingConfig.FEE_BEARERS = FEE_BEARERS;
AccountingConfig.COMMISSION_BASES = COMMISSION_BASES;

module.exports = AccountingConfig;
