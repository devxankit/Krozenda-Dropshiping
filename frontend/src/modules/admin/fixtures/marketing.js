// Shapes match schemas/marketingSchema.js. Money is in PAISE.

function page(rows, all, matchers, { page = 1, rowsPerPage = 25 } = {}) {
  return {
    items: rows.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage),
    page,
    rowsPerPage,
    totalItems: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / rowsPerPage)),
    tabCounts: Object.fromEntries(
      Object.entries(matchers).map(([key, match]) => [key, all.filter(match).length]),
    ),
  }
}

function search(rows, term, fields) {
  if (!term) return rows
  const needle = term.trim().toLowerCase()
  return rows.filter((row) => fields.some((f) => String(row[f] ?? '').toLowerCase().includes(needle)))
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const COUPONS = [
  { id: 'cpn-1', code: 'FESTIVE500', description: '₹500 off orders above ₹2,999', discountType: 'fixed', discountValue: 50000, minCartValue: 299900, maxDiscount: null, usageLimit: 5000, used: 3184, startsOn: '20 Aug 2026', endsOn: '30 Sep 2026', status: 'active' },
  { id: 'cpn-2', code: 'FIRSTORDER', description: '15% off your first order', discountType: 'percentage', discountValue: 15, minCartValue: 49900, maxDiscount: 100000, usageLimit: null, used: 12406, startsOn: '1 Jan 2026', endsOn: '31 Mar 2027', status: 'active' },
  { id: 'cpn-3', code: 'FREESHIP', description: 'Free shipping, any cart value', discountType: 'shipping', discountValue: 0, minCartValue: 0, maxDiscount: 5000, usageLimit: 20000, used: 20000, startsOn: '1 Aug 2026', endsOn: '31 Aug 2026', status: 'exhausted' },
  { id: 'cpn-4', code: 'B2B10', description: '10% off for dealers and distributors', discountType: 'percentage', discountValue: 10, minCartValue: 5000000, maxDiscount: 2500000, usageLimit: 500, used: 148, startsOn: '1 Sep 2026', endsOn: '31 Dec 2026', status: 'active' },
  { id: 'cpn-5', code: 'DIWALI25', description: '25% off electronics', discountType: 'percentage', discountValue: 25, minCartValue: 999900, maxDiscount: 500000, usageLimit: 2000, used: 0, startsOn: '15 Oct 2026', endsOn: '25 Oct 2026', status: 'scheduled' },
  { id: 'cpn-6', code: 'MONSOON200', description: '₹200 off kitchenware', discountType: 'fixed', discountValue: 20000, minCartValue: 99900, maxDiscount: null, usageLimit: 3000, used: 2841, startsOn: '1 Jul 2026', endsOn: '15 Aug 2026', status: 'expired' },
  { id: 'cpn-7', code: 'WELCOME50', description: '₹50 off, app installs only', discountType: 'fixed', discountValue: 5000, minCartValue: 39900, maxDiscount: null, usageLimit: 10000, used: 4102, startsOn: '1 Jun 2026', endsOn: '31 Dec 2026', status: 'paused' },
]

const COUPON_TABS = {
  all: () => true,
  active: (c) => c.status === 'active',
  scheduled: (c) => c.status === 'scheduled',
  paused: (c) => c.status === 'paused',
  finished: (c) => ['expired', 'exhausted'].includes(c.status),
}

export function couponListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = COUPONS.filter(COUPON_TABS[tab] || COUPON_TABS.all)
  rows = search(rows, filters.search, ['code', 'description'])
  if (filters.discountType) rows = rows.filter((c) => c.discountType === filters.discountType)
  return page(rows, COUPONS, COUPON_TABS, query)
}

const REVIEWS = [
  { id: 'rev-1', product: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L', sku: 'KZ-HK-STL-1200', buyer: 'Ananya Iyer', rating: 5, title: 'Heats evenly, no hot spots', body: 'Used it on induction for a fortnight. Base is genuinely triply, food does not catch.', submittedAt: '1 Sep 2026', verifiedPurchase: true, status: 'pending', flagged: false },
  { id: 'rev-2', product: 'Meher Handloom Cotton Kurta', sku: 'KZ-AP-KRT-M', buyer: 'Sneha Kulkarni', rating: 2, title: 'Runs small', body: 'Ordered L, fits like M. Fabric is good but the sizing chart is wrong.', submittedAt: '31 Aug 2026', verifiedPurchase: true, status: 'pending', flagged: false },
  { id: 'rev-3', product: 'Vayu 1.5 Ton 3-Star Inverter AC', sku: 'KZ-EL-AC-1503', buyer: 'Imran Qureshi', rating: 1, title: 'CALL ME ON 98XXXXXXXX FOR CHEAP AC', body: 'Contact me directly, I sell the same unit for less.', submittedAt: '30 Aug 2026', verifiedPurchase: false, status: 'pending', flagged: true },
  { id: 'rev-4', product: 'Surya Cold-Pressed Groundnut Oil, 5 L', sku: 'KZ-GR-OIL-5000', buyer: 'Meera Nair', rating: 4, title: 'Good, packaging could be better', body: 'Oil is fine. The can arrived slightly dented but nothing leaked.', submittedAt: '29 Aug 2026', verifiedPurchase: true, status: 'published', flagged: false },
  { id: 'rev-5', product: 'Aarohi Cotton Table Runner, 180 cm', sku: 'KZ-HD-RNR-180', buyer: 'Fatima Sheikh', rating: 5, title: 'Exactly as pictured', body: 'Colour matches the listing. Washed once, no bleeding.', submittedAt: '28 Aug 2026', verifiedPurchase: true, status: 'published', flagged: false },
  { id: 'rev-6', product: 'Vayu Ceiling Fan 1200 mm, BLDC', sku: 'KZ-EL-FAN-1200', buyer: 'Arjun Pillai', rating: 1, title: 'Terrible', body: 'Rubbish product from a rubbish company, do not buy anything from these people ever.', submittedAt: '26 Aug 2026', verifiedPurchase: true, status: 'rejected', flagged: true },
]

const REVIEW_TABS = {
  all: () => true,
  pending: (r) => r.status === 'pending',
  flagged: (r) => r.flagged,
  published: (r) => r.status === 'published',
  rejected: (r) => r.status === 'rejected',
}

export function reviewListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = REVIEWS.filter(REVIEW_TABS[tab] || REVIEW_TABS.all)
  rows = search(rows, filters.search, ['product', 'sku', 'buyer', 'title'])
  if (filters.rating) rows = rows.filter((r) => String(r.rating) === filters.rating)
  return page(rows, REVIEWS, REVIEW_TABS, query)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------