import { ADMIN_ROUTES, adminPath } from '../../../config/routes'
import { BUSINESS_MODEL, ORDER_STATUS } from '../../../config/constants'
import { INTEGRATION_HEALTH } from '../constants'

// Shape matches schemas/dashboardSchema.js. Money is in PAISE.

// Kept for the interim summary endpoint the backend already exposes.
export function adminDashboardSummaryFixture() {
  return {
    totalUsers: 24816,
    totalSellers: 318,
    pendingApprovals: 34,
    ordersToday: 412,
  }
}

const trend = (values) => values.map((value) => ({ value }))

export function dashboardFixture() {
  return {
    updatedAt: '2026-09-02T14:38:00+05:30',

    kpis: [
      {
        key: 'gmv',
        label: 'Gross merchandise value',
        value: 1246840000,
        format: 'money',
        delta: { direction: 'up', label: '12.4%' },
        caption: 'vs previous 30 days',
        trend: trend([72, 81, 89, 97, 106, 116, 125, 134]),
      },
      {
        key: 'orders',
        label: 'Orders placed',
        value: 8942,
        format: 'count',
        delta: { direction: 'up', label: '6.1%' },
        caption: '3,204 sub-orders open',
        trend: trend([620, 664, 701, 742, 780, 812, 861, 894]),
      },
      {
        key: 'commission',
        label: 'Net commission',
        value: 98622000,
        format: 'money',
        delta: { direction: 'up', label: '8.7%' },
        caption: 'after TCS and TDS',
        trend: trend([54, 59, 63, 70, 76, 84, 91, 99]),
      },
      {
        key: 'held',
        label: 'Held for settlement',
        value: 142085000,
        format: 'money',
        delta: null,
        caption: '42 batches · 2 payouts failed',
        tone: 'brand',
      },
      {
        key: 'sellers',
        label: 'Active sellers',
        value: 318,
        format: 'count',
        delta: { direction: 'up', label: '+9' },
        caption: '12 awaiting KYC',
      },
    ],

    // Eight COMPLETE months — September is two days old, and a month-to-date
    // column next to seven full ones reads as a collapse rather than a
    // partial period. The last column (August) sums to exactly the GMV KPI
    // above, so a reader who adds it up gets the headline number.
    revenueByModel: [
      { label: 'Jan', [BUSINESS_MODEL.MARKETPLACE]: 420000000, [BUSINESS_MODEL.DROPSHIPPING]: 220000000, [BUSINESS_MODEL.OWN_STOCK]: 80000000 },
      { label: 'Feb', [BUSINESS_MODEL.MARKETPLACE]: 480000000, [BUSINESS_MODEL.DROPSHIPPING]: 240000000, [BUSINESS_MODEL.OWN_STOCK]: 90000000 },
      { label: 'Mar', [BUSINESS_MODEL.MARKETPLACE]: 510000000, [BUSINESS_MODEL.DROPSHIPPING]: 270000000, [BUSINESS_MODEL.OWN_STOCK]: 110000000 },
      { label: 'Apr', [BUSINESS_MODEL.MARKETPLACE]: 580000000, [BUSINESS_MODEL.DROPSHIPPING]: 290000000, [BUSINESS_MODEL.OWN_STOCK]: 100000000 },
      { label: 'May', [BUSINESS_MODEL.MARKETPLACE]: 620000000, [BUSINESS_MODEL.DROPSHIPPING]: 310000000, [BUSINESS_MODEL.OWN_STOCK]: 130000000 },
      { label: 'Jun', [BUSINESS_MODEL.MARKETPLACE]: 680000000, [BUSINESS_MODEL.DROPSHIPPING]: 340000000, [BUSINESS_MODEL.OWN_STOCK]: 140000000 },
      { label: 'Jul', [BUSINESS_MODEL.MARKETPLACE]: 740000000, [BUSINESS_MODEL.DROPSHIPPING]: 360000000, [BUSINESS_MODEL.OWN_STOCK]: 150000000 },
      { label: 'Aug', [BUSINESS_MODEL.MARKETPLACE]: 760000000, [BUSINESS_MODEL.DROPSHIPPING]: 330000000, [BUSINESS_MODEL.OWN_STOCK]: 156840000 },
    ],

    pipeline: [
      { status: ORDER_STATUS.PLACED, label: 'Placed', count: 8942 },
      { status: ORDER_STATUS.PAYMENT_VERIFIED, label: 'Payment verified', count: 8911 },
      { status: ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR, label: 'Vendor assigned', count: 8780 },
      { status: ORDER_STATUS.VENDOR_ACCEPTED, label: 'Vendor accepted', count: 8602 },
      { status: ORDER_STATUS.PACKED, label: 'Packed', count: 8104 },
      { status: ORDER_STATUS.SHIPPED, label: 'Shipped', count: 7655 },
      { status: ORDER_STATUS.DELIVERED, label: 'Delivered', count: 6918 },
      { status: ORDER_STATUS.SETTLED, label: 'Settled', count: 5240 },
    ],

    exceptions: [
      { label: 'Cancelled', count: 312, tone: 'danger' },
      { label: 'RTO', count: 148, tone: 'warning' },
      { label: 'Returned', count: 96, tone: 'neutral' },
    ],

    actionQueue: [
      {
        id: 'kyc',
        icon: 'kyc',
        tone: 'warning',
        title: 'KYC documents to review',
        subtitle: 'Oldest waiting 4 days',
        count: 12,
        to: ADMIN_ROUTES.KYC_QUEUE,
      },
      {
        id: 'approvals',
        icon: 'approvals',
        tone: 'brand',
        title: 'Products awaiting approval',
        subtitle: '28 marketplace · 6 dropship',
        count: 34,
        to: ADMIN_ROUTES.CATALOG_APPROVALS,
      },
      {
        id: 'returns',
        icon: 'returns',
        tone: 'danger',
        title: 'Return requests with evidence',
        subtitle: 'Damaged 3 · Wrong item 2',
        count: 5,
        to: ADMIN_ROUTES.RETURNS,
      },
      {
        id: 'payouts',
        icon: 'settlements',
        tone: 'danger',
        title: 'Failed payouts to retry',
        subtitle: 'Bank details need updating',
        count: 2,
        to: ADMIN_ROUTES.SETTLEMENTS,
      },
    ],

    integrations: [
      { id: 'razorpay', name: 'Razorpay Route', status: INTEGRATION_HEALTH.OPERATIONAL, note: null },
      { id: 'shiprocket', name: 'Shiprocket', status: INTEGRATION_HEALTH.OPERATIONAL, note: null },
      {
        id: 'sms',
        name: 'SMS India Hub',
        status: INTEGRATION_HEALTH.DEGRADED,
        note: '3 DLT templates pending approval',
      },
      { id: 'smtp', name: 'SMTP', status: INTEGRATION_HEALTH.OPERATIONAL, note: null },
      { id: 'fcm', name: 'Firebase FCM', status: INTEGRATION_HEALTH.OPERATIONAL, note: null },
    ],

    recentSubOrders: [
      { id: 'KZ-40128-A', orderId: 'KZ-40128', seller: 'Nova Retail Pvt Ltd', model: BUSINESS_MODEL.MARKETPLACE, status: ORDER_STATUS.SHIPPED, total: 294700 },
      { id: 'KZ-40128-B', orderId: 'KZ-40128', seller: 'Krozenda Own Stock', model: BUSINESS_MODEL.OWN_STOCK, status: ORDER_STATUS.PACKED, total: 94900 },
      { id: 'KZ-40127-A', orderId: 'KZ-40127', seller: 'Arya Manufacturing', model: BUSINESS_MODEL.DROPSHIPPING, status: ORDER_STATUS.IN_TRANSIT, total: 942000 },
      { id: 'KZ-40126-A', orderId: 'KZ-40126', seller: 'Sunrise Traders', model: BUSINESS_MODEL.MARKETPLACE, status: 'rto_initiated', total: 4860000 },
      { id: 'KZ-40125-C', orderId: 'KZ-40125', seller: 'Meghna Wholesale', model: BUSINESS_MODEL.DROPSHIPPING, status: ORDER_STATUS.DELIVERED, total: 1294000 },
    ],
  }
}

export const DASHBOARD_LINKS = Object.freeze({
  order: (orderId) => adminPath.orderDetail(orderId),
})
