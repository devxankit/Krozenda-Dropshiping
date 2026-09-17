// Path constants for every module. Modules build their own routes.jsx from
// these; nothing outside this file should write a raw path string.

export const AUTH_ROUTES = Object.freeze({
  ROOT: '/auth',
  WELCOME: '/auth/welcome',
  LOGIN: '/auth/login',
  MOBILE: '/auth/mobile',
  OTP: '/auth/otp',
  VERIFIED: '/auth/verified',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
})

// Buyer app.
//
// The detail routes below carry their id IN THE PATH. They used to be flat
// paths (`/app/product`, `/app/orders/details`) that read the id out of
// react-router `location.state`, which meant: no shareable product link, no
// deep link from a push notification, and a WebView reload or an Android back
// press landed on a "No product selected" screen. Patterns are built with
// `userPath.*` below — never by concatenating strings at the call site.
export const USER_ROUTES = Object.freeze({
  ROOT: '/app',
  DASHBOARD: '/app/dashboard',
  SHOWCASE: '/app/showcase',
  CATEGORIES: '/app/categories',
  LISTING: '/app/listing',
  SEARCH: '/app/search',
  CART: '/app/cart',
  WISHLIST: '/app/wishlist',
  ORDERS: '/app/orders',
  NOTIFICATIONS: '/app/notifications',
  COUPONS: '/app/coupons',
  SUPPORT: '/app/support',
  RETURNS: '/app/returns',
  SETTINGS: '/app/settings',
  PROFILE: '/app/profile',
  PROFILE_EDIT: '/app/profile/edit',
  ADDRESSES: '/app/profile/addresses',

  CHECKOUT_ADDRESS: '/app/checkout/address',
  CHECKOUT_DELIVERY: '/app/checkout/delivery',
  CHECKOUT_SUMMARY: '/app/checkout/summary',
  CHECKOUT_PAYMENT: '/app/checkout/payment',
  CHECKOUT_SUCCESS: '/app/checkout/success',

  // ---- patterns (use userPath.* to build a concrete URL) ------------------
  PRODUCT_DETAIL: '/app/product/:productId',
  ORDER_DETAIL: '/app/orders/:orderId',
  ORDER_TRACK: '/app/orders/:orderId/track',
  ORDER_INVOICE: '/app/orders/:orderId/invoice',
  ORDER_INVOICE_PREVIEW: '/app/orders/:orderId/invoice/preview',
  ORDER_REVIEW: '/app/orders/:orderId/review',
})

