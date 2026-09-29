import { REVIEW_STATUS } from '../constants'

// Shapes match schemas/peopleSchema.js. Money is in PAISE.

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
// Customers
// ---------------------------------------------------------------------------
const CUSTOMERS = [
  { id: 'cus-8801', name: 'Ananya Iyer', email: 'ananya.iyer@example.in', phone: '+91 98455 20114', city: 'Bengaluru', type: 'retail', orders: 14, lifetimeValue: 4820000, lastOrderAt: '2 Sep 2026', status: 'active' },
  { id: 'cus-8790', name: 'Rakesh Menon', email: 'rakesh.menon@example.in', phone: '+91 98470 11228', city: 'Kochi', type: 'retail', orders: 6, lifetimeValue: 2140000, lastOrderAt: '2 Sep 2026', status: 'active' },
  { id: 'cus-4410', name: 'Bharat Textiles LLP', email: 'accounts@bharattextiles.in', phone: '+91 98250 44710', city: 'Surat', type: 'b2b_dealer', orders: 42, lifetimeValue: 128400000, lastOrderAt: '2 Sep 2026', status: 'active' },
  { id: 'cus-8712', name: 'Sneha Kulkarni', email: 'sneha.k@example.in', phone: '+91 98220 76401', city: 'Pune', type: 'retail', orders: 21, lifetimeValue: 6940000, lastOrderAt: '1 Sep 2026', status: 'active' },
  { id: 'cus-4102', name: 'Kritika Enterprises', email: 'orders@kritika.co.in', phone: '+91 98290 33812', city: 'Jaipur', type: 'b2b_distributor', orders: 68, lifetimeValue: 284600000, lastOrderAt: '1 Sep 2026', status: 'active' },
  { id: 'cus-8654', name: 'Imran Qureshi', email: 'imran.q@example.in', phone: '+91 98490 55123', city: 'Hyderabad', type: 'retail', orders: 3, lifetimeValue: 486000, lastOrderAt: '1 Sep 2026', status: 'active' },
  { id: 'cus-4288', name: 'Meghna Wholesale', email: 'purchase@meghnawholesale.in', phone: '+91 98260 71144', city: 'Indore', type: 'b2b_wholesaler', orders: 96, lifetimeValue: 412800000, lastOrderAt: '31 Aug 2026', status: 'active' },
  { id: 'cus-8601', name: 'Meera Nair', email: 'meera.nair@example.in', phone: '+91 98460 22890', city: 'Thrissur', type: 'retail', orders: 9, lifetimeValue: 2860000, lastOrderAt: '1 Sep 2026', status: 'active' },
  { id: 'cus-8501', name: 'Arjun Pillai', email: 'arjun.p@example.in', phone: '+91 98400 61207', city: 'Chennai', type: 'retail', orders: 2, lifetimeValue: 324000, lastOrderAt: '31 Aug 2026', status: 'active' },
  { id: 'cus-8412', name: 'Nikhil Bose', email: 'nikhil.bose@example.in', phone: '+91 98300 44012', city: 'Kolkata', type: 'retail', orders: 1, lifetimeValue: 129900, lastOrderAt: '12 Mar 2026', status: 'dormant' },
  { id: 'cus-4390', name: 'Rathore Trading Co', email: 'rathore.trading@example.in', phone: '+91 98280 90114', city: 'Jodhpur', type: 'b2b_trader', orders: 18, lifetimeValue: 62400000, lastOrderAt: '18 Aug 2026', status: 'active' },
  { id: 'cus-8377', name: 'Kavya Reddy', email: 'kavya.r@example.in', phone: '+91 98480 30076', city: 'Vijayawada', type: 'retail', orders: 0, lifetimeValue: 0, lastOrderAt: null, status: 'blocked' },
]

const CUSTOMER_TABS = {
  all: () => true,
  retail: (c) => c.type === 'retail',
  b2b: (c) => c.type !== 'retail',
  dormant: (c) => c.status === 'dormant',
  blocked: (c) => c.status === 'blocked',
}

export function customerListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = CUSTOMERS.filter(CUSTOMER_TABS[tab] || CUSTOMER_TABS.all)
  rows = search(rows, filters.search, ['name', 'email', 'phone', 'city'])
  if (filters.type) rows = rows.filter((c) => c.type === filters.type)
  return page(rows, CUSTOMERS, CUSTOMER_TABS, query)
}

