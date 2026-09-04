import { ADMIN_ROLE_PRESETS, ALL_ADMIN_PERMISSIONS, REVIEW_STATUS } from '../constants'

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
// Policy acceptances — who agreed to which version, when, from where
// ---------------------------------------------------------------------------
const ACCEPTANCES = [
  { id: 'pa-1', party: 'Nova Retail Pvt Ltd', partyType: 'Seller', policy: 'Vendor Agreement', version: 'v2.1', acceptedAt: '24 Aug 2026, 15:08', ip: '49.36.180.22', current: true },
  { id: 'pa-2', party: 'Nova Retail Pvt Ltd', partyType: 'Seller', policy: 'Return Policy', version: 'v1.2', acceptedAt: '24 Aug 2026, 15:09', ip: '49.36.180.22', current: false },
  { id: 'pa-3', party: 'Arya Manufacturing', partyType: 'Partner', policy: 'Vendor Agreement', version: 'v2.1', acceptedAt: '18 Jun 2026, 09:44', ip: '103.21.58.90', current: true },
  { id: 'pa-4', party: 'Arya Manufacturing', partyType: 'Partner', policy: 'Return Policy', version: 'v1.3', acceptedAt: '20 Aug 2026, 11:02', ip: '103.21.58.90', current: true },
  { id: 'pa-5', party: 'Ananya Iyer', partyType: 'Buyer', policy: 'Terms & Conditions', version: 'v3.0', acceptedAt: '4 Mar 2026, 20:11', ip: '157.32.14.201', current: true },
  { id: 'pa-6', party: 'Meghna Wholesale', partyType: 'Partner', policy: 'Vendor Agreement', version: 'v2.0', acceptedAt: '2 May 2026, 12:30', ip: '106.51.72.14', current: false },
  { id: 'pa-7', party: 'Bharat Textiles LLP', partyType: 'Seller', policy: 'Privacy Policy', version: 'v1.4', acceptedAt: '21 Apr 2026, 17:55', ip: '117.230.44.8', current: true },
  { id: 'pa-8', party: 'Sunrise Traders', partyType: 'Seller', policy: 'Vendor Agreement', version: 'v2.0', acceptedAt: '12 Feb 2026, 10:18', ip: '182.70.11.65', current: false },
]

const ACCEPTANCE_TABS = {
  all: () => true,
  current: (a) => a.current,
  superseded: (a) => !a.current,
}

export function policyAcceptanceFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = ACCEPTANCES.filter(ACCEPTANCE_TABS[tab] || ACCEPTANCE_TABS.all)
  rows = search(rows, filters.search, ['party', 'policy', 'version', 'ip'])
  return page(rows, ACCEPTANCES, ACCEPTANCE_TABS, query)
}

// ---------------------------------------------------------------------------
// Staff & roles
// ---------------------------------------------------------------------------
export function staffListFixture() {
  return {
    items: [
      { id: 'usr-1', name: 'Priya Sharma', email: 'priya.sharma@krozenda.in', role: 'Super Admin', roleId: 'super_admin', lastSignInAt: '2 Sep 2026, 09:14', twoFactor: true, status: 'active' },
      { id: 'usr-2', name: 'Anil Varma', email: 'anil.varma@krozenda.in', role: 'Finance Manager', roleId: 'finance_manager', lastSignInAt: '2 Sep 2026, 08:40', twoFactor: true, status: 'active' },
      { id: 'usr-3', name: 'Deepa Raghunathan', email: 'deepa.r@krozenda.in', role: 'Operations', roleId: 'operations', lastSignInAt: '1 Sep 2026, 18:22', twoFactor: true, status: 'active' },
      { id: 'usr-4', name: 'Sanjay Kulkarni', email: 'sanjay.k@krozenda.in', role: 'Operations', roleId: 'operations', lastSignInAt: '30 Aug 2026, 11:05', twoFactor: false, status: 'active' },
      { id: 'usr-5', name: 'M. Balasubramanian', email: 'ca@balasubramanian.co.in', role: 'CA / Auditor', roleId: 'ca_auditor', lastSignInAt: '28 Aug 2026, 15:30', twoFactor: true, status: 'active' },
      { id: 'usr-6', name: 'Nisha Patel', email: 'nisha.patel@krozenda.in', role: 'Operations', roleId: 'operations', lastSignInAt: null, twoFactor: false, status: 'invited' },
      { id: 'usr-7', name: 'Rahul Bhatt', email: 'rahul.bhatt@krozenda.in', role: 'Operations', roleId: 'operations', lastSignInAt: '14 Jul 2026, 09:50', twoFactor: false, status: 'suspended' },
    ],
  }
}

