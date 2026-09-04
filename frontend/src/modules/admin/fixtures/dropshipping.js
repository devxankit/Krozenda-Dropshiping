import { REVIEW_STATUS } from '../constants'

// Shapes match schemas/dropshippingSchema.js. Money is in PAISE.

function page(rows, all, matchers, { page = 1, rowsPerPage = 25 } = {}) {
  const totalItems = rows.length
  return {
    items: rows.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage),
    page,
    rowsPerPage,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / rowsPerPage)),
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
// Overview Summary
// ---------------------------------------------------------------------------
export const DROPSHIP_OVERVIEW_STATS = Object.freeze({
  activePartners: 14,
  pendingPartners: 3,
  liveSkus: 1482,
  forwardedOrdersToday: 48,
  grossSalesToday: 18450000, // Rs 1,84,500
  platformMarginToday: 2767500, // Rs 27,675 (15% avg)
  autoForwardSuccessRate: 98.4,
  syncHealth: 'operational',
})

export const RECENT_FORWARDED_ORDERS = Object.freeze([
  {
    subOrderId: 'sub-9410-B',
    parentOrderId: 'ord-9410',
    partnerName: 'Arya Manufacturing',
    productName: 'Organic Cotton Bedsheet (King)',
    qty: 2,
    amount: 359800,
    commission: 53970,
    status: 'vendor_accepted',
    forwardedAt: '10 mins ago',
  },
  {
    subOrderId: 'sub-9408-A',
    parentOrderId: 'ord-9408',
    partnerName: 'Meghna Wholesale',
    productName: 'Stainless Steel Pressure Cooker 5L',
    qty: 1,
    amount: 249900,
    commission: 37485,
    status: 'packed',
    forwardedAt: '25 mins ago',
  },
  {
    subOrderId: 'sub-9405-C',
    parentOrderId: 'ord-9405',
    partnerName: 'Kritika Enterprises',
    productName: 'Wireless Bluetooth Soundbar 120W',
    qty: 1,
    amount: 599900,
    commission: 89985,
    status: 'auto_assigned',
    forwardedAt: '42 mins ago',
  },
  {
    subOrderId: 'sub-9399-A',
    parentOrderId: 'ord-9399',
    partnerName: 'Deccan Spice Traders',
    productName: 'Premium Spices Gift Box (Set of 6)',
    qty: 3,
    amount: 449700,
    commission: 67455,
    status: 'shipped',
    forwardedAt: '1 hour ago',
  },
])

// ---------------------------------------------------------------------------
// Dropship Partners / Suppliers
// ---------------------------------------------------------------------------
const DROPSHIP_PARTNERS = [
  {
    id: 'prt-1902',
    name: 'Arya Manufacturing',
    supplierType: 'Manufacturer',
    city: 'Delhi',
    gstin: '07AACCA1234M1Z5',
    integrationMode: 'REST API Adapter',
    products: 214,
    ordersCount: 1102,
    revenue: 186400000,
    kycStatus: REVIEW_STATUS.APPROVED,
    routeLinked: true,
    autoForward: true,
    joinedAt: '18 Jun 2026',
    status: 'active',
  },
  {
    id: 'prt-2077',
    name: 'Meghna Wholesale',
    supplierType: 'Wholesaler',
    city: 'Indore',
    gstin: '23AAGCM7761P1ZR',
    integrationMode: 'CSV / Excel Feed',
    products: 508,
    ordersCount: 864,
    revenue: 142900000,
    kycStatus: REVIEW_STATUS.APPROVED,
    routeLinked: true,
    autoForward: true,
    joinedAt: '2 May 2026',
    status: 'active',
  },
  {
    id: 'prt-2266',
    name: 'Kritika Enterprises',
    supplierType: 'Distributor',
    city: 'Jaipur',
    gstin: '08AAHCK6612L1Z4',
    integrationMode: 'REST API Adapter',
    products: 88,
    ordersCount: 504,
    revenue: 71200000,
    kycStatus: REVIEW_STATUS.CHANGES_REQUESTED,
    routeLinked: false,
    autoForward: false,
    joinedAt: '19 Aug 2026',
    status: 'pending',
  },
  {
    id: 'prt-2488',
    name: 'Deccan Spice Traders',
    supplierType: 'Trader',
    city: 'Hyderabad',
    gstin: '36AADCD9811K1Z3',
    integrationMode: 'CSV / Excel Feed',
    products: 164,
    ordersCount: 420,
    revenue: 54800000,
    kycStatus: REVIEW_STATUS.REVIEWING,
    routeLinked: true,
    autoForward: true,
    joinedAt: '1 Sep 2026',
    status: 'pending',
  },
  {
    id: 'prt-2492',
    name: 'Ganga Handicrafts',
    supplierType: 'Company',
    city: 'Varanasi',
    gstin: '09AABCG4412R1Z9',
    integrationMode: 'Manual Portal',
    products: 120,
    ordersCount: 290,
    revenue: 38200000,
    kycStatus: REVIEW_STATUS.APPROVED,
    routeLinked: true,
    autoForward: true,
    joinedAt: '15 Jul 2026',
    status: 'active',
  },
]