// ---------------------------------------------------------------------------
// Vendors — marketplace sellers, dropshipping partners and own stock
// ---------------------------------------------------------------------------
const VENDORS = [
  { id: 'slr-2184', name: 'Nova Retail Pvt Ltd', model: 'marketplace', role: 'Vendor / Seller', city: 'Mumbai', gstin: '27AAFCN9612R1ZQ', products: 386, orders: 1284, revenue: 214600000, kycStatus: REVIEW_STATUS.REVIEWING, routeLinked: false, joinedAt: '24 Aug 2026', status: 'pending' },
  { id: 'slr-1902', name: 'Arya Manufacturing', model: 'dropshipping', role: 'Manufacturer', city: 'Delhi', gstin: '07AACCA1234M1Z5', products: 214, orders: 1102, revenue: 186400000, kycStatus: REVIEW_STATUS.APPROVED, routeLinked: true, joinedAt: '18 Jun 2026', status: 'active' },
  { id: 'own-001', name: 'Krozenda Own Stock', model: 'own_stock', role: 'Platform', city: 'Bhiwandi', gstin: '27AAECK4821M1Z9', products: 142, orders: 1120, revenue: 156840000, kycStatus: REVIEW_STATUS.NOT_APPLICABLE, routeLinked: false, joinedAt: '1 Jan 2026', status: 'active' },
  { id: 'slr-2077', name: 'Meghna Wholesale', model: 'dropshipping', role: 'Wholesaler', city: 'Indore', gstin: '23AAGCM7761P1ZR', products: 508, orders: 864, revenue: 142900000, kycStatus: REVIEW_STATUS.APPROVED, routeLinked: true, joinedAt: '2 May 2026', status: 'active' },
  { id: 'slr-1640', name: 'Sunrise Traders', model: 'marketplace', role: 'Trader', city: 'Jaipur', gstin: '08AAJCS4410N1Z2', products: 96, orders: 742, revenue: 98200000, kycStatus: REVIEW_STATUS.APPROVED, routeLinked: true, joinedAt: '12 Feb 2026', status: 'suspended' },
  { id: 'slr-2410', name: 'Bharat Textiles LLP', model: 'marketplace', role: 'Company', city: 'Surat', gstin: '24AAFFB2201K1Z8', products: 294, orders: 618, revenue: 86400000, kycStatus: REVIEW_STATUS.APPROVED, routeLinked: true, joinedAt: '21 Apr 2026', status: 'active' },
  { id: 'slr-2266', name: 'Kritika Enterprises', model: 'dropshipping', role: 'Distributor', city: 'Jaipur', gstin: '08AAHCK6612L1Z4', products: 88, orders: 504, revenue: 71200000, kycStatus: REVIEW_STATUS.CHANGES_REQUESTED, routeLinked: false, joinedAt: '19 Aug 2026', status: 'pending' },
  { id: 'slr-2501', name: 'Vaidya Ayurveda Works', model: 'marketplace', role: 'Manufacturer', city: 'Nashik', gstin: null, products: 0, orders: 0, revenue: 0, kycStatus: REVIEW_STATUS.SUBMITTED, routeLinked: false, joinedAt: '30 Aug 2026', status: 'pending' },
]

const VENDOR_TABS = {
  all: () => true,
  marketplace: (v) => v.model === 'marketplace',
  dropshipping: (v) => v.model === 'dropshipping',
  pending: (v) => v.status === 'pending',
  suspended: (v) => v.status === 'suspended',
}

export function vendorListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = VENDORS.filter(VENDOR_TABS[tab] || VENDOR_TABS.all)
  rows = search(rows, filters.search, ['name', 'city', 'gstin', 'role'])
  if (filters.model) rows = rows.filter((v) => v.model === filters.model)
  if (filters.kycStatus) rows = rows.filter((v) => v.kycStatus === filters.kycStatus)
  return page(rows, VENDORS, VENDOR_TABS, query)
}

// ---------------------------------------------------------------------------
// KYC — document collection plus MANUAL admin review. No third-party API
// validates any of these (project context §5.1); a person does.
// ---------------------------------------------------------------------------
const KYC_QUEUE = [
  { id: 'kyc-2184', vendorName: 'Nova Retail Pvt Ltd', role: 'Vendor / Seller', submittedAt: '29 Aug 2026', waitingDays: 4, documentsApproved: 3, documentsRequired: 5, status: REVIEW_STATUS.REVIEWING },
  { id: 'kyc-2501', vendorName: 'Vaidya Ayurveda Works', role: 'Manufacturer', submittedAt: '30 Aug 2026', waitingDays: 3, documentsApproved: 0, documentsRequired: 6, status: REVIEW_STATUS.SUBMITTED },
  { id: 'kyc-2266', vendorName: 'Kritika Enterprises', role: 'Distributor', submittedAt: '19 Aug 2026', waitingDays: 14, documentsApproved: 4, documentsRequired: 5, status: REVIEW_STATUS.CHANGES_REQUESTED },
  { id: 'kyc-2488', vendorName: 'Deccan Spice Traders', role: 'Trader', submittedAt: '1 Sep 2026', waitingDays: 1, documentsApproved: 2, documentsRequired: 5, status: REVIEW_STATUS.REVIEWING },
  { id: 'kyc-2492', vendorName: 'Ganga Handicrafts', role: 'Company', submittedAt: '31 Aug 2026', waitingDays: 2, documentsApproved: 5, documentsRequired: 5, status: REVIEW_STATUS.REVIEWING },
  { id: 'kyc-2455', vendorName: 'Konkan Seafoods', role: 'Manufacturer', submittedAt: '27 Aug 2026', waitingDays: 6, documentsApproved: 4, documentsRequired: 6, status: REVIEW_STATUS.REVIEWING },
]

