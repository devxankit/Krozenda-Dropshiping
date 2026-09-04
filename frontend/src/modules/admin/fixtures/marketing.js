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

export function offerListFixture() {
  return {
    items: [
      { id: 'ofr-1', name: 'Buy 2 get 10% off — cookware', scope: 'Home & Kitchen › Cookware', condition: 'Quantity ≥ 2 of the same SKU', effect: '10% off the line total', startsOn: '1 Aug 2026', endsOn: '30 Sep 2026', active: true, redemptions: 1842 },
      { id: 'ofr-2', name: 'Bulk apparel tier', scope: 'Apparel', condition: 'Quantity ≥ 100', effect: '5% off, stacks with tier price', startsOn: '1 Jul 2026', endsOn: '31 Dec 2026', active: true, redemptions: 214 },
      { id: 'ofr-3', name: 'New seller spotlight', scope: 'Sellers joined in the last 60 days', condition: 'Cart value ≥ ₹999', effect: 'Free shipping', startsOn: '15 Aug 2026', endsOn: '15 Oct 2026', active: true, redemptions: 628 },
      { id: 'ofr-4', name: 'Diwali electronics', scope: 'Electronics', condition: '15–25 Oct only', effect: '7% off, capped at ₹2,000', startsOn: '15 Oct 2026', endsOn: '25 Oct 2026', active: false, redemptions: 0 },
      { id: 'ofr-5', name: 'Clear slow-moving stock', scope: 'Own stock, 90+ days cover', condition: 'Any quantity', effect: '12% off', startsOn: '1 Sep 2026', endsOn: '30 Sep 2026', active: true, redemptions: 96 },
    ],
  }
}

export function bannerListFixture() {
  return {
    items: [
      { id: 'bnr-1', title: 'Festive season — up to 40% off', placement: 'Home hero', audience: 'All buyers', startsOn: '20 Aug 2026', endsOn: '30 Sep 2026', priority: 1, status: 'live', clicks: 48210, impressions: 1284000 },
      { id: 'bnr-2', title: 'B2B pricing — register your business', placement: 'Home strip', audience: 'Retail buyers only', startsOn: '1 Aug 2026', endsOn: '31 Dec 2026', priority: 2, status: 'live', clicks: 6420, impressions: 842000 },
      { id: 'bnr-3', title: 'Free shipping over ₹499', placement: 'Cart banner', audience: 'Cart under ₹499', startsOn: '1 Jan 2026', endsOn: '31 Mar 2027', priority: 1, status: 'live', clicks: 18640, impressions: 412000 },
      { id: 'bnr-4', title: 'Diwali sale — mark your calendar', placement: 'Home hero', audience: 'All buyers', startsOn: '10 Oct 2026', endsOn: '25 Oct 2026', priority: 1, status: 'scheduled', clicks: 0, impressions: 0 },
      { id: 'bnr-5', title: 'Monsoon essentials', placement: 'Category header', audience: 'All buyers', startsOn: '1 Jul 2026', endsOn: '15 Aug 2026', priority: 3, status: 'ended', clicks: 21400, impressions: 684000 },
      { id: 'bnr-6', title: 'Refer a business, earn ₹1,000', placement: 'Profile banner', audience: 'B2B buyers', startsOn: '', endsOn: '', priority: 4, status: 'draft', clicks: 0, impressions: 0 },
    ],
  }
}

export function cmsPageListFixture() {
  return {
    items: [
      { id: 'cms-1', title: 'Privacy Policy', slug: 'privacy-policy', version: 'v1.4', updatedAt: '12 Aug 2026', updatedBy: 'Priya Sharma', status: 'published', requiresAcceptance: true },
      { id: 'cms-2', title: 'Terms & Conditions', slug: 'terms', version: 'v3.0', updatedAt: '12 Aug 2026', updatedBy: 'Priya Sharma', status: 'published', requiresAcceptance: true },
      { id: 'cms-3', title: 'Vendor Agreement', slug: 'vendor-agreement', version: 'v2.1', updatedAt: '4 Jul 2026', updatedBy: 'Priya Sharma', status: 'published', requiresAcceptance: true },
      { id: 'cms-4', title: 'Return Policy', slug: 'return-policy', version: 'v1.3', updatedAt: '20 Aug 2026', updatedBy: 'Deepa Raghunathan', status: 'published', requiresAcceptance: true },
      { id: 'cms-5', title: 'Shipping Policy', slug: 'shipping-policy', version: 'v1.1', updatedAt: '2 May 2026', updatedBy: 'Deepa Raghunathan', status: 'published', requiresAcceptance: true },
      { id: 'cms-6', title: 'About Krozenda', slug: 'about', version: 'v1.0', updatedAt: '1 Jan 2026', updatedBy: 'Priya Sharma', status: 'published', requiresAcceptance: false },
      { id: 'cms-7', title: 'Seller FAQ', slug: 'seller-faq', version: 'v0.3', updatedAt: '1 Sep 2026', updatedBy: 'Deepa Raghunathan', status: 'draft', requiresAcceptance: false },
      { id: 'cms-8', title: 'COD Policy', slug: 'cod-policy', version: 'v1.0', updatedAt: '14 Feb 2026', updatedBy: 'Priya Sharma', status: 'archived', requiresAcceptance: false },
    ],
  }
}

