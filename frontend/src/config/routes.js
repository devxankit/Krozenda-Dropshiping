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
  WALLET: '/app/wallet',
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
  LOGIN: '/partner/login',
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
  FORGOT_PASSWORD: '/admin/forgot-password',
  RESET_PASSWORD: '/admin/reset-password',
  LOCKED: '/admin/locked',

  // ---- dashboard & analytics ---------------------------------------------
  DASHBOARD: '/admin/dashboard',
  ANALYTICS_SALES: '/admin/analytics/sales',
  ANALYTICS_VENDORS: '/admin/analytics/vendors',
  ANALYTICS_CATALOG: '/admin/analytics/catalog',
  ANALYTICS_CUSTOMERS: '/admin/analytics/customers',
  REVENUE: '/admin/revenue',

  // ---- catalog ------------------------------------------------------------
  PRODUCTS: '/admin/catalog/products',
  PRODUCT_DETAIL: '/admin/catalog/products/:productId',
  CATALOG_APPROVALS: '/admin/catalog/approvals',
  CATEGORIES: '/admin/catalog/categories',
  BRANDS: '/admin/catalog/brands',
  INVENTORY: '/admin/catalog/inventory',

  // ---- orders & fulfilment ------------------------------------------------
  ORDERS: '/admin/orders',
  ORDER_DETAIL: '/admin/orders/detail/:orderId',
  CARRIER_SHIPMENTS: '/admin/orders/carrier-shipments',
  RETURNS: '/admin/orders/returns',
  RETURN_DETAIL: '/admin/orders/returns/:returnId',
  INVOICES: '/admin/orders/invoices',
  INVOICE_DETAIL: '/admin/orders/invoices/:invoiceId',

  // ---- people & vendors ---------------------------------------------------
  CUSTOMERS: '/admin/people/customers',
  CUSTOMER_DETAIL: '/admin/people/customers/:customerId',
  SELLERS: '/admin/people/sellers',
  SELLER_DETAIL: '/admin/people/sellers/:sellerId',
  KYC_QUEUE: '/admin/people/kyc',
  KYC_REVIEW: '/admin/people/kyc/:applicationId',
  USER_MANAGEMENT: '/admin/people/user-management',
  ROLES: '/admin/people/roles',

  // ---- finance ------------------------------------------------------------
  COMMISSION_RULES: '/admin/finance/commission-rules',

  // ---- accounts -----------------------------------------------------------
  ACCOUNTS_DASHBOARD: '/admin/accounts/dashboard',
  ACCOUNTS_PAYOUTS: '/admin/accounts/payouts',
  ACCOUNTS_TRANSACTIONS: '/admin/accounts/transactions',
  ACCOUNTS_LEDGER: '/admin/accounts/ledger',

  // ---- CJ Dropshipping (provider-specific, admin-only) --------------------
  CJ_DASHBOARD: '/admin/cj',
  CJ_SETTINGS: '/admin/cj/settings',
  CJ_CATALOGUE: '/admin/cj/catalogue',
  CJ_CATEGORY: '/admin/cj/category',
  CJ_PRODUCTS: '/admin/cj/products',
  CJ_PRODUCT_DETAIL: '/admin/cj/products/:productId',
  CJ_ORDERS: '/admin/cj/orders',
  CJ_SHIPMENTS: '/admin/cj/shipments',
  CJ_DISPUTES: '/admin/cj/disputes',
  CJ_SYNC_LOGS: '/admin/cj/sync-logs',

  // ---- marketing & content ------------------------------------------------
  COUPONS: '/admin/marketing/coupons',
  BANNERS: '/admin/marketing/banners',
  CMS_PAGES: '/admin/marketing/cms',
  CAMPAIGNS: '/admin/marketing/campaigns',
  REVIEWS: '/admin/marketing/reviews',

  // ---- reports ------------------------------------------------------------
  REPORTS: '/admin/reports',

  // ---- settings & system --------------------------------------------------
  SETTINGS_GENERAL: '/admin/settings/general',
  SETTINGS_BUSINESS_RULES: '/admin/settings/business-rules',
  SETTINGS_PAYMENTS: '/admin/settings/payments',
  SETTINGS_LOGISTICS: '/admin/settings/logistics',
  SETTINGS_TAXES: '/admin/settings/taxes',
  SETTINGS_SECURITY: '/admin/settings/security',
  SETTINGS_INTEGRATIONS: '/admin/settings/integrations',
  AUDIT_LOGS: '/admin/system/audit-logs',
  BACKUPS: '/admin/system/backups',
  SUPPORT_TICKETS: '/admin/support/tickets',
  SUPPORT_TICKET_DETAIL: '/admin/support/tickets/:ticketId',
  PROFILE: '/admin/profile',

  // ---- utility ------------------------------------------------------------
  FORBIDDEN: '/admin/403',
})

// Builders for the routes that carry a parameter. Keeping these beside the
// patterns means a renamed segment is a one-line change here, not a hunt
// through 40 screens for a template literal.
export const adminPath = Object.freeze({
  productDetail: (productId) => `/admin/catalog/products/${productId}`,
  orderDetail: (orderId) => `/admin/orders/detail/${orderId}`,
  returnDetail: (returnId) => `/admin/orders/returns/${returnId}`,
  invoiceDetail: (invoiceId) => `/admin/orders/invoices/${invoiceId}`,
  supportTicketDetail: (ticketId) => `/admin/support/tickets/${ticketId}`,
  customerDetail: (customerId) => `/admin/people/customers/${customerId}`,
  sellerDetail: (sellerId) => `/admin/people/sellers/${sellerId}`,
  cjProductDetail: (productId) => `/admin/cj/products/${productId}`,
  kycReview: (applicationId) => `/admin/people/kyc/${applicationId}`,
})

export const ROUTES = Object.freeze({
  HOME: '/',
  AUTH: AUTH_ROUTES,
  USER: USER_ROUTES,
  SELLER: SELLER_ROUTES,
  DROPSHIPPING_PARTNER: DROPSHIPPING_PARTNER_ROUTES,
  ADMIN: ADMIN_ROUTES,
})
