// Mock data for Vendor Panel (Seller & Dropshipping Partner). Money in PAISE.

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
// Vendor Summary KPIs & Dashboard
// ---------------------------------------------------------------------------
export const VENDOR_SUMMARY_KPI = Object.freeze({
  storeName: 'Arya Manufacturing',
  status: 'approved',
  totalRevenue: 186400000, // Rs 18,64,000
  pendingOrdersCount: 6,
  liveSkusCount: 214,
  availablePayout: 32450000, // Rs 3,24,500
  kycStatus: 'approved',
  routeLinked: true,
})

// ---------------------------------------------------------------------------
// Vendor Products
// ---------------------------------------------------------------------------
const VENDOR_PRODUCTS = [
  {
    id: 'vp-101',
    sku: 'ARY-BED-KNG',
    name: 'Organic Cotton Bedsheet (King Size)',
    category: 'Home & Living',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=150',
    costPrice: 125000, // Rs 1,250
    sellingPrice: 179900, // Rs 1,799
    b2bPrice: 145000, // Rs 1,450
    marginPct: 30.5,
    stock: 450,
    moq: 1,
    status: 'active',
    updatedAt: '2 Sep 2026',
  },
  {
    id: 'vp-102',
    sku: 'ARY-DUV-SGL',
    name: 'Microfiber Single Duvet Quilt',
    category: 'Home & Living',
    imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=150',
    costPrice: 180000,
    sellingPrice: 249900,
    b2bPrice: 200000,
    marginPct: 28.0,
    stock: 120,
    moq: 1,
    status: 'active',
    updatedAt: '1 Sep 2026',
  },
  {
    id: 'vp-103',
    sku: 'ARY-PIL-SET2',
    name: 'Ergonomic Memory Foam Pillows (Set of 2)',
    category: 'Home & Living',
    imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=150',
    costPrice: 95000,
    sellingPrice: 139900,
    b2bPrice: 110000,
    marginPct: 32.1,
    stock: 0,
    moq: 2,
    status: 'out_of_stock',
    updatedAt: '28 Aug 2026',
  },
  {
    id: 'vp-104',
    sku: 'ARY-CUR-9FT',
    name: 'Blackout Window Curtains 9 Feet (Set of 2)',
    category: 'Home & Decor',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=150',
    costPrice: 140000,
    sellingPrice: 199900,
    b2bPrice: 160000,
    marginPct: 30.0,
    stock: 85,
    moq: 1,
    status: 'pending_approval',
    updatedAt: '30 Aug 2026',
  },
]

const PRODUCT_TABS = {
  all: () => true,
  active: (p) => p.status === 'active',
  out_of_stock: (p) => p.stock === 0 || p.status === 'out_of_stock',
  pending: (p) => p.status === 'pending_approval',
}

export function vendorProductListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = VENDOR_PRODUCTS.filter(PRODUCT_TABS[tab] || PRODUCT_TABS.all)
  rows = search(rows, filters.search, ['name', 'sku', 'category'])
  if (filters.status) rows = rows.filter((p) => p.status === filters.status)
  return page(rows, VENDOR_PRODUCTS, PRODUCT_TABS, query)
}

// ---------------------------------------------------------------------------
// Vendor Assigned Orders
// ---------------------------------------------------------------------------
const VENDOR_ORDERS = [
  {
    id: 'sub-9410-B',
    parentOrderId: 'ord-9410',
    customerName: 'Ananya Iyer',
    phone: '+91 98455 20114',
    shippingAddress: '104 Palm Grove, Indiranagar, Bengaluru - 560038',
    productName: 'Organic Cotton Bedsheet (King Size)',
    quantity: 2,
    orderValue: 359800,
    commissionAmount: 53970,
    netPayable: 305830,
    forwardingStatus: 'vendor_accepted',
    awb: 'SRK-984120-DEL',
    placedAt: '2 Sep 2026 16:45',
  },
  {
    id: 'sub-9402-A',
    parentOrderId: 'ord-9402',
    customerName: 'Sneha Kulkarni',
    phone: '+91 98220 76401',
    shippingAddress: '42 Koregaon Park Road, Pune - 411001',
    productName: 'Microfiber Single Duvet Quilt',
    quantity: 1,
    orderValue: 249900,
    commissionAmount: 37485,
    netPayable: 212415,
    forwardingStatus: 'auto_assigned',
    awb: null,
    placedAt: '2 Sep 2026 14:10',
  },
  {
    id: 'sub-9390-C',
    parentOrderId: 'ord-9390',
    customerName: 'Meera Nair',
    phone: '+91 98460 22890',
    shippingAddress: '12 एमजी रोड, Thrissur - 680001',
    productName: 'Organic Cotton Bedsheet (King Size)',
    quantity: 1,
    orderValue: 179900,
    commissionAmount: 26985,
    netPayable: 152915,
    forwardingStatus: 'packed',
    awb: 'SRK-977410-HYD',
    placedAt: '1 Sep 2026 11:20',
  },
  {
    id: 'sub-9381-A',
    parentOrderId: 'ord-9381',
    customerName: 'Rakesh Menon',
    phone: '+91 98470 11228',
    shippingAddress: 'Marine Drive, Kochi - 682031',
    productName: 'Ergonomic Memory Foam Pillows (Set of 2)',
    quantity: 1,
    orderValue: 139900,
    commissionAmount: 20985,
    netPayable: 118915,
    forwardingStatus: 'shipped',
    awb: 'SRK-971104-KOC',
    placedAt: '31 Aug 2026 09:15',
  },
]

