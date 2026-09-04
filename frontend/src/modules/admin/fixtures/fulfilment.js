import { BUSINESS_MODEL, ORDER_STATUS, ORDER_STATUS_EXCEPTION } from '../../../config/constants'
import { findOr404, insert, invalid, nextId } from './mutable'

// Shapes match schemas/fulfilmentSchema.js. Money is in PAISE.

// Generic pager, so each list below filters and the shape stays identical to
// what a real paginated endpoint returns.
function page(rows, all, matchers, { tab = 'all', filters = {}, page = 1, rowsPerPage = 25 } = {}) {
  const totalItems = rows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))
  const start = (page - 1) * rowsPerPage
  return {
    items: rows.slice(start, start + rowsPerPage),
    page,
    rowsPerPage,
    totalItems,
    totalPages,
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
// Sub-orders — the operational queue. One row per vendor bucket.
// ---------------------------------------------------------------------------
const SUB_ORDERS = [
  { id: 'KZ-40128-A', orderId: 'KZ-40128', placedAt: '2026-09-02T11:42:00+05:30', model: BUSINESS_MODEL.MARKETPLACE, seller: 'Nova Retail Pvt Ltd', buyer: 'Ananya Iyer', status: ORDER_STATUS.SHIPPED, awb: 'SRTP4471902881', ageHours: 3, total: 294700 },
  { id: 'KZ-40128-B', orderId: 'KZ-40128', placedAt: '2026-09-02T11:42:00+05:30', model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', buyer: 'Ananya Iyer', status: ORDER_STATUS.PACKED, awb: null, ageHours: 3, total: 94900 },
  { id: 'KZ-40127-A', orderId: 'KZ-40127', placedAt: '2026-09-02T10:18:00+05:30', model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Arya Manufacturing', buyer: 'Rakesh Menon', status: ORDER_STATUS.IN_TRANSIT, awb: 'SRTP4471902744', ageHours: 4, total: 942000 },
  { id: 'KZ-40126-A', orderId: 'KZ-40126', placedAt: '2026-09-02T09:05:00+05:30', model: BUSINESS_MODEL.MARKETPLACE, seller: 'Sunrise Traders', buyer: 'Bharat Textiles LLP', status: ORDER_STATUS_EXCEPTION.RTO_INITIATED, awb: 'SRTP4471901980', ageHours: 6, total: 4860000 },
  { id: 'KZ-40125-C', orderId: 'KZ-40125', placedAt: '2026-09-01T21:37:00+05:30', model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Meghna Wholesale', buyer: 'Sneha Kulkarni', status: ORDER_STATUS.DELIVERED, awb: 'SRTP4471898210', ageHours: 18, total: 1294000 },
  { id: 'KZ-40123-A', orderId: 'KZ-40123', placedAt: '2026-09-01T16:54:00+05:30', model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Arya Manufacturing', buyer: 'Meera Nair', status: ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR, awb: null, ageHours: 22, total: 189500 },
  { id: 'KZ-40123-B', orderId: 'KZ-40123', placedAt: '2026-09-01T16:54:00+05:30', model: BUSINESS_MODEL.MARKETPLACE, seller: 'Nova Retail Pvt Ltd', buyer: 'Meera Nair', status: ORDER_STATUS.VENDOR_ACCEPTED, awb: null, ageHours: 22, total: 138000 },
  { id: 'KZ-40122-A', orderId: 'KZ-40122', placedAt: '2026-09-01T14:03:00+05:30', model: BUSINESS_MODEL.DROPSHIPPING, seller: 'Kritika Enterprises', buyer: 'Kritika Enterprises', status: ORDER_STATUS.PACKED, awb: null, ageHours: 25, total: 12450000 },
  { id: 'KZ-40120-A', orderId: 'KZ-40120', placedAt: '2026-09-01T09:47:00+05:30', model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', buyer: 'Fatima Sheikh', status: ORDER_STATUS.SHIPPED, awb: 'SRTP4471896104', ageHours: 29, total: 412000 },
  { id: 'KZ-40119-B', orderId: 'KZ-40119', placedAt: '2026-08-31T22:14:00+05:30', model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', buyer: 'Meghna Wholesale', status: ORDER_STATUS_EXCEPTION.RETURN_REQUESTED, awb: 'SRTP4471890033', ageHours: 41, total: 2180000 },
  { id: 'KZ-40117-A', orderId: 'KZ-40117', placedAt: '2026-08-31T15:02:00+05:30', model: BUSINESS_MODEL.OWN_STOCK, seller: 'Krozenda Own Stock', buyer: 'Divya Raghavan', status: ORDER_STATUS_EXCEPTION.REPLACEMENT_ISSUED, awb: 'SRTP4471888412', ageHours: 48, total: 412000 },
  { id: 'KZ-40118-A', orderId: 'KZ-40118', placedAt: '2026-08-31T18:36:00+05:30', model: BUSINESS_MODEL.MARKETPLACE, seller: 'Bharat Textiles LLP', buyer: 'Arjun Pillai', status: ORDER_STATUS_EXCEPTION.CANCELLED_BUYER, awb: null, ageHours: 44, total: 245000 },
]

const AWAITING = [ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR, ORDER_STATUS.VENDOR_ACCEPTED]
const IN_FLIGHT = [ORDER_STATUS.PACKED, ORDER_STATUS.AWB_GENERATED, ORDER_STATUS.SHIPPED, ORDER_STATUS.IN_TRANSIT]
const EXCEPTIONS = Object.values(ORDER_STATUS_EXCEPTION)

const SUB_ORDER_TABS = {
  all: () => true,
  awaiting: (s) => AWAITING.includes(s.status),
  in_flight: (s) => IN_FLIGHT.includes(s.status),
  exceptions: (s) => EXCEPTIONS.includes(s.status),
  delivered: (s) => s.status === ORDER_STATUS.DELIVERED,
}

export function subOrderListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = SUB_ORDERS.filter(SUB_ORDER_TABS[tab] || SUB_ORDER_TABS.all)
  rows = search(rows, filters.search, ['id', 'orderId', 'seller', 'buyer', 'awb'])
  if (filters.model) rows = rows.filter((s) => s.model === filters.model)
  if (filters.status) rows = rows.filter((s) => s.status === filters.status)
  return page(rows, SUB_ORDERS, SUB_ORDER_TABS, query)
}

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------
const SHIPMENTS = [
  { id: 'shp-1', subOrderId: 'KZ-40128-A', awb: 'SRTP4471902881', courier: 'Delhivery Surface', seller: 'Nova Retail Pvt Ltd', pickupPincode: '400072', dropPincode: '560034', status: 'in_transit', lastEvent: 'Departed Mumbai hub', lastEventAt: '2 Sep, 18:20', promisedBy: '6 Sep', isLate: false },
  { id: 'shp-2', subOrderId: 'KZ-40127-A', awb: 'SRTP4471902744', courier: 'Bluedart Express', seller: 'Arya Manufacturing', pickupPincode: '110044', dropPincode: '682016', status: 'in_transit', lastEvent: 'Arrived Kochi hub', lastEventAt: '2 Sep, 06:10', promisedBy: '3 Sep', isLate: false },
  { id: 'shp-3', subOrderId: 'KZ-40126-A', awb: 'SRTP4471901980', courier: 'Ecom Express', seller: 'Sunrise Traders', pickupPincode: '302017', dropPincode: '395006', status: 'rto_in_transit', lastEvent: 'RTO initiated — consignee unreachable', lastEventAt: '1 Sep, 15:40', promisedBy: '31 Aug', isLate: true },
  { id: 'shp-4', subOrderId: 'KZ-40125-C', awb: 'SRTP4471898210', courier: 'Delhivery Surface', seller: 'Meghna Wholesale', pickupPincode: '452010', dropPincode: '411045', status: 'delivered', lastEvent: 'Delivered to consignee', lastEventAt: '1 Sep, 14:22', promisedBy: '2 Sep', isLate: false },
  { id: 'shp-5', subOrderId: 'KZ-40120-A', awb: 'SRTP4471896104', courier: 'XpressBees', seller: 'Krozenda Own Stock', pickupPincode: '421302', dropPincode: '226010', status: 'in_transit', lastEvent: 'In transit to Lucknow', lastEventAt: '2 Sep, 04:55', promisedBy: '4 Sep', isLate: false },
  { id: 'shp-6', subOrderId: 'KZ-40119-B', awb: 'SRTP4471890033', courier: 'Bluedart Express', seller: 'Krozenda Own Stock', pickupPincode: '421302', dropPincode: '452010', status: 'delivered', lastEvent: 'Delivered to consignee', lastEventAt: '31 Aug, 11:08', promisedBy: '1 Sep', isLate: false },
  { id: 'shp-7', subOrderId: 'KZ-40117-A', awb: 'SRTP4471888412', courier: 'Ecom Express', seller: 'Krozenda Own Stock', pickupPincode: '421302', dropPincode: '641012', status: 'exception', lastEvent: 'Address incomplete — held at hub', lastEventAt: '2 Sep, 09:30', promisedBy: '1 Sep', isLate: true },
]

const SHIPMENT_TABS = {
  all: () => true,
  in_transit: (s) => s.status === 'in_transit',
  delivered: (s) => s.status === 'delivered',
  late: (s) => s.isLate,
  exception: (s) => ['exception', 'rto_in_transit'].includes(s.status),
}

export function shipmentListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = SHIPMENTS.filter(SHIPMENT_TABS[tab] || SHIPMENT_TABS.all)
  rows = search(rows, filters.search, ['awb', 'subOrderId', 'seller', 'courier'])
  if (filters.courier) rows = rows.filter((s) => s.courier === filters.courier)
  return page(rows, SHIPMENTS, SHIPMENT_TABS, query)
}

// ---------------------------------------------------------------------------
// RTO — "no return" policy does not cover return to origin (context §6.3)
// ---------------------------------------------------------------------------
const RTOS = [
  { id: 'rto-1', subOrderId: 'KZ-40126-A', awb: 'SRTP4471901980', seller: 'Sunrise Traders', reason: 'customer_unreachable', initiatedAt: '1 Sep 2026', costBearer: 'vendor', shippingCost: 42000, orderValue: 4860000, settlementReversed: true, stockRestored: false },
  { id: 'rto-2', subOrderId: 'KZ-40112-A', awb: 'SRTP4471881204', seller: 'Nova Retail Pvt Ltd', reason: 'address_failure', initiatedAt: '29 Aug 2026', costBearer: 'platform', shippingCost: 18000, orderValue: 214000, settlementReversed: true, stockRestored: true },
  { id: 'rto-3', subOrderId: 'KZ-40098-B', awb: 'SRTP4471862911', seller: 'Krozenda Own Stock', reason: 'refused', initiatedAt: '26 Aug 2026', costBearer: 'platform', shippingCost: 15000, orderValue: 128000, settlementReversed: false, stockRestored: true },
  { id: 'rto-4', subOrderId: 'KZ-40074-A', awb: 'SRTP4471840118', seller: 'Meghna Wholesale', reason: 'undelivered', initiatedAt: '22 Aug 2026', costBearer: 'vendor', shippingCost: 26000, orderValue: 682000, settlementReversed: true, stockRestored: false },
]

const RTO_TABS = {
  all: () => true,
  open: (r) => !r.settlementReversed || !r.stockRestored,
  vendor_bears: (r) => r.costBearer === 'vendor',
  platform_bears: (r) => r.costBearer === 'platform',
}

export function rtoListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = RTOS.filter(RTO_TABS[tab] || RTO_TABS.all)
  rows = search(rows, filters.search, ['awb', 'subOrderId', 'seller'])
  return page(rows, RTOS, RTO_TABS, query)
}

// ---------------------------------------------------------------------------
// Returns — default policy is NO RETURN; only three reasons are allowed
// ---------------------------------------------------------------------------
const RETURNS = [
  { id: 'ret-1', subOrderId: 'KZ-40119-B', buyer: 'Meghna Wholesale', seller: 'Krozenda Own Stock', reason: 'damaged', raisedAt: '1 Sep 2026', evidenceCount: 3, status: 'awaiting_review', value: 218000 },
  { id: 'ret-2', subOrderId: 'KZ-40111-A', buyer: 'Sneha Kulkarni', seller: 'Nova Retail Pvt Ltd', reason: 'wrong_product', raisedAt: '31 Aug 2026', evidenceCount: 2, status: 'awaiting_review', value: 89900 },
  { id: 'ret-3', subOrderId: 'KZ-40104-A', buyer: 'Imran Qureshi', seller: 'Arya Manufacturing', reason: 'missing_product', raisedAt: '30 Aug 2026', evidenceCount: 2, status: 'awaiting_review', value: 149900 },
  { id: 'ret-4', subOrderId: 'KZ-40117-A', buyer: 'Divya Raghavan', seller: 'Krozenda Own Stock', reason: 'damaged', raisedAt: '28 Aug 2026', evidenceCount: 4, status: 'replacement_issued', value: 412000 },
  { id: 'ret-5', subOrderId: 'KZ-40092-C', buyer: 'Arjun Pillai', seller: 'Bharat Textiles LLP', reason: 'wrong_product', raisedAt: '25 Aug 2026', evidenceCount: 2, status: 'refunded', value: 128000 },
  { id: 'ret-6', subOrderId: 'KZ-40088-A', buyer: 'Vikram Deshpande', seller: 'Sunrise Traders', reason: 'damaged', raisedAt: '23 Aug 2026', evidenceCount: 1, status: 'rejected', value: 64900 },
]

const RETURN_TABS = {
  all: () => true,
  awaiting_review: (r) => r.status === 'awaiting_review',
  resolved: (r) => ['replacement_issued', 'refunded'].includes(r.status),
  rejected: (r) => r.status === 'rejected',
}

export function returnListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = RETURNS.filter(RETURN_TABS[tab] || RETURN_TABS.all)
  rows = search(rows, filters.search, ['id', 'subOrderId', 'buyer', 'seller'])
  if (filters.reason) rows = rows.filter((r) => r.reason === filters.reason)
  return page(rows, RETURNS, RETURN_TABS, query)
}

export function returnDetailFixture(returnId) {
  const summary = RETURNS.find((r) => r.id === returnId) || RETURNS[0]
  return {
    ...summary,
    buyerNote:
      'Two of the six tumblers arrived dented along the rim. Outer carton was intact, inner packing had shifted. Photographs attached.',
    evidence: [
      { id: 'ev-1', caption: 'Dented rim, unit 1', uploadedAt: '1 Sep 2026, 10:12' },
      { id: 'ev-2', caption: 'Dented rim, unit 2', uploadedAt: '1 Sep 2026, 10:12' },
      { id: 'ev-3', caption: 'Inner packing as received', uploadedAt: '1 Sep 2026, 10:13' },
    ].slice(0, summary.evidenceCount),
    item: {
      name: 'Sunrise Wholesale Steel Tumbler, 24-pack',
      sku: 'KZ-HK-TMB-024',
      quantity: 2,
      unitPrice: 109000,
    },
    policy: {
      windowDays: 7,
      raisedWithinWindow: true,
      allowedReason: true,
      returnShippingBearer: 'vendor',
    },
    timeline: [
      { label: 'Delivered', at: '31 Aug 2026, 11:08', actor: 'Bluedart Express', reason: null, done: true },
      { label: 'Return raised', at: '1 Sep 2026, 10:14', actor: 'Meghna Wholesale', reason: 'Damaged product', done: true },
      { label: 'Evidence uploaded', at: '1 Sep 2026, 10:13', actor: 'Meghna Wholesale', reason: `${summary.evidenceCount} photographs`, done: true },
      { label: 'Admin review', at: null, actor: null, reason: 'Awaiting a decision', done: false, tone: 'warning' },
      { label: 'Resolution', at: null, actor: null, reason: 'Replacement or refund', done: false },
    ],
  }
}

// ---------------------------------------------------------------------------
// Cancellations
// ---------------------------------------------------------------------------
const CANCELLATIONS = [
  { id: 'cnl-1', subOrderId: 'KZ-40118-A', orderId: 'KZ-40118', cancelledBy: 'buyer', actor: 'Arjun Pillai', reason: 'Ordered by mistake', cancelledAt: '31 Aug 2026, 19:02', refundStatus: 'not_required', refundAmount: 0 },
  { id: 'cnl-2', subOrderId: 'KZ-40124-A', orderId: 'KZ-40124', cancelledBy: 'buyer', actor: 'Imran Qureshi', reason: 'Found a better price', cancelledAt: '1 Sep 2026, 19:40', refundStatus: 'pending', refundAmount: 186000 },
  { id: 'cnl-3', subOrderId: 'KZ-40109-B', orderId: 'KZ-40109', cancelledBy: 'vendor', actor: 'Sunrise Traders', reason: 'Out of stock at pickup', cancelledAt: '30 Aug 2026, 08:15', refundStatus: 'completed', refundAmount: 249900 },
  { id: 'cnl-4', subOrderId: 'KZ-40101-A', orderId: 'KZ-40101', cancelledBy: 'admin', actor: 'Priya Sharma', reason: 'Suspected fraudulent order — flagged by risk rules', cancelledAt: '28 Aug 2026, 14:50', refundStatus: 'completed', refundAmount: 1240000 },
  { id: 'cnl-5', subOrderId: 'KZ-40095-A', orderId: 'KZ-40095', cancelledBy: 'buyer', actor: 'Fatima Sheikh', reason: 'Delivery taking too long', cancelledAt: '26 Aug 2026, 11:20', refundStatus: 'failed', refundAmount: 84900 },
]

const CANCELLATION_TABS = {
  all: () => true,
  buyer: (c) => c.cancelledBy === 'buyer',
  admin: (c) => c.cancelledBy === 'admin',
  vendor: (c) => c.cancelledBy === 'vendor',
  refund_open: (c) => ['pending', 'processing', 'failed'].includes(c.refundStatus),
}

export function cancellationListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = CANCELLATIONS.filter(CANCELLATION_TABS[tab] || CANCELLATION_TABS.all)
  rows = search(rows, filters.search, ['subOrderId', 'orderId', 'actor'])
  return page(rows, CANCELLATIONS, CANCELLATION_TABS, query)
}

// ---------------------------------------------------------------------------
// Invoices — one per sub-order, by seller of record
// ---------------------------------------------------------------------------
const INVOICES = [
  { id: 'inv-1', number: 'KZ/2627/000841', subOrderId: 'KZ-40128-A', sellerOfRecord: 'Nova Retail Pvt Ltd', buyer: 'Ananya Iyer', issuedAt: '2 Sep 2026', taxableValue: 249745, gst: 44955, total: 294700, placeOfSupply: 'Karnataka (29)', isInterState: true },
  { id: 'inv-2', number: 'KZ/2627/000842', subOrderId: 'KZ-40128-B', sellerOfRecord: 'Krozenda Entity', buyer: 'Ananya Iyer', issuedAt: '2 Sep 2026', taxableValue: 84505, gst: 10395, total: 94900, placeOfSupply: 'Karnataka (29)', isInterState: true },
  { id: 'inv-3', number: 'KZ/2627/000840', subOrderId: 'KZ-40127-A', sellerOfRecord: 'Krozenda Entity', buyer: 'Rakesh Menon', issuedAt: '2 Sep 2026', taxableValue: 798305, gst: 143695, total: 942000, placeOfSupply: 'Kerala (32)', isInterState: true },
  { id: 'inv-4', number: 'KZ/2627/000838', subOrderId: 'KZ-40126-A', sellerOfRecord: 'Sunrise Traders', buyer: 'Bharat Textiles LLP', issuedAt: '2 Sep 2026', taxableValue: 4118644, gst: 741356, total: 4860000, placeOfSupply: 'Gujarat (24)', isInterState: true },
  { id: 'inv-5', number: 'KZ/2627/000835', subOrderId: 'KZ-40122-A', sellerOfRecord: 'Krozenda Entity', buyer: 'Kritika Enterprises', issuedAt: '1 Sep 2026', taxableValue: 11116071, gst: 1333929, total: 12450000, placeOfSupply: 'Rajasthan (08)', isInterState: true },
  { id: 'inv-6', number: 'KZ/2627/000831', subOrderId: 'KZ-40120-A', sellerOfRecord: 'Krozenda Entity', buyer: 'Fatima Sheikh', issuedAt: '1 Sep 2026', taxableValue: 367857, gst: 44143, total: 412000, placeOfSupply: 'Uttar Pradesh (09)', isInterState: true },
]

const INVOICE_TABS = {
  all: () => true,
  krozenda: (i) => i.sellerOfRecord === 'Krozenda Entity',
  vendor: (i) => i.sellerOfRecord !== 'Krozenda Entity',
  inter_state: (i) => i.isInterState,
}

export function invoiceListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = INVOICES.filter(INVOICE_TABS[tab] || INVOICE_TABS.all)
  rows = search(rows, filters.search, ['number', 'subOrderId', 'buyer', 'sellerOfRecord'])
  return page(rows, INVOICES, INVOICE_TABS, query)
}

export function invoiceDetailFixture(invoiceId) {
  const summary = INVOICES.find((i) => i.id === invoiceId) || INVOICES[0]
  // Inter-state supply → IGST only. Intra-state would split into CGST + SGST.
  return {
    ...summary,
    seller: {
      name: summary.sellerOfRecord,
      gstin: summary.sellerOfRecord === 'Krozenda Entity' ? '27AAECK4821M1Z9' : '27AAFCN9612R1ZQ',
      address: 'Unit 4, Marol Industrial Estate, Andheri East, Mumbai 400059',
    },
    buyerDetail: {
      name: summary.buyer,
      gstin: null,
      address: 'Flat 402, Brigade Palmgrove, Koramangala 6th Block, Bengaluru 560034',
    },
    lines: [
      {
        name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L',
        hsn: '732393',
        quantity: 2,
        unitPrice: 101610,
        taxableValue: 203220,
        gstRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 36580,
        total: 239800,
      },
      {
        name: 'Nirvaan Silicone Spatula Set of 3',
        hsn: '392410',
        quantity: 1,
        unitPrice: 42288,
        taxableValue: 42288,
        gstRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 7612,
        total: 49900,
      },
      {
        name: 'Shipping and handling',
        hsn: '996819',
        quantity: 1,
        unitPrice: 4237,
        taxableValue: 4237,
        gstRate: 18,
        cgst: 0,
        sgst: 0,
        igst: 763,
        total: 5000,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Writes
//
// The status chain is the business rule here: a sub-order moves forward one
// step at a time and never backwards, and an RTO is not a return. Enforcing
// the sequence in the fixture means the API inherits the same guarantee.
// ---------------------------------------------------------------------------

// The happy path, in order. Anything not on it (RTO, cancellation) is an
// exception status reached by its own action, not by "next".
const FORWARD = [
  ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR,
  ORDER_STATUS.VENDOR_ACCEPTED,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.AWB_GENERATED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.DELIVERED,
]

const CANCELLABLE = [
  ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR,
  ORDER_STATUS.VENDOR_ACCEPTED,
  ORDER_STATUS.PACKED,
]

export function nextSubOrderStatus(status) {
  const index = FORWARD.indexOf(status)
  return index === -1 || index === FORWARD.length - 1 ? null : FORWARD[index + 1]
}

export function advanceSubOrderFixture(id, { awb } = {}) {
  const subOrder = findOr404(SUB_ORDERS, id)
  const next = nextSubOrderStatus(subOrder.status)

  if (!next) throw invalid(`${subOrder.status} is not a step that can be advanced.`)

  // An AWB is what makes a parcel trackable — it cannot ship without one.
  if (next === ORDER_STATUS.AWB_GENERATED) {
    const number = String(awb || '').trim() || `SRTP${Math.floor(Math.random() * 9e9) + 1e9}`
    subOrder.awb = number
    const shipment = SHIPMENTS.find((entry) => entry.subOrderId === id)
    if (shipment) shipment.awb = number
  }

  subOrder.status = next
  if (next === ORDER_STATUS.DELIVERED) {
    const shipment = SHIPMENTS.find((entry) => entry.subOrderId === id)
    if (shipment) {
      shipment.status = 'delivered'
      shipment.lastEvent = 'Delivered to consignee'
    }
  }
  return subOrder
}

export function cancelSubOrderFixture(id, { reason } = {}) {
  const subOrder = findOr404(SUB_ORDERS, id)
  if (!CANCELLABLE.includes(subOrder.status)) {
    throw invalid('Once a parcel has an AWB it has to be cancelled through the courier, not here.')
  }
  if (!reason || reason.trim().length < 5) throw invalid('Say why the sub-order was cancelled.')

  subOrder.status = ORDER_STATUS_EXCEPTION.CANCELLED_ADMIN

  insert(CANCELLATIONS, {
    id: nextId('cnl'),
    subOrderId: subOrder.id,
    orderId: subOrder.orderId,
    cancelledBy: 'admin',
    actor: 'Priya Sharma',
    reason: reason.trim(),
    cancelledAt: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    refundStatus: subOrder.total > 0 ? 'pending' : 'not_required',
    refundAmount: subOrder.total,
  })

  return subOrder
}

export function updateShipmentFixture(id, { status, lastEvent } = {}) {
  const shipment = findOr404(SHIPMENTS, id)
  const allowed = ['in_transit', 'out_for_delivery', 'delivered', 'rto_in_transit', 'rto_delivered']

  if (status && !allowed.includes(status)) throw invalid(`${status} is not a shipment state.`)

  if (status) shipment.status = status
  if (lastEvent) shipment.lastEvent = lastEvent
  shipment.lastEventAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short' })
  if (status === 'delivered') shipment.isLate = false

  return shipment
}

/**
 * Take an RTO parcel back into stock.
 *
 * An RTO is not a return (PRD 6.3): the buyer never accepted the goods, so
 * there is no refund leg here — only the stock coming back and, where the
 * vendor bears the cost, the settlement reversal.
 */
export function restockRtoFixture(id) {
  const rto = findOr404(RTOS, id)
  if (rto.stockRestored) throw invalid('That parcel is already back in stock.')

  rto.stockRestored = true
  if (rto.costBearer === 'vendor') rto.settlementReversed = true

  const subOrder = SUB_ORDERS.find((entry) => entry.id === rto.subOrderId)
  if (subOrder) subOrder.status = ORDER_STATUS_EXCEPTION.RTO_DELIVERED

  return rto
}

export function decideReturnFixture(id, { decision, reason } = {}) {
  const entry = findOr404(RETURNS, id)
  if (entry.status !== 'awaiting_review') throw invalid('That return has already been decided.')

  if (decision === 'refund') entry.status = 'refunded'
  else if (decision === 'replace') entry.status = 'replacement_issued'
  else if (decision === 'reject') {
    if (!reason || reason.trim().length < 5) throw invalid('Give the buyer a reason.')
    entry.status = 'rejected'
    entry.rejectionReason = reason.trim()
  } else {
    throw invalid('Pick refund, replacement or rejection.')
  }

  return entry
}

export function resolveCancellationRefundFixture(id) {
  const cancellation = findOr404(CANCELLATIONS, id)
  if (cancellation.refundStatus === 'completed') throw invalid('That refund is already paid.')
  if (cancellation.refundStatus === 'not_required') throw invalid('Nothing was captured to refund.')

  cancellation.refundStatus = 'completed'
  return cancellation
}

export function voidInvoiceFixture(id, { reason } = {}) {
  const invoice = findOr404(INVOICES, id)
  if (invoice.voided) throw invalid('That invoice is already void.')
  if (!reason || reason.trim().length < 5) throw invalid('A void needs a reason for the audit trail.')

  // A tax invoice is never edited or deleted — it is voided and reissued, so
  // the number series stays unbroken for GSTR-1.
  invoice.voided = true
  invoice.voidReason = reason.trim()
  return invoice
}
