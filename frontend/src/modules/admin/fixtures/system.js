import { ADMIN_ROUTES } from '../../../config/routes'
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

// The billing specification's platform_configurations document, rendered as a
// form rather than as JSON. The `changed` list drives the unsaved indicator.
export function businessRulesFixture() {
  return {
    sellerModel: {
      commissionType: 'percentage',
      commissionRate: 15,
      gstOnCommissionRate: 18,
      tcsSec52Rate: 1,
      tdsSec194oRate: 1,
      settlementHoldDays: 30,
      shippingBearer: 'buyer',
    },
    dropshipModel: {
      defaultMarginPercentage: 25,
      settlementHoldDays: 30,
      merchantOfRecord: 'Krozenda entity',
      b2bGstCreditEnabled: true,
    },
    logistics: { defaultFlatShippingRate: 5000, freeShippingThreshold: 49900 },
    payouts: {
      autoPayoutEnabled: true,
      approvalMode: 'maker_checker',
      minimumPayoutAmount: 25000,
      schedule: 'Weekly — every Monday',
      transferMode: 'IMPS',
      lastRunAt: '2 Sep 2026, 02:00',
    },
    returns: { windowDays: 7, minimumEvidencePhotos: 2, rtoCostBearer: 'vendor' },
    changed: ['commissionRate', 'minimumPayoutAmount', 'rtoCostBearer'],
  }
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
      { id: 'razorpay', name: 'Razorpay Route', purpose: 'Payments and split settlement to vendor linked accounts', status: INTEGRATION_HEALTH.OPERATIONAL, note: null, environment: 'Live', lastEventAt: '2 Sep 2026, 14:36', ownedBy: 'client', settingsPath: ADMIN_ROUTES.SETTINGS_PAYMENTS },
      { id: 'shiprocket', name: 'Shiprocket', purpose: 'AWB, courier allocation, pickup and tracking webhooks', status: INTEGRATION_HEALTH.OPERATIONAL, note: null, environment: 'Live', lastEventAt: '2 Sep 2026, 14:31', ownedBy: 'client', settingsPath: ADMIN_ROUTES.SETTINGS_LOGISTICS },
      { id: 'sms', name: 'SMS India Hub', purpose: 'Transactional SMS and every OTP', status: INTEGRATION_HEALTH.DEGRADED, note: '3 DLT templates awaiting TRAI approval — affected messages are queued', environment: 'Live', lastEventAt: '2 Sep 2026, 14:28', ownedBy: 'client', settingsPath: ADMIN_ROUTES.SETTINGS_NOTIFICATIONS },
      { id: 'smtp', name: 'SMTP', purpose: 'Order confirmations, invoices and verification links', status: INTEGRATION_HEALTH.OPERATIONAL, note: 'SPF, DKIM and DMARC all verified', environment: 'Live', lastEventAt: '2 Sep 2026, 14:34', ownedBy: 'client', settingsPath: ADMIN_ROUTES.SETTINGS_NOTIFICATIONS },
      { id: 'fcm', name: 'Firebase Cloud Messaging', purpose: 'Push notifications to the buyer and seller apps', status: INTEGRATION_HEALTH.OPERATIONAL, note: 'Push only — no Firebase Auth, Firestore or Storage', environment: 'Live', lastEventAt: '2 Sep 2026, 14:20', ownedBy: 'client', settingsPath: ADMIN_ROUTES.SETTINGS_NOTIFICATIONS },
    ],
  }
}

export function securitySettingsFixture() {
  return {
    policies: [
      { key: 'require_2fa', label: 'Require two-factor for every admin', description: 'Nobody reaches the panel with a password alone.', enabled: true },
      { key: 'login_alerts', label: 'Login alerts', description: 'Email the account owner on a sign-in from a new device or location.', enabled: true },
      { key: 'ip_allowlist', label: 'Restrict to allowlisted IPs', description: 'Sign-in is refused from anywhere outside the list below.', enabled: false },
      { key: 'encrypt_kyc', label: 'Encrypt KYC documents at rest', description: 'Uploaded PAN, Aadhaar and bank documents are stored encrypted.', enabled: true },
      { key: 'session_pinning', label: 'Bind sessions to a device', description: 'A stolen token cannot be replayed from another device.', enabled: true },
    ],
    sessionMaxHours: 12,
    passwordMinLength: 12,
    lockoutAttempts: 5,
    ipAllowlist: ['103.21.244.0/24', '49.36.180.22', '157.32.14.201'],
    recentSignIns: [
      { id: 'si-1', person: 'Priya Sharma', at: '2 Sep 2026, 09:14', ip: '103.21.244.18', location: 'Mumbai, IN', device: 'Chrome on macOS', outcome: 'success' },
      { id: 'si-2', person: 'Anil Varma', at: '2 Sep 2026, 08:40', ip: '103.21.244.22', location: 'Mumbai, IN', device: 'Firefox on Windows', outcome: 'success' },
      { id: 'si-3', person: 'Deepa Raghunathan', at: '1 Sep 2026, 18:22', ip: '49.36.180.22', location: 'Bengaluru, IN', device: 'Chrome on Windows', outcome: 'success' },
      { id: 'si-4', person: 'unknown@krozenda.in', at: '1 Sep 2026, 03:11', ip: '45.148.10.94', location: 'Amsterdam, NL', device: 'curl/8.4', outcome: 'failed' },
      { id: 'si-5', person: 'Rahul Bhatt', at: '31 Aug 2026, 22:48', ip: '182.70.11.65', location: 'Pune, IN', device: 'Safari on iOS', outcome: 'locked' },
    ],
  }
}