const KYC_TABS = {
  all: () => true,
  new: (k) => k.status === REVIEW_STATUS.SUBMITTED,
  reviewing: (k) => k.status === REVIEW_STATUS.REVIEWING,
  changes: (k) => k.status === REVIEW_STATUS.CHANGES_REQUESTED,
  overdue: (k) => k.waitingDays > 3,
}

export function kycQueueFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = KYC_QUEUE.filter(KYC_TABS[tab] || KYC_TABS.all)
  rows = search(rows, filters.search, ['id', 'vendorName', 'role'])
  return page(rows, KYC_QUEUE, KYC_TABS, query)
}

export function kycApplicationFixture(applicationId) {
  const summary = KYC_QUEUE.find((k) => k.id === applicationId) || KYC_QUEUE[0]
  return {
    id: summary.id,
    vendorId: 'slr-2184',
    vendorName: summary.vendorName,
    role: summary.role,
    model: 'Marketplace seller',
    submittedAt: summary.submittedAt,
    waitingDays: summary.waitingDays,
    status: summary.status,
    business: {
      constitution: 'Private Limited',
      pan: 'AAFCN9612R',
      gstin: '27AAFCN9612R1ZQ',
      categories: ['Home & Kitchen', 'Home Décor'],
      pickupPincode: '400072',
      contactName: 'Rohan Mehta',
      contactPhone: '+91 98204 11276',
    },
    payout: {
      bank: 'HDFC Bank, Andheri East',
      accountMasked: 'XXXX XXXX 4417',
      ifsc: 'HDFC0000521',
      routeLinked: false,
    },
    documents: [
      { id: 'doc-1', type: 'PAN card', fileName: 'pan-novaretail.pdf', fileSize: '412 KB', uploadedAt: '24 Aug 2026', status: REVIEW_STATUS.APPROVED, required: true, rejectionReason: null },
      { id: 'doc-2', type: 'Aadhaar (authorised signatory)', fileName: 'aadhaar-rmehta.pdf', fileSize: '388 KB', uploadedAt: '24 Aug 2026', status: REVIEW_STATUS.APPROVED, required: true, rejectionReason: null },
      { id: 'doc-3', type: 'GST registration certificate', fileName: 'gst-27AAFCN9612R1ZQ.pdf', fileSize: '1.1 MB', uploadedAt: '29 Aug 2026', status: REVIEW_STATUS.REVIEWING, required: true, rejectionReason: null },
      { id: 'doc-4', type: 'Cancelled cheque', fileName: 'cheque-hdfc.jpg', fileSize: '540 KB', uploadedAt: '24 Aug 2026', status: REVIEW_STATUS.REJECTED, required: true, rejectionReason: 'Account name does not match the PAN. Resubmission requested on 27 Aug.' },
      { id: 'doc-5', type: 'Address proof — electricity bill', fileName: 'addr-proof-aug.jpg', fileSize: '720 KB', uploadedAt: '24 Aug 2026', status: REVIEW_STATUS.APPROVED, required: true, rejectionReason: null },
      { id: 'doc-6', type: 'FSSAI licence', fileName: null, fileSize: null, uploadedAt: null, status: REVIEW_STATUS.NOT_APPLICABLE, required: false, rejectionReason: null },
    ],
    policyAcceptances: [
      { policy: 'Vendor Agreement', version: 'v2.1', acceptedAt: '24 Aug 2026, 15:08', ip: '49.36.180.22', superseded: false },
      { policy: 'Privacy Policy', version: 'v1.4', acceptedAt: '24 Aug 2026, 15:08', ip: '49.36.180.22', superseded: false },
      { policy: 'Terms & Conditions', version: 'v3.0', acceptedAt: '24 Aug 2026, 15:09', ip: '49.36.180.22', superseded: false },
      { policy: 'Return Policy', version: 'v1.2', acceptedAt: '24 Aug 2026, 15:09', ip: '49.36.180.22', superseded: true },
    ],
  }
}

// ---------------------------------------------------------------------------
// Staff & roles
// ---------------------------------------------------------------------------