const PARTNER_TABS = {
  all: () => true,
  active: (p) => p.status === 'active',
  pending: (p) => p.status === 'pending',
  api_integrated: (p) => p.integrationMode.includes('API'),
}

export function dropshipPartnerListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = DROPSHIP_PARTNERS.filter(PARTNER_TABS[tab] || PARTNER_TABS.all)
  rows = search(rows, filters.search, ['name', 'city', 'gstin', 'supplierType'])
  if (filters.supplierType) rows = rows.filter((p) => p.supplierType === filters.supplierType)
  if (filters.integrationMode) rows = rows.filter((p) => p.integrationMode.includes(filters.integrationMode))
  return page(rows, DROPSHIP_PARTNERS, PARTNER_TABS, query)
}

// ---------------------------------------------------------------------------
// Dropship Products & Catalog
// ---------------------------------------------------------------------------
const DROPSHIP_PRODUCTS = [
  {
    id: 'dsp-101',
    sku: 'ARY-BED-KNG',
    name: 'Organic Cotton Bedsheet (King)',
    partnerName: 'Arya Manufacturing',
    category: 'Home & Living',
    costPrice: 125000, // Rs 1,250 supplier base cost
    sellingPrice: 179900, // Rs 1,799 retail
    marginPct: 30.5,
    supplierStock: 450,
    syncStatus: 'operational',
    lastSyncAt: '10 mins ago',
    overrideActive: false,
  },
  {
    id: 'dsp-102',
    sku: 'MEG-COOK-5L',
    name: 'Stainless Steel Pressure Cooker 5L',
    partnerName: 'Meghna Wholesale',
    category: 'Kitchenware',
    costPrice: 185000,
    sellingPrice: 249900,
    marginPct: 26.0,
    supplierStock: 120,
    syncStatus: 'operational',
    lastSyncAt: '15 mins ago',
    overrideActive: true,
  },
  {
    id: 'dsp-103',
    sku: 'KRT-SND-120W',
    name: 'Wireless Bluetooth Soundbar 120W',
    partnerName: 'Kritika Enterprises',
    category: 'Electronics',
    costPrice: 420000,
    sellingPrice: 599900,
    marginPct: 30.0,
    supplierStock: 0,
    syncStatus: 'sync_error',
    lastSyncAt: '2 hours ago',
    overrideActive: false,
  },
  {
    id: 'dsp-104',
    sku: 'DEC-SPC-GFT',
    name: 'Premium Spices Gift Box (Set of 6)',
    partnerName: 'Deccan Spice Traders',
    category: 'Gourmet & Spices',
    costPrice: 85000,
    sellingPrice: 149900,
    marginPct: 43.3,
    supplierStock: 890,
    syncStatus: 'operational',
    lastSyncAt: '5 mins ago',
    overrideActive: false,
  },
]

const PRODUCT_TABS = {
  all: () => true,
  in_stock: (p) => p.supplierStock > 0,
  out_of_stock: (p) => p.supplierStock === 0,
  sync_issues: (p) => p.syncStatus === 'sync_error',
}