const ROLES = [
  { id: 'super_admin', name: 'Super Admin', surface: 'Admin panel', description: 'Full access. Can create other admins. Audit trail is immutable.', memberCount: 1, immutable: true },
  { id: 'finance_manager', name: 'Finance Manager', surface: 'Admin panel', description: 'Prepares payout drafts and posts journal entries. Cannot approve payouts or touch vendors.', memberCount: 1, immutable: false },
  { id: 'ca_auditor', name: 'CA / Auditor', surface: 'Admin panel', description: 'Reads every financial statement and exports statutory returns. Changes nothing.', memberCount: 1, immutable: false },
  { id: 'operations', name: 'Operations', surface: 'Admin panel', description: 'Catalog, orders, KYC review. No finance and no settings.', memberCount: 4, immutable: false },
]

export function roleListFixture() {
  return {
    items: ROLES.map((role) => ({
      ...role,
      permissionCount: (ADMIN_ROLE_PRESETS[role.id] || []).length,
    })),
  }
}

const PERMISSION_GROUPS = [
  {
    label: 'Overview',
    permissions: [
      { key: 'admin.dashboard.view', label: 'View dashboard', description: 'The platform overview and its action queues' },
      { key: 'admin.analytics.view', label: 'View analytics', description: 'Sales, vendor, catalog and customer analytics' },
    ],
  },
  {
    label: 'Catalog',
    permissions: [
      { key: 'admin.catalog.view', label: 'View catalog', description: 'Products, categories, brands and inventory' },
      { key: 'admin.catalog.manage', label: 'Manage catalog', description: 'Create and edit products, categories and brands' },
      { key: 'admin.catalog.approve', label: 'Approve listings', description: 'Release a category, brand or product to the storefront' },
    ],
  },
  {
    label: 'Orders',
    permissions: [
      { key: 'admin.orders.view', label: 'View orders', description: 'Orders, sub-orders, shipments and invoices' },
      { key: 'admin.orders.manage', label: 'Manage orders', description: 'Assign vendors, generate AWBs, mark packed' },
      { key: 'admin.orders.cancel', label: 'Cancel orders', description: 'Cancel a sub-order and trigger its refund' },
      { key: 'admin.returns.manage', label: 'Resolve returns', description: 'Approve or reject a return, issue a replacement' },
    ],
  },
  {
    label: 'People',
    permissions: [
      { key: 'admin.people.view', label: 'View people', description: 'Customers, sellers, partners and companies' },
      { key: 'admin.people.manage', label: 'Manage people', description: 'Suspend, reinstate and edit vendor records' },
      { key: 'admin.kyc.review', label: 'Review KYC', description: 'Approve or reject submitted documents' },
      { key: 'admin.roles.manage', label: 'Manage roles', description: 'Change who can do what' },
    ],
  },
  {
    label: 'Finance',
    permissions: [
      { key: 'admin.finance.view', label: 'View finance', description: 'Transactions, refunds and settlement position' },
      { key: 'admin.finance.manage', label: 'Manage finance', description: 'Commission and pricing rules' },
      { key: 'admin.payout.prepare', label: 'Prepare payouts', description: 'Build a settlement batch as a draft' },
      { key: 'admin.payout.approve', label: 'Approve payouts', description: 'Release a batch — money leaves the platform' },
      { key: 'admin.accounting.view', label: 'View ledgers', description: 'P&L, balance sheet, trial balance, cash flow' },
      { key: 'admin.accounting.post', label: 'Post entries', description: 'Journal vouchers and expenses' },
      { key: 'admin.tax.export', label: 'Export tax returns', description: 'GSTR-1, GSTR-3B, GSTR-8 and Form 26Q' },
    ],
  },
  {
    label: 'System',
    permissions: [
      { key: 'admin.marketing.view', label: 'View marketing', description: 'Coupons, offers, banners and CMS' },
      { key: 'admin.marketing.manage', label: 'Manage marketing', description: 'Publish campaigns and edit templates' },
      { key: 'admin.reports.view', label: 'Run reports', description: 'The report centre and its exports' },
      { key: 'admin.settings.view', label: 'View settings', description: 'Platform, integration and security settings' },
      { key: 'admin.settings.manage', label: 'Change settings', description: 'Edit business rules and integration credentials' },
      { key: 'admin.audit.view', label: 'View audit log', description: 'Every privileged action, with before and after' },
      { key: 'admin.system.manage', label: 'Manage system', description: 'Backups and platform maintenance' },
    ],
  },
]

export function roleDetailFixture(roleId) {
  const role = ROLES.find((r) => r.id === roleId) || ROLES[0]
  const granted = new Set(ADMIN_ROLE_PRESETS[role.id] || ALL_ADMIN_PERMISSIONS)

  return {
    ...role,
    groups: PERMISSION_GROUPS.map((group) => ({
      label: group.label,
      permissions: group.permissions.map((permission) => ({
        ...permission,
        granted: granted.has(permission.key),
      })),
    })),
  }
}