export function webhookListFixture() {
  return {
    keys: [
      { id: 'key-1', label: 'Shiprocket callback key', prefix: 'kz_live_srkt_', createdAt: '18 Jun 2026', lastUsedAt: '2 Sep 2026, 14:31', scopes: ['shipments.write'] },
      { id: 'key-2', label: 'Razorpay webhook secret', prefix: 'kz_live_rzp_', createdAt: '12 Jun 2026', lastUsedAt: '2 Sep 2026, 14:36', scopes: ['payments.write', 'settlements.write'] },
      { id: 'key-3', label: 'Internal reporting key', prefix: 'kz_live_rpt_', createdAt: '4 Jul 2026', lastUsedAt: null, scopes: ['reports.read'] },
    ],
    endpoints: [
      { id: 'ep-1', url: 'https://api.krozenda.in/hooks/razorpay', events: ['payment.captured', 'payment.failed', 'refund.processed', 'payout.processed', 'payout.failed'], status: 'healthy', lastDeliveryAt: '2 Sep 2026, 14:36', failures24h: 0 },
      { id: 'ep-2', url: 'https://api.krozenda.in/hooks/shiprocket', events: ['shipment.picked', 'shipment.in_transit', 'shipment.delivered', 'shipment.rto'], status: 'healthy', lastDeliveryAt: '2 Sep 2026, 14:31', failures24h: 0 },
      { id: 'ep-3', url: 'https://ops.krozenda.in/hooks/alerts', events: ['payout.failed', 'kyc.submitted'], status: 'failing', lastDeliveryAt: '1 Sep 2026, 22:04', failures24h: 14 },
    ],
  }
}

export function policySettingsFixture() {
  return {
    items: [
      { id: 'pol-1', name: 'Vendor Agreement', version: 'v2.1', effectiveFrom: '4 Jul 2026', acceptedBy: 306, pendingAcceptance: 12, requiresReacceptance: false },
      { id: 'pol-2', name: 'Privacy Policy', version: 'v1.4', effectiveFrom: '12 Aug 2026', acceptedBy: 24680, pendingAcceptance: 136, requiresReacceptance: false },
      { id: 'pol-3', name: 'Terms & Conditions', version: 'v3.0', effectiveFrom: '12 Aug 2026', acceptedBy: 24612, pendingAcceptance: 204, requiresReacceptance: false },
      { id: 'pol-4', name: 'Return Policy', version: 'v1.3', effectiveFrom: '20 Aug 2026', acceptedBy: 184, pendingAcceptance: 134, requiresReacceptance: true },
      { id: 'pol-5', name: 'Shipping Policy', version: 'v1.1', effectiveFrom: '2 May 2026', acceptedBy: 318, pendingAcceptance: 0, requiresReacceptance: false },
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

export function adminProfileFixture() {
  return {
    name: 'Priya Sharma',
    email: 'priya.sharma@krozenda.in',
    phone: '+91 98204 11276',
    role: 'Super Admin',
    joinedAt: '1 Jan 2026',
    twoFactorEnabled: true,
    sessions: [
      { id: 'ses-1', device: 'Chrome on macOS', location: 'Mumbai, IN', lastActiveAt: 'Active now', current: true },
      { id: 'ses-2', device: 'Safari on iPhone', location: 'Mumbai, IN', lastActiveAt: '2 Sep 2026, 08:12', current: false },
      { id: 'ses-3', device: 'Chrome on Windows', location: 'Pune, IN', lastActiveAt: '28 Aug 2026, 17:40', current: false },
    ],
    notifications: [
      { key: 'payout_failed', label: 'A payout fails', email: true, push: true },
      { key: 'kyc_submitted', label: 'A seller submits KYC', email: true, push: false },
      { key: 'batch_awaiting', label: 'A settlement batch needs approval', email: true, push: true },
      { key: 'return_raised', label: 'A return request is raised', email: false, push: true },
      { key: 'integration_down', label: 'An integration goes down', email: true, push: true },
      { key: 'weekly_digest', label: 'Weekly performance digest', email: true, push: false },
    ],
  }
}