// Concrete-URL builders. Query strings are built by the screens themselves via
// useCatalogParams, so these only fill path parameters.
export const userPath = Object.freeze({
  product: (productId) => `/app/product/${productId}`,
  order: (orderId) => `/app/orders/${orderId}`,
  orderTrack: (orderId) => `/app/orders/${orderId}/track`,
  orderInvoice: (orderId) => `/app/orders/${orderId}/invoice`,
  orderInvoicePreview: (orderId) => `/app/orders/${orderId}/invoice/preview`,
  orderReview: (orderId) => `/app/orders/${orderId}/review`,
  // Catalog links carry their filters in the query string so they are
  // shareable and survive a refresh.
  listing: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        qs.set(key, String(value))
      }
    }
    const query = qs.toString()
    return query ? `/app/listing?${query}` : '/app/listing'
  },
  search: (query) => `/app/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
})

export const SELLER_ROUTES = Object.freeze({
  ROOT: '/seller',
  LOGIN: '/seller/login',
  REGISTER: '/seller/register',
  DASHBOARD: '/seller/dashboard',
  KYC_DOCUMENTS: '/seller/kyc-documents',
})

export const DROPSHIPPING_PARTNER_ROUTES = Object.freeze({
  ROOT: '/partner',
  DASHBOARD: '/partner/dashboard',
  KYC_DOCUMENTS: '/partner/kyc-documents',
})

// ---------------------------------------------------------------------------
// Admin panel — 89 routes across 9 navigation groups.
//
// Sign-in and the other unauthenticated screens sit under the same /admin
// prefix but OUTSIDE the auth guard; modules/admin/routes.jsx is where that
// boundary is drawn, so the panel owns its own login rather than borrowing
// the buyer app's OTP flow.
//
// Detail routes are stored as patterns (`:productId`). Build a concrete URL
// with `adminPath.*` below — never by concatenating strings at the call site.
// ---------------------------------------------------------------------------
export const ADMIN_ROUTES = Object.freeze({
  ROOT: '/admin',

  // ---- authentication (unguarded) ----------------------------------------
  LOGIN: '/admin/login',
  TWO_FACTOR: '/admin/two-factor',
  FORGOT_PASSWORD: '/admin/forgot-password',
  RESET_PASSWORD: '/admin/reset-password',
  LOCKED: '/admin/locked',

  // ---- dashboard & analytics ---------------------------------------------
  DASHBOARD: '/admin/dashboard',
  ANALYTICS_SALES: '/admin/analytics/sales',
  ANALYTICS_VENDORS: '/admin/analytics/vendors',
  ANALYTICS_CATALOG: '/admin/analytics/catalog',
  ANALYTICS_CUSTOMERS: '/admin/analytics/customers',

  // ---- catalog ------------------------------------------------------------
  PRODUCTS: '/admin/catalog/products',
  PRODUCT_NEW: '/admin/catalog/products/new',
  PRODUCT_DETAIL: '/admin/catalog/products/:productId',
  CATALOG_APPROVALS: '/admin/catalog/approvals',
  CATALOG_IMPORT: '/admin/catalog/import',
  CATEGORIES: '/admin/catalog/categories',
  BRANDS: '/admin/catalog/brands',
  ATTRIBUTES: '/admin/catalog/attributes',
  INVENTORY: '/admin/catalog/inventory',
  SUPPLIER_SYNC: '/admin/catalog/supplier-sync',

  // ---- orders & fulfilment ------------------------------------------------
  ORDERS: '/admin/orders',
  ORDER_DETAIL: '/admin/orders/detail/:orderId',
  SUB_ORDERS: '/admin/orders/sub-orders',
  SUB_ORDER_DETAIL: '/admin/orders/sub-orders/:subOrderId',
  SHIPMENTS: '/admin/orders/shipments',
  // Carrier-backed parcels, distinct from SHIPMENTS above — that screen lists
  // tracking numbers typed onto order items by hand, which is still a valid
  // flow for sellers with no courier account connected.
  CARRIER_SHIPMENTS: '/admin/orders/carrier-shipments',
  CARRIER_ACCOUNTS: '/admin/orders/carrier-accounts',
  RTO: '/admin/orders/rto',
  RETURNS: '/admin/orders/returns',
  RETURN_DETAIL: '/admin/orders/returns/:returnId',
  CANCELLATIONS: '/admin/orders/cancellations',
  INVOICES: '/admin/orders/invoices',
  INVOICE_DETAIL: '/admin/orders/invoices/:invoiceId',

  // ---- people & vendors ---------------------------------------------------
  CUSTOMERS: '/admin/people/customers',
  CUSTOMER_DETAIL: '/admin/people/customers/:customerId',
  B2B_BUYERS: '/admin/people/b2b-buyers',
  SELLERS: '/admin/people/sellers',
  SELLER_DETAIL: '/admin/people/sellers/:sellerId',
  PARTNERS: '/admin/people/partners',
  PARTNER_DETAIL: '/admin/people/partners/:partnerId',
  COMPANIES: '/admin/people/companies',
  CHANNEL_PARTNERS: '/admin/people/channel',
  KYC_QUEUE: '/admin/people/kyc',
  KYC_REVIEW: '/admin/people/kyc/:applicationId',
  POLICY_ACCEPTANCES: '/admin/people/policy-acceptances',
  STAFF: '/admin/people/staff',
  USER_MANAGEMENT: '/admin/people/user-management',
  ROLES: '/admin/people/roles',
  ROLE_DETAIL: '/admin/people/roles/:roleId',

  // ---- finance & accounting -----------------------------------------------
  FINANCE_OVERVIEW: '/admin/finance/overview',
  TRANSACTIONS: '/admin/finance/transactions',
  REFUNDS: '/admin/finance/refunds',
  SETTLEMENTS: '/admin/finance/settlements',
  SETTLEMENT_BATCH: '/admin/finance/settlements/:batchId',
  VENDOR_LEDGERS: '/admin/finance/vendor-ledger',
  VENDOR_LEDGER_DETAIL: '/admin/finance/vendor-ledger/:vendorId',
  COMMISSION_RULES: '/admin/finance/commission-rules',
  PRICING_RULES: '/admin/finance/pricing-rules',
  CHART_OF_ACCOUNTS: '/admin/finance/chart-of-accounts',
  JOURNAL_VOUCHERS: '/admin/finance/journal-vouchers',
  EXPENSES: '/admin/finance/expenses',
  PNL: '/admin/finance/pnl',
  BALANCE_SHEET: '/admin/finance/balance-sheet',
  TRIAL_BALANCE: '/admin/finance/trial-balance',
  CASH_FLOW: '/admin/finance/cash-flow',
  TAX_CENTER: '/admin/finance/tax-center',

  // ---- accounting ---------------------------------------------------------
  // The marketplace money trail: order -> payment -> commission -> seller
  // ledger -> settlement -> payout -> refund. Distinct from the Finance group
  // above, which is the operational payments view over orders.
  ACCOUNTING: '/admin/accounting',
  ACCOUNTING_TRANSACTIONS: '/admin/accounting/transactions',
  ACCOUNTING_TRANSACTION_DETAIL: '/admin/accounting/transactions/:transactionId',
  ACCOUNTING_SELLER_LEDGER: '/admin/accounting/seller-ledger',
  ACCOUNTING_SELLER_LEDGER_DETAIL: '/admin/accounting/seller-ledger/:sellerId',
  ACCOUNTING_COMMISSIONS: '/admin/accounting/commissions',
  ACCOUNTING_SETTLEMENTS: '/admin/accounting/settlements',
  ACCOUNTING_SETTLEMENT_DETAIL: '/admin/accounting/settlements/:settlementId',
  ACCOUNTING_PAYOUTS: '/admin/accounting/payouts',
  ACCOUNTING_PAYOUT_DETAIL: '/admin/accounting/payouts/:payoutId',
  ACCOUNTING_REFUNDS: '/admin/accounting/refunds',
  ACCOUNTING_REPORTS: '/admin/accounting/reports',
  ACCOUNTING_REPORT_DETAIL: '/admin/accounting/reports/:reportKey',

  // ---- dropshipping -------------------------------------------------------
  DROPSHIPPING_OVERVIEW: '/admin/dropshipping',
  DROPSHIPPING_PARTNERS: '/admin/dropshipping/partners',
  DROPSHIPPING_PARTNER_DETAIL: '/admin/dropshipping/partners/:partnerId',
  DROPSHIPPING_PRODUCTS: '/admin/dropshipping/products',
  DROPSHIPPING_ORDERS: '/admin/dropshipping/orders',
  DROPSHIPPING_MARGINS: '/admin/dropshipping/margins',

  // ---- marketing & content ------------------------------------------------
  COUPONS: '/admin/marketing/coupons',
  OFFERS: '/admin/marketing/offers',
  BANNERS: '/admin/marketing/banners',
  CMS_PAGES: '/admin/marketing/cms',
  CAMPAIGNS: '/admin/marketing/campaigns',
  TEMPLATES: '/admin/marketing/templates',
  REVIEWS: '/admin/marketing/reviews',

  // ---- reports ------------------------------------------------------------
  REPORTS: '/admin/reports',
  REPORT_RUNNER: '/admin/reports/:reportKey',

  // ---- settings & system --------------------------------------------------
  SETTINGS_GENERAL: '/admin/settings/general',
  SETTINGS_BUSINESS_RULES: '/admin/settings/business-rules',
  SETTINGS_PAYMENTS: '/admin/settings/payments',
  SETTINGS_LOGISTICS: '/admin/settings/logistics',
  SETTINGS_NOTIFICATIONS: '/admin/settings/notifications',
  SETTINGS_TAXES: '/admin/settings/taxes',
  SETTINGS_POLICIES: '/admin/settings/policies',
  SETTINGS_SECURITY: '/admin/settings/security',
  SETTINGS_API_WEBHOOKS: '/admin/settings/api-webhooks',
  SETTINGS_INTEGRATIONS: '/admin/settings/integrations',
  AUDIT_LOGS: '/admin/system/audit-logs',
  BACKUPS: '/admin/system/backups',
  SUPPORT_TICKETS: '/admin/support/tickets',
  SUPPORT_TICKET_DETAIL: '/admin/support/tickets/:ticketId',
  PROFILE: '/admin/profile',

  // ---- utility ------------------------------------------------------------
  FORBIDDEN: '/admin/403',
  SHOWCASE: '/admin/showcase',
})

// Builders for the routes that carry a parameter. Keeping these beside the
// patterns means a renamed segment is a one-line change here, not a hunt
// through 40 screens for a template literal.
export const adminPath = Object.freeze({
  productDetail: (productId) => `/admin/catalog/products/${productId}`,
  orderDetail: (orderId) => `/admin/orders/detail/${orderId}`,
  subOrderDetail: (subOrderId) => `/admin/orders/sub-orders/${subOrderId}`,
  returnDetail: (returnId) => `/admin/orders/returns/${returnId}`,
  invoiceDetail: (invoiceId) => `/admin/orders/invoices/${invoiceId}`,
  supportTicketDetail: (ticketId) => `/admin/support/tickets/${ticketId}`,
  customerDetail: (customerId) => `/admin/people/customers/${customerId}`,
  sellerDetail: (sellerId) => `/admin/people/sellers/${sellerId}`,
  partnerDetail: (partnerId) => `/admin/people/partners/${partnerId}`,
  dropshipPartnerDetail: (partnerId) => `/admin/dropshipping/partners/${partnerId}`,
  kycReview: (applicationId) => `/admin/people/kyc/${applicationId}`,
  roleDetail: (roleId) => `/admin/people/roles/${roleId}`,
  settlementBatch: (batchId) => `/admin/finance/settlements/${batchId}`,
  vendorLedger: (vendorId) => `/admin/finance/vendor-ledger/${vendorId}`,
  reportRunner: (reportKey) => `/admin/reports/${reportKey}`,
  accountingTransaction: (transactionId) => `/admin/accounting/transactions/${transactionId}`,
  accountingSellerLedger: (sellerId) => `/admin/accounting/seller-ledger/${sellerId}`,
  accountingSettlement: (settlementId) => `/admin/accounting/settlements/${settlementId}`,
  accountingPayout: (payoutId) => `/admin/accounting/payouts/${payoutId}`,
  accountingReport: (reportKey) => `/admin/accounting/reports/${reportKey}`,
})

export const ROUTES = Object.freeze({
  HOME: '/',
  AUTH: AUTH_ROUTES,
  USER: USER_ROUTES,
  SELLER: SELLER_ROUTES,
  DROPSHIPPING_PARTNER: DROPSHIPPING_PARTNER_ROUTES,
  ADMIN: ADMIN_ROUTES,
})
