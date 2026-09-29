
// Shapes match schemas/financeSchema.js. Money is in PAISE.
//
// Balances and running totals below are COMPUTED, never typed: a total that
// is a literal drifts the moment a line changes.

// ---------------------------------------------------------------------------
// The general ledger. The money-movement writes below post to it.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Transactions & refunds
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Settlements. `net` is DERIVED — gross less commission, TDS and deductions.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Vendor ledgers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
export function commissionRuleListFixture() {
  return {
    items: [
      { id: 'cr-1', scope: 'product', target: 'Vayu 1.5 Ton 3-Star Inverter AC', type: 'percentage', value: 6, appliesTo: 1, updatedAt: '28 Aug 2026' },
      { id: 'cr-2', scope: 'vendor', target: 'Sunrise Traders', type: 'percentage', value: 20, appliesTo: 96, updatedAt: '22 Aug 2026' },
      { id: 'cr-3', scope: 'category', target: 'Home & Kitchen', type: 'percentage', value: 12.5, appliesTo: 28410, updatedAt: '12 Aug 2026' },
      { id: 'cr-4', scope: 'category', target: 'Apparel', type: 'percentage', value: 18, appliesTo: 31240, updatedAt: '12 Aug 2026' },
      { id: 'cr-5', scope: 'category', target: 'Electronics', type: 'percentage', value: 8, appliesTo: 18640, updatedAt: '12 Aug 2026' },
      { id: 'cr-6', scope: 'category', target: 'Grocery & Staples', type: 'percentage', value: 6, appliesTo: 14820, updatedAt: '12 Aug 2026' },
      { id: 'cr-7', scope: 'company', target: 'Bharat Textiles LLP', type: 'fixed', value: 2500, appliesTo: 294, updatedAt: '4 Jul 2026' },
      { id: 'cr-8', scope: 'default', target: 'Platform default', type: 'percentage', value: 15, appliesTo: 104220, updatedAt: '1 Jan 2026' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Postings mutate ACCOUNTS in place. The seed balances above are an "as at"
// state, so only NEW postings are applied.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Money movement: settlements, refunds, reconciliation
//
// These are the writes that move real money, so each one posts to the ledger
// as well as changing a status. A payout that updates a row but not the books
// is how a platform ends up unable to explain its own bank balance.
// ---------------------------------------------------------------------------
