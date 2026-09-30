import { INTEGRATION_HEALTH } from '../constants'

// Shapes match schemas/systemSchema.js. Money is in PAISE.

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

export function generalSettingsFixture() {
  return {
    platform: {
      name: 'Krozenda',
      legalEntity: 'Krozenda Commerce Private Limited',
      gstin: '27AAECK4821M1Z9',
      supportEmail: 'help@krozenda.in',
      supportPhone: '+91 22 6820 4400',
      timezone: 'Asia/Kolkata (IST, UTC+5:30)',
      currency: 'Indian Rupee (INR)',
      defaultCommissionPercent: 10,
      defaultGstRate: 18,
      gstOnCommissionRate: 18,
      commissionBase: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT',
    },
    toggles: [
      { key: 'seller_self_registration', label: 'Seller self-registration', description: 'Marketplace sellers can sign up without an invitation. Dropshipping partners are always added by an admin.', enabled: true },
      { key: 'b2b_pricing', label: 'B2B tiered pricing', description: 'Dealers, distributors and wholesalers resolve their own price tier at checkout.', enabled: true },
      { key: 'guest_checkout', label: 'Guest checkout', description: 'Buyers can complete an order without registering. A mobile number is still required.', enabled: false },
      { key: 'reviews', label: 'Product reviews', description: 'Buyers can rate and review a delivered product. Reviews go to moderation first.', enabled: true },
      { key: 'maintenance', label: 'Maintenance mode', description: 'Storefront shows a holding page. The admin panel stays reachable.', enabled: false },
    ],
  }
}

export function integrationListFixture() {
  return {
    items: [
      { id: 'razorpay', name: 'Razorpay Route', purpose: 'Payments and split settlement to vendor linked accounts', status: INTEGRATION_HEALTH.OPERATIONAL, note: null, environment: 'Live', lastEventAt: '2 Sep 2026, 14:36', ownedBy: 'client' },
      { id: 'shiprocket', name: 'Shiprocket', purpose: 'AWB, courier allocation, pickup and tracking webhooks', status: INTEGRATION_HEALTH.OPERATIONAL, note: null, environment: 'Live', lastEventAt: '2 Sep 2026, 14:31', ownedBy: 'client' },
      { id: 'sms', name: 'SMS India Hub', purpose: 'Transactional SMS and every OTP', status: INTEGRATION_HEALTH.DEGRADED, note: '3 DLT templates awaiting TRAI approval — affected messages are queued', environment: 'Live', lastEventAt: '2 Sep 2026, 14:28', ownedBy: 'client' },
      { id: 'smtp', name: 'SMTP', purpose: 'Order confirmations, invoices and verification links', status: INTEGRATION_HEALTH.OPERATIONAL, note: 'SPF, DKIM and DMARC all verified', environment: 'Live', lastEventAt: '2 Sep 2026, 14:34', ownedBy: 'client' },
      { id: 'fcm', name: 'Firebase Cloud Messaging', purpose: 'Push notifications to the buyer and seller apps', status: INTEGRATION_HEALTH.OPERATIONAL, note: 'Push only — no Firebase Auth, Firestore or Storage', environment: 'Live', lastEventAt: '2 Sep 2026, 14:20', ownedBy: 'client' },
    ],
  }
}

export function taxSettingsFixture() {
  return {
    slabs: [
      { rate: 0, label: 'Exempt', productCount: 2840 },
      { rate: 5, label: '5% — essentials', productCount: 12406 },
      { rate: 12, label: '12% — standard reduced', productCount: 28410 },
      { rate: 18, label: '18% — standard', productCount: 52180 },
      { rate: 28, label: '28% — luxury', productCount: 8384 },
    ],
    defaults: {
      placeOfSupplyRule: "Buyer's shipping address determines the place of supply",
      hsnRequiredFrom: 'All taxable products — 6 or 8 digits',
      roundingRule: 'Round the invoice total to the nearest rupee',
      invoicePrefix: 'KZ/2627/',
    },
  }
}

const AUDIT = [
  { id: 'aud-1', at: '2 Sep 2026, 14:22', actor: 'Priya Sharma', actorRole: 'Super Admin', action: 'settings.business_rules.update', entity: 'Business rules', entityId: 'platform_configurations', ip: '103.21.244.18', before: 'commissionRate: 12.5', after: 'commissionRate: 15.0', severity: 'critical' },
  { id: 'aud-2', at: '2 Sep 2026, 11:48', actor: 'Deepa Raghunathan', actorRole: 'Operations', action: 'kyc.document.reject', entity: 'KYC document', entityId: 'doc-4', ip: '49.36.180.22', before: 'status: reviewing', after: 'status: rejected', severity: 'notable' },
  { id: 'aud-3', at: '2 Sep 2026, 10:02', actor: 'Anil Varma', actorRole: 'Finance Manager', action: 'settlement.batch.prepare', entity: 'Settlement batch', entityId: 'stl-1', ip: '103.21.244.22', before: null, after: 'status: awaiting_approval', severity: 'notable' },
  { id: 'aud-4', at: '2 Sep 2026, 09:14', actor: 'Priya Sharma', actorRole: 'Super Admin', action: 'auth.sign_in', entity: 'Session', entityId: 'usr-1', ip: '103.21.244.18', before: null, after: null, severity: 'info' },
  { id: 'aud-5', at: '1 Sep 2026, 22:04', actor: 'System', actorRole: 'Automated job', action: 'webhook.delivery.fail', entity: 'Webhook endpoint', entityId: 'ep-3', ip: '10.0.4.18', before: null, after: 'failures24h: 14', severity: 'notable' },
  { id: 'aud-6', at: '1 Sep 2026, 19:40', actor: 'Priya Sharma', actorRole: 'Super Admin', action: 'order.cancel', entity: 'Sub-order', entityId: 'KZ-40101-A', ip: '103.21.244.18', before: 'status: packed', after: 'status: cancelled_admin', severity: 'critical' },
  { id: 'aud-7', at: '1 Sep 2026, 15:12', actor: 'Deepa Raghunathan', actorRole: 'Operations', action: 'product.approve', entity: 'Product', entityId: 'prd-4', ip: '49.36.180.22', before: 'status: reviewing', after: 'status: approved', severity: 'info' },
  { id: 'aud-8', at: '1 Sep 2026, 03:11', actor: 'unknown@krozenda.in', actorRole: 'Unauthenticated', action: 'auth.sign_in.fail', entity: 'Session', entityId: '—', ip: '45.148.10.94', before: null, after: 'reason: unknown_account', severity: 'critical' },
]