const CAMPAIGNS = [
  { id: 'cmp-1', name: 'Festive season launch', channel: 'push', audience: 'All app users', audienceSize: 18420, sentAt: '20 Aug 2026, 10:00', status: 'sent', delivered: 17284, opened: 5842 },
  { id: 'cmp-2', name: 'Order shipped alert', channel: 'sms', audience: 'Buyers with a shipment today', audienceSize: 1284, sentAt: '2 Sep 2026, 18:30', status: 'sent', delivered: 1276, opened: 0 },
  { id: 'cmp-3', name: 'B2B pricing invitation', channel: 'email', audience: 'Retail buyers with 5+ orders', audienceSize: 2408, sentAt: '28 Aug 2026, 11:00', status: 'sent', delivered: 2380, opened: 894 },
  { id: 'cmp-4', name: 'Abandoned cart nudge', channel: 'push', audience: 'Carts idle over 24 hours', audienceSize: 3620, sentAt: null, status: 'scheduled', delivered: 0, opened: 0 },
  { id: 'cmp-5', name: 'Diwali sale teaser', channel: 'push', audience: 'All app users', audienceSize: 18420, sentAt: null, status: 'draft', delivered: 0, opened: 0 },
  { id: 'cmp-6', name: 'KYC reminder to sellers', channel: 'sms', audience: 'Sellers with incomplete KYC', audienceSize: 12, sentAt: '1 Sep 2026, 09:00', status: 'failed', delivered: 0, opened: 0 },
]

const CAMPAIGN_TABS = {
  all: () => true,
  sent: (c) => c.status === 'sent',
  scheduled: (c) => c.status === 'scheduled',
  draft: (c) => c.status === 'draft',
  failed: (c) => c.status === 'failed',
}

export function campaignListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = CAMPAIGNS.filter(CAMPAIGN_TABS[tab] || CAMPAIGN_TABS.all)
  rows = search(rows, filters.search, ['name', 'audience'])
  if (filters.channel) rows = rows.filter((c) => c.channel === filters.channel)
  return page(rows, CAMPAIGNS, CAMPAIGN_TABS, query)
}

