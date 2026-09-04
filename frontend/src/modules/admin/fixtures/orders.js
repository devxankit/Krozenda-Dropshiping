import { BUSINESS_MODEL } from '../../../config/constants'
import { FULFILMENT_STATUS, PAYMENT_STATUS } from '../constants'

// Shapes match schemas/orderSchema.js exactly. Money is in PAISE.
//
// The rows deliberately cover the awkward cases rather than a happy path:
// a cart split across three vendors, a B2B order at 150 units, a partial
// cancellation with a refund still pending, and an RTO in flight.

const ORDERS = [
  {
    id: 'KZ-40128',
    placedAt: '2026-09-02T11:42:00+05:30',
    buyer: { id: 'cus-8801', name: 'Ananya Iyer', city: 'Bengaluru', pincode: '560034', type: 'retail' },
    models: [BUSINESS_MODEL.MARKETPLACE, BUSINESS_MODEL.OWN_STOCK],
    sellerCount: 2,
    itemCount: 4,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.PARTLY_SHIPPED,
    total: 389600,
  },
  {
    id: 'KZ-40127',
    placedAt: '2026-09-02T10:18:00+05:30',
    buyer: { id: 'cus-8790', name: 'Rakesh Menon', city: 'Kochi', pincode: '682016', type: 'retail' },
    models: [BUSINESS_MODEL.DROPSHIPPING],
    sellerCount: 1,
    itemCount: 1,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.IN_TRANSIT,
    total: 942000,
  },
  {
    id: 'KZ-40126',
    placedAt: '2026-09-02T09:05:00+05:30',
    buyer: {
      id: 'cus-4410',
      name: 'Bharat Textiles LLP',
      city: 'Surat',
      pincode: '395006',
      type: 'b2b_dealer',
    },
    models: [BUSINESS_MODEL.MARKETPLACE],
    sellerCount: 1,
    itemCount: 60,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.RTO,
    total: 4860000,
  },
  {
    id: 'KZ-40125',
    placedAt: '2026-09-01T21:37:00+05:30',
    buyer: { id: 'cus-8712', name: 'Sneha Kulkarni', city: 'Pune', pincode: '411045', type: 'retail' },
    models: [BUSINESS_MODEL.MARKETPLACE, BUSINESS_MODEL.DROPSHIPPING, BUSINESS_MODEL.OWN_STOCK],
    sellerCount: 3,
    itemCount: 7,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.DELIVERED,
    total: 1294000,
  },
  {
    id: 'KZ-40124',
    placedAt: '2026-09-01T19:12:00+05:30',
    buyer: { id: 'cus-8654', name: 'Imran Qureshi', city: 'Hyderabad', pincode: '500081', type: 'retail' },
    models: [BUSINESS_MODEL.OWN_STOCK],
    sellerCount: 1,
    itemCount: 2,
    paymentStatus: PAYMENT_STATUS.REFUND_PENDING,
    fulfilmentStatus: FULFILMENT_STATUS.CANCELLED,
    total: 186000,
  },
  {
    id: 'KZ-40123',
    placedAt: '2026-09-01T16:54:00+05:30',
    buyer: { id: 'cus-8601', name: 'Meera Nair', city: 'Thrissur', pincode: '680001', type: 'retail' },
    models: [BUSINESS_MODEL.DROPSHIPPING, BUSINESS_MODEL.MARKETPLACE],
    sellerCount: 2,
    itemCount: 3,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.AWAITING_VENDOR,
    total: 327500,
  },
  {
    id: 'KZ-40122',
    placedAt: '2026-09-01T14:03:00+05:30',
    buyer: {
      id: 'cus-4102',
      name: 'Kritika Enterprises',
      city: 'Jaipur',
      pincode: '302017',
      type: 'b2b_distributor',
    },
    models: [BUSINESS_MODEL.DROPSHIPPING],
    sellerCount: 1,
    itemCount: 150,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.PACKED,
    total: 12450000,
  },
  {
    id: 'KZ-40121',
    placedAt: '2026-09-01T12:29:00+05:30',
    buyer: {
      id: 'cus-8588',
      name: 'Vikram Deshpande',
      city: 'Nagpur',
      pincode: '440010',
      type: 'retail',
    },
    models: [BUSINESS_MODEL.MARKETPLACE],
    sellerCount: 1,
    itemCount: 1,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.DELIVERED,
    total: 89900,
  },
  {
    id: 'KZ-40120',
    placedAt: '2026-09-01T09:47:00+05:30',
    buyer: { id: 'cus-8540', name: 'Fatima Sheikh', city: 'Lucknow', pincode: '226010', type: 'retail' },
    models: [BUSINESS_MODEL.OWN_STOCK, BUSINESS_MODEL.MARKETPLACE],
    sellerCount: 2,
    itemCount: 5,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.SHIPPED,
    total: 731000,
  },
  {
    id: 'KZ-40119',
    placedAt: '2026-08-31T22:14:00+05:30',
    buyer: {
      id: 'cus-4288',
      name: 'Meghna Wholesale',
      city: 'Indore',
      pincode: '452010',
      type: 'b2b_wholesaler',
    },
    models: [BUSINESS_MODEL.DROPSHIPPING, BUSINESS_MODEL.OWN_STOCK],
    sellerCount: 2,
    itemCount: 88,
    paymentStatus: PAYMENT_STATUS.PARTIALLY_REFUNDED,
    fulfilmentStatus: FULFILMENT_STATUS.PARTLY_DELIVERED,
    total: 6820000,
  },
  {
    id: 'KZ-40118',
    placedAt: '2026-08-31T18:36:00+05:30',
    buyer: { id: 'cus-8501', name: 'Arjun Pillai', city: 'Chennai', pincode: '600042', type: 'retail' },
    models: [BUSINESS_MODEL.MARKETPLACE],
    sellerCount: 1,
    itemCount: 2,
    paymentStatus: PAYMENT_STATUS.FAILED,
    fulfilmentStatus: FULFILMENT_STATUS.CANCELLED,
    total: 245000,
  },
  {
    id: 'KZ-40117',
    placedAt: '2026-08-31T15:02:00+05:30',
    buyer: { id: 'cus-8477', name: 'Divya Raghavan', city: 'Coimbatore', pincode: '641012', type: 'retail' },
    models: [BUSINESS_MODEL.OWN_STOCK],
    sellerCount: 1,
    itemCount: 3,
    paymentStatus: PAYMENT_STATUS.CAPTURED,
    fulfilmentStatus: FULFILMENT_STATUS.RETURNED,
    total: 412000,
  },
]