const ORDER_TABS = {
  all: () => true,
  new_orders: (o) => o.forwardingStatus === 'auto_assigned',
  accepted: (o) => o.forwardingStatus === 'vendor_accepted' || o.forwardingStatus === 'packed',
  shipped: (o) => o.forwardingStatus === 'shipped',
  delivered: (o) => o.forwardingStatus === 'delivered',
}

export function vendorOrderListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = VENDOR_ORDERS.filter(ORDER_TABS[tab] || ORDER_TABS.all)
  rows = search(rows, filters.search, ['id', 'parentOrderId', 'customerName', 'productName', 'awb'])
  return page(rows, VENDOR_ORDERS, ORDER_TABS, query)
}

// ---------------------------------------------------------------------------
// Vendor Settlements & Route Transfers
// ---------------------------------------------------------------------------
const VENDOR_SETTLEMENTS = [
  {
    id: 'stl-9041',
    routeTransferId: 'tr_8912408912',
    subOrderId: 'sub-9381-A',
    grossAmount: 139900,
    commission: 20985,
    netPayout: 118915,
    status: 'settled',
    transferredAt: '2 Sep 2026',
  },
  {
    id: 'stl-9033',
    routeTransferId: 'tr_8912407741',
    subOrderId: 'sub-9355-B',
    grossAmount: 359800,
    commission: 53970,
    netPayout: 305830,
    status: 'settled',
    transferredAt: '30 Aug 2026',
  },
  {
    id: 'stl-9020',
    routeTransferId: 'tr_8912406102',
    subOrderId: 'sub-9410-B',
    grossAmount: 359800,
    commission: 53970,
    netPayout: 305830,
    status: 'eligible',
    transferredAt: 'Pending Delivery',
  },
]

export function vendorSettlementsFixture() {
  return VENDOR_SETTLEMENTS
}

// ---------------------------------------------------------------------------
// Vendor KYC Documents
// ---------------------------------------------------------------------------
const VENDOR_KYC_DOCS = [
  { id: 'kyc-doc-1', type: 'PAN Card', fileName: 'Arya_Manufacturing_PAN.pdf', fileSize: '1.2 MB', uploadedAt: '18 Jun 2026', status: 'approved', required: true, rejectionReason: null },
  { id: 'kyc-doc-2', type: 'GST Certificate', fileName: 'GSTIN_07AACCA1234M1Z5.pdf', fileSize: '2.4 MB', uploadedAt: '18 Jun 2026', status: 'approved', required: true, rejectionReason: null },
  { id: 'kyc-doc-3', type: 'Cancelled Cheque / Bank Proof', fileName: 'HDFC_Cancelled_Cheque.jpg', fileSize: '850 KB', uploadedAt: '18 Jun 2026', status: 'approved', required: true, rejectionReason: null },
  { id: 'kyc-doc-4', type: 'FSSAI License (Food Safety)', fileName: null, fileSize: null, uploadedAt: null, status: 'not_applicable', required: false, rejectionReason: null },
  { id: 'kyc-doc-5', type: 'Aadhaar / Address Proof', fileName: 'Proprietor_Aadhaar.pdf', fileSize: '1.8 MB', uploadedAt: '18 Jun 2026', status: 'approved', required: true, rejectionReason: null },
]

export function vendorKycDocsFixture() {
  return VENDOR_KYC_DOCS
}

// ---------------------------------------------------------------------------
// Vendor Store Settings
// ---------------------------------------------------------------------------
export const VENDOR_SETTINGS_DATA = Object.freeze({
  storeName: 'Arya Manufacturing',
  entityType: 'Manufacturer',
  contactPerson: 'Ramesh Sharma',
  email: 'ramesh@aryamanufacturing.in',
  phone: '+91 98110 22440',
  city: 'Delhi',
  pickupPincode: '110020',
  pickupAddress: 'Plot 42, Okhla Industrial Estate Phase III, New Delhi - 110020',
  bankName: 'HDFC Bank',
  accountNumberMasked: '•••• •••• 4892',
  ifsc: 'HDFC0000240',
  razorpayAccountId: 'acc_Lp982401K',
  smsAlerts: true,
  emailAlerts: true,
})