// Templates are DATA, not code (project context §12). DLT-approved SMS text
// cannot be edited freely once registered — which is exactly why it has to be
// swappable without a deploy.
export function templateListFixture() {
  return {
    items: [
      { id: 'tpl-1', name: 'Order placed', trigger: 'order.placed', channels: ['push', 'sms', 'email'], dltTemplateId: '1307161234567890123', dltStatus: 'approved', updatedAt: '4 Jul 2026', active: true },
      { id: 'tpl-2', name: 'Payment captured', trigger: 'payment.captured', channels: ['push', 'email'], dltTemplateId: null, dltStatus: 'not_required', updatedAt: '4 Jul 2026', active: true },
      { id: 'tpl-3', name: 'Order shipped', trigger: 'suborder.shipped', channels: ['push', 'sms'], dltTemplateId: '1307161234567890456', dltStatus: 'approved', updatedAt: '18 Jul 2026', active: true },
      { id: 'tpl-4', name: 'Out for delivery', trigger: 'suborder.out_for_delivery', channels: ['sms'], dltTemplateId: null, dltStatus: 'pending', updatedAt: '28 Aug 2026', active: false },
      { id: 'tpl-5', name: 'Delivered', trigger: 'suborder.delivered', channels: ['push', 'sms', 'email'], dltTemplateId: '1307161234567890789', dltStatus: 'approved', updatedAt: '18 Jul 2026', active: true },
      { id: 'tpl-6', name: 'RTO initiated', trigger: 'suborder.rto_initiated', channels: ['sms', 'email'], dltTemplateId: null, dltStatus: 'pending', updatedAt: '30 Aug 2026', active: false },
      { id: 'tpl-7', name: 'Refund processed', trigger: 'refund.completed', channels: ['sms', 'email'], dltTemplateId: null, dltStatus: 'rejected', updatedAt: '25 Aug 2026', active: false },
      { id: 'tpl-8', name: 'KYC approved', trigger: 'seller.kyc_approved', channels: ['email'], dltTemplateId: null, dltStatus: 'not_required', updatedAt: '4 Jul 2026', active: true },
      { id: 'tpl-9', name: 'Login OTP', trigger: 'auth.otp', channels: ['sms'], dltTemplateId: '1307161234567890012', dltStatus: 'approved', updatedAt: '1 Jan 2026', active: true },
    ],
  }
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
const REPORTS = {
  'sales-summary': { name: 'Sales summary', description: 'Orders, revenue and average order value by day', group: 'Sales' },
  'sales-by-model': { name: 'Sales by business model', description: 'Marketplace, dropshipping and own stock side by side', group: 'Sales' },
  'sales-by-category': { name: 'Sales by category', description: 'Revenue and units for every category', group: 'Sales' },
  'gst-summary': { name: 'GST summary', description: 'Taxable value and tax by rate and place of supply', group: 'Tax & finance' },
  'tcs-tds': { name: 'TCS and TDS collected', description: 'Section 52 and section 194-O, by vendor', group: 'Tax & finance' },
  'settlement-register': { name: 'Settlement register', description: 'Every batch, its deductions and its UTR', group: 'Tax & finance' },
  'vendor-performance': { name: 'Vendor performance', description: 'Acceptance, dispatch time, RTO rate and rating', group: 'Operations' },
  'rto-analysis': { name: 'RTO analysis', description: 'Return-to-origin by reason, courier and cost bearer', group: 'Operations' },
  'inventory-ageing': { name: 'Inventory ageing', description: 'Days of cover and slow-moving stock by bucket', group: 'Operations' },
  'customer-cohorts': { name: 'Customer cohorts', description: 'Repeat rate and lifetime value by joining month', group: 'Customers' },
}

export function reportCatalogueFixture() {
  const groups = {}
  for (const [key, report] of Object.entries(REPORTS)) {
    groups[report.group] = groups[report.group] || []
    groups[report.group].push({
      key,
      name: report.name,
      description: report.description,
      formats: ['CSV', 'Excel', 'PDF'],
      lastRunAt: key === 'sales-summary' ? '2 Sep 2026, 08:15' : key === 'gst-summary' ? '1 Sep 2026, 19:40' : null,
    })
  }
  return { groups: Object.entries(groups).map(([label, reports]) => ({ label, reports })) }
}

export function reportRunFixture(reportKey) {
  const report = REPORTS[reportKey] || REPORTS['sales-summary']

  return {
    key: reportKey,
    name: report.name,
    description: report.description,
    formats: ['CSV', 'Excel', 'PDF'],
    parameters: [
      { key: 'period', label: 'Period', type: 'date-range', value: '1 Aug – 31 Aug 2026' },
      {
        key: 'model',
        label: 'Business model',
        type: 'multiselect',
        options: [
          { value: 'marketplace', label: 'Marketplace' },
          { value: 'dropshipping', label: 'Dropshipping' },
          { value: 'own_stock', label: 'Own stock' },
        ],
        value: 'All',
      },
      {
        key: 'grouping',
        label: 'Group by',
        type: 'select',
        options: [
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ],
        value: 'day',
      },
    ],
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'units', label: 'Units', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right' },
      { key: 'aov', label: 'Average order value', align: 'right' },
    ],
    rows: [
      { date: '26 Aug 2026', orders: 284, units: 912, revenue: 3962400, aov: 13952 },
      { date: '27 Aug 2026', orders: 301, units: 968, revenue: 4204800, aov: 13969 },
      { date: '28 Aug 2026', orders: 276, units: 884, revenue: 3841200, aov: 13917 },
      { date: '29 Aug 2026', orders: 342, units: 1096, revenue: 4778400, aov: 13972 },
      { date: '30 Aug 2026', orders: 318, units: 1018, revenue: 4442400, aov: 13970 },
      { date: '31 Aug 2026', orders: 364, units: 1164, revenue: 5085600, aov: 13970 },
    ],
    rowCount: 31,
  }
}