const TAB_MATCHERS = {
  all: () => true,
  needs_action: (order) =>
    [FULFILMENT_STATUS.AWAITING_VENDOR, FULFILMENT_STATUS.RTO].includes(order.fulfilmentStatus) ||
    [PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.FAILED].includes(order.paymentStatus),
  unfulfilled: (order) =>
    [
      FULFILMENT_STATUS.AWAITING_VENDOR,
      FULFILMENT_STATUS.PARTLY_PACKED,
      FULFILMENT_STATUS.PACKED,
      FULFILMENT_STATUS.PARTLY_SHIPPED,
      FULFILMENT_STATUS.SHIPPED,
      FULFILMENT_STATUS.IN_TRANSIT,
    ].includes(order.fulfilmentStatus),
  exceptions: (order) =>
    [FULFILMENT_STATUS.RTO, FULFILMENT_STATUS.RETURNED].includes(order.fulfilmentStatus),
  cancelled: (order) => order.fulfilmentStatus === FULFILMENT_STATUS.CANCELLED,
}

export function orderTabCounts() {
  return Object.fromEntries(
    Object.entries(TAB_MATCHERS).map(([tab, matches]) => [tab, ORDERS.filter(matches).length]),
  )
}

// Filtering, sorting and paging happen here so the controller and the screen
// are written exactly as they will be against a real paginated endpoint.
export function orderListFixture({ tab = 'all', filters = {}, sort, page = 1, rowsPerPage = 25 }) {
  const term = (filters.search || '').trim().toLowerCase()

  let rows = ORDERS.filter(TAB_MATCHERS[tab] || TAB_MATCHERS.all)

  if (term) {
    rows = rows.filter(
      (order) =>
        order.id.toLowerCase().includes(term) ||
        order.buyer.name.toLowerCase().includes(term) ||
        order.buyer.pincode.includes(term),
    )
  }
  if (filters.model) rows = rows.filter((order) => order.models.includes(filters.model))
  if (filters.fulfilmentStatus) {
    rows = rows.filter((order) => order.fulfilmentStatus === filters.fulfilmentStatus)
  }
  if (filters.paymentStatus) {
    rows = rows.filter((order) => order.paymentStatus === filters.paymentStatus)
  }
  if (filters.buyerType) rows = rows.filter((order) => order.buyer.type === filters.buyerType)

  if (sort?.key) {
    const direction = sort.direction === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const left = sort.key === 'buyer' ? a.buyer.name : a[sort.key]
      const right = sort.key === 'buyer' ? b.buyer.name : b[sort.key]
      if (left === right) return 0
      return left > right ? direction : -direction
    })
  }

  const totalItems = rows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))
  const start = (page - 1) * rowsPerPage

  return {
    items: rows.slice(start, start + rowsPerPage),
    page,
    rowsPerPage,
    totalItems,
    totalPages,
    tabCounts: orderTabCounts(),
  }
}

export function orderDetailFixture(orderId) {
  const summary = ORDERS.find((order) => order.id === orderId) || ORDERS[0]
  return buildDetail(summary)
}