export function dropshipProductListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = DROPSHIP_PRODUCTS.filter(PRODUCT_TABS[tab] || PRODUCT_TABS.all)
  rows = search(rows, filters.search, ['name', 'sku', 'partnerName', 'category'])
  if (filters.partnerName) rows = rows.filter((p) => p.partnerName === filters.partnerName)
  return page(rows, DROPSHIP_PRODUCTS, PRODUCT_TABS, query)
}

// ---------------------------------------------------------------------------
// Auto-Forwarded Sub-Orders
// ---------------------------------------------------------------------------
const FORWARDED_ORDERS = [
  {
    id: 'sub-9410-B',
    parentOrderId: 'ord-9410',
    customerName: 'Ananya Iyer',
    partnerName: 'Arya Manufacturing',
    productName: 'Organic Cotton Bedsheet (King)',
    quantity: 2,
    orderValue: 359800,
    commissionAmount: 53970,
    supplierPayable: 305830,
    forwardingStatus: 'vendor_accepted',
    awb: 'SRK-984120-DEL',
    placedAt: '2 Sep 2026 16:45',
  },
  {
    id: 'sub-9408-A',
    parentOrderId: 'ord-9408',
    customerName: 'Rakesh Menon',
    partnerName: 'Meghna Wholesale',
    productName: 'Stainless Steel Pressure Cooker 5L',
    quantity: 1,
    orderValue: 249900,
    commissionAmount: 37485,
    supplierPayable: 212415,
    forwardingStatus: 'packed',
    awb: 'SRK-983301-BHI',
    placedAt: '2 Sep 2026 15:30',
  },
  {
    id: 'sub-9405-C',
    parentOrderId: 'ord-9405',
    customerName: 'Sneha Kulkarni',
    partnerName: 'Kritika Enterprises',
    productName: 'Wireless Bluetooth Soundbar 120W',
    quantity: 1,
    orderValue: 599900,
    commissionAmount: 89985,
    supplierPayable: 509915,
    forwardingStatus: 'auto_assigned',
    awb: null,
    placedAt: '2 Sep 2026 14:10',
  },
  {
    id: 'sub-9399-A',
    parentOrderId: 'ord-9399',
    customerName: 'Meera Nair',
    partnerName: 'Deccan Spice Traders',
    productName: 'Premium Spices Gift Box (Set of 6)',
    quantity: 3,
    orderValue: 449700,
    commissionAmount: 67455,
    supplierPayable: 382245,
    forwardingStatus: 'shipped',
    awb: 'SRK-977410-HYD',
    placedAt: '2 Sep 2026 11:20',
  },
]

const ORDER_TABS = {
  all: () => true,
  awaiting_partner: (o) => o.forwardingStatus === 'auto_assigned',
  accepted: (o) => o.forwardingStatus === 'vendor_accepted' || o.forwardingStatus === 'packed',
  shipped: (o) => o.forwardingStatus === 'shipped',
}

export function forwardedOrderListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = FORWARDED_ORDERS.filter(ORDER_TABS[tab] || ORDER_TABS.all)
  rows = search(rows, filters.search, ['id', 'parentOrderId', 'customerName', 'partnerName', 'productName'])
  return page(rows, FORWARDED_ORDERS, ORDER_TABS, query)
}

// ---------------------------------------------------------------------------
// Margin & Commission Rules
// ---------------------------------------------------------------------------
const MARGIN_RULES = [
  {
    id: 'cm-rule-01',
    ruleName: 'Default Minimum Platform Margin',
    scope: 'default',
    targetName: 'All Dropship Products',
    commissionType: 'percentage',
    value: 15.0,
    manualOverrideAllowed: true,
    status: 'active',
  },
  {
    id: 'cm-rule-02',
    ruleName: 'Electronics Category Commission',
    scope: 'category',
    targetName: 'Electronics & Gadgets',
    commissionType: 'percentage',
    value: 12.0,
    manualOverrideAllowed: true,
    status: 'active',
  },
  {
    id: 'cm-rule-03',
    ruleName: 'Arya Manufacturing Preferred Rate',
    scope: 'vendor',
    targetName: 'Arya Manufacturing',
    commissionType: 'percentage',
    value: 18.0,
    manualOverrideAllowed: true,
    status: 'active',
  },
]

export function dropshipMarginRulesFixture() {
  return MARGIN_RULES
}