const AUDIT_TABS = {
  all: () => true,
  critical: (a) => a.severity === 'critical',
  finance: (a) => a.action.startsWith('settlement') || a.action.startsWith('settings.business'),
  access: (a) => a.action.startsWith('auth') || a.action.startsWith('role'),
  failed: (a) => a.action.endsWith('.fail'),
}

export function auditLogFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = AUDIT.filter(AUDIT_TABS[tab] || AUDIT_TABS.all)
  rows = search(rows, filters.search, ['actor', 'action', 'entity', 'entityId', 'ip'])
  if (filters.severity) rows = rows.filter((a) => a.severity === filters.severity)
  return page(rows, AUDIT, AUDIT_TABS, query)
}

export function backupFixture() {
  return {
    schedule: {
      daily: true,
      dailyAt: '01:30 IST',
      cloudReplication: true,
      retentionDays: 30,
      lastRestoreTestAt: '18 Aug 2026',
    },
    runs: [
      { id: 'bk-1', startedAt: '2 Sep 2026, 01:30', sizeMb: 4820, durationSeconds: 412, destination: 'S3 ap-south-1 + Glacier', status: 'success' },
      { id: 'bk-2', startedAt: '1 Sep 2026, 01:30', sizeMb: 4784, durationSeconds: 398, destination: 'S3 ap-south-1 + Glacier', status: 'success' },
      { id: 'bk-3', startedAt: '31 Aug 2026, 01:30', sizeMb: 4712, durationSeconds: 386, destination: 'S3 ap-south-1 + Glacier', status: 'success' },
      { id: 'bk-4', startedAt: '30 Aug 2026, 01:30', sizeMb: 0, durationSeconds: 22, destination: 'S3 ap-south-1', status: 'failed' },
      { id: 'bk-5', startedAt: '29 Aug 2026, 01:30', sizeMb: 4640, durationSeconds: 374, destination: 'S3 ap-south-1 + Glacier', status: 'success' },
    ],
  }
}

const TICKETS = [
  { id: 'tkt-1841', subject: 'Refund not received after cancellation', raisedBy: 'Imran Qureshi', party: 'buyer', category: 'Refunds', openedAt: '2 Sep 2026', ageHours: 5, priority: 'high', owner: 'Deepa Raghunathan', status: 'open' },
  { id: 'tkt-1840', subject: 'Payout failed twice — bank details correct', raisedBy: 'Sunrise Traders', party: 'seller', category: 'Settlements', openedAt: '2 Sep 2026', ageHours: 8, priority: 'urgent', owner: 'Anil Varma', status: 'open' },
  { id: 'tkt-1838', subject: 'Cannot upload GST certificate — file rejected', raisedBy: 'Vaidya Ayurveda Works', party: 'seller', category: 'KYC', openedAt: '1 Sep 2026', ageHours: 26, priority: 'normal', owner: null, status: 'open' },
  { id: 'tkt-1836', subject: 'Wrong size delivered, need exchange', raisedBy: 'Sneha Kulkarni', party: 'buyer', category: 'Returns', openedAt: '1 Sep 2026', ageHours: 30, priority: 'normal', owner: 'Deepa Raghunathan', status: 'waiting' },
  { id: 'tkt-1829', subject: 'Bulk price not applying at 100 units', raisedBy: 'Kritika Enterprises', party: 'buyer', category: 'Pricing', openedAt: '31 Aug 2026', ageHours: 52, priority: 'high', owner: 'Sanjay Kulkarni', status: 'waiting' },
  { id: 'tkt-1812', subject: 'Add a second pickup location', raisedBy: 'Nova Retail Pvt Ltd', party: 'seller', category: 'Logistics', openedAt: '29 Aug 2026', ageHours: 96, priority: 'low', owner: 'Sanjay Kulkarni', status: 'resolved' },
]

const TICKET_TABS = {
  all: () => true,
  open: (t) => t.status === 'open',
  unassigned: (t) => t.owner === null,
  urgent: (t) => ['urgent', 'high'].includes(t.priority) && t.status !== 'resolved',
  resolved: (t) => ['resolved', 'closed'].includes(t.status),
}

export function supportTicketFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = TICKETS.filter(TICKET_TABS[tab] || TICKET_TABS.all)
  rows = search(rows, filters.search, ['id', 'subject', 'raisedBy', 'category'])
  if (filters.party) rows = rows.filter((t) => t.party === filters.party)
  return page(rows, TICKETS, TICKET_TABS, query)
}