// ---------------------------------------------------------------------------
// One parent order fans out into N sub-orders — the platform's defining shape.
// KZ-40128 is the reference case: two vendors, two business models, two
// independent lifecycles under a single payment.
// ---------------------------------------------------------------------------
function buildDetail(summary) {
  const subOrders = [
    {
      id: `${summary.id}-A`,
      model: BUSINESS_MODEL.MARKETPLACE,
      seller: { id: 'slr-2184', name: 'Nova Retail Pvt Ltd' },
      status: 'shipped',
      items: [
        {
          id: 'itm-1',
          name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L',
          sku: 'KZ-HK-STL-1200',
          hsn: '732393',
          gstRate: 18,
          quantity: 2,
          unitPrice: 119900,
          lineTotal: 239800,
        },
        {
          id: 'itm-2',
          name: 'Nirvaan Silicone Spatula Set of 3',
          sku: 'KZ-HK-SPT-003',
          hsn: '392410',
          gstRate: 18,
          quantity: 1,
          unitPrice: 49900,
          lineTotal: 49900,
        },
      ],
      commission: { type: 'percentage', value: 12.5, amount: 31218, resolvedFrom: 'category' },
      shipment: { awb: 'SRTP4471902881', courier: 'Delhivery Surface', pickupPincode: '400072' },
      settlement: { status: 'locked_in_hold', eligibleAt: '2026-10-08', net: 263482 },
      subtotal: 289700,
      tax: 44955,
      shipping: 5000,
      total: 294700,
      timeline: [
        { label: 'Placed', at: '2 Sep 2026, 11:42', actor: 'Ananya Iyer', reason: null, done: true },
        { label: 'Payment verified', at: '2 Sep 2026, 11:42', actor: 'Razorpay webhook', reason: null, done: true },
        { label: 'Assigned to vendor', at: '2 Sep 2026, 11:43', actor: 'System', reason: null, done: true },
        { label: 'Vendor accepted', at: '2 Sep 2026, 12:10', actor: 'Nova Retail', reason: null, done: true },
        { label: 'Packed', at: '2 Sep 2026, 14:55', actor: 'Nova Retail', reason: null, done: true },
        { label: 'AWB generated', at: '2 Sep 2026, 15:02', actor: 'Shiprocket', reason: null, done: true },
        { label: 'Shipped', at: '2 Sep 2026, 18:20', actor: 'Delhivery Surface', reason: null, done: true, tone: 'success' },
        { label: 'In transit', at: null, actor: null, reason: null, done: false },
        { label: 'Delivered', at: null, actor: null, reason: null, done: false },
        { label: 'Settlement eligible', at: null, actor: null, reason: 'Opens 30 days after delivery', done: false },
      ],
    },
    {
      id: `${summary.id}-B`,
      model: BUSINESS_MODEL.OWN_STOCK,
      seller: { id: 'own-001', name: 'Krozenda Own Stock' },
      status: 'packed',
      items: [
        {
          id: 'itm-3',
          name: 'Aarohi Cotton Table Runner, 180 cm',
          sku: 'KZ-HD-RNR-180',
          hsn: '630232',
          gstRate: 12,
          quantity: 1,
          unitPrice: 89900,
          lineTotal: 89900,
        },
    ],
      commission: { type: 'percentage', value: 0, amount: 0, resolvedFrom: 'default' },
      shipment: { awb: null, courier: null, pickupPincode: '421302' },
      settlement: { status: 'not_applicable', eligibleAt: null, net: 0 },
      subtotal: 89900,
      tax: 10395,
      shipping: 5000,
      total: 94900,
      timeline: [
        { label: 'Placed', at: '2 Sep 2026, 11:42', actor: 'Ananya Iyer', reason: null, done: true },
        { label: 'Payment verified', at: '2 Sep 2026, 11:42', actor: 'Razorpay webhook', reason: null, done: true },
        { label: 'Assigned to warehouse', at: '2 Sep 2026, 11:43', actor: 'System', reason: null, done: true },
        { label: 'Packed', at: '2 Sep 2026, 16:30', actor: 'Bhiwandi warehouse', reason: null, done: true },
        { label: 'AWB generated', at: null, actor: null, reason: 'Pickup scheduled for 3 Sep', done: false },
        { label: 'Shipped', at: null, actor: null, reason: null, done: false },
        { label: 'Delivered', at: null, actor: null, reason: null, done: false },
      ],
    },
  ]

  return {
    id: summary.id,
    placedAt: summary.placedAt,
    buyer: {
      ...summary.buyer,
      email: 'ananya.iyer@example.in',
      phone: '+91 98455 20114',
      gstin: null,
    },
    shippingAddress: {
      line1: 'Flat 402, Brigade Palmgrove',
      line2: '18th Main, Koramangala 6th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
    },
    payment: {
      status: summary.paymentStatus,
      method: 'UPI · Google Pay',
      reference: 'pay_QeR41xK2mVn8Ld',
      capturedAt: '2026-09-02T11:42:18+05:30',
    },
    fulfilmentStatus: summary.fulfilmentStatus,
    totals: {
      // subtotal and shipping are GST-inclusive; `tax` is the GST contained
      // within them, which is why subtotal + shipping already equals total.
      subtotal: 379600,
      tax: 55350,
      shipping: 10000,
      discount: 0,
      total: 389600,
      commission: 31218,
    },
    subOrders,
  }
}
