import { ADMIN_ROUTES, adminPath } from '../../../config/routes'

// An index of every screen, for a client walkthrough and for QA. Detail routes
// carry a parameter, so each one names a concrete record to open rather than
// leaving a ":productId" that goes nowhere.
export const SCREEN_GROUPS = Object.freeze([
  {
    label: 'Authentication',
    note: 'Outside the shell — the panel has its own sign-in, not the buyer OTP flow',
    screens: [
      { to: ADMIN_ROUTES.LOGIN, name: 'Sign in' },
      { to: ADMIN_ROUTES.TWO_FACTOR, name: 'Two-factor challenge' },
      { to: ADMIN_ROUTES.FORGOT_PASSWORD, name: 'Forgot password' },
      { to: ADMIN_ROUTES.RESET_PASSWORD, name: 'Reset password' },
      { to: ADMIN_ROUTES.LOCKED, name: 'Account locked' },
    ],
  },
  {
    label: 'Dashboard & analytics',
    screens: [
      { to: ADMIN_ROUTES.DASHBOARD, name: 'Dashboard' },
      { to: ADMIN_ROUTES.ANALYTICS_SALES, name: 'Sales analytics' },
      { to: ADMIN_ROUTES.ANALYTICS_VENDORS, name: 'Vendor performance' },
      { to: ADMIN_ROUTES.ANALYTICS_CATALOG, name: 'Catalog performance' },
      { to: ADMIN_ROUTES.ANALYTICS_CUSTOMERS, name: 'Customer insights' },
      { to: ADMIN_ROUTES.REVENUE, name: 'Revenue' },
    ],
  },
  {
    label: 'Catalog',
    screens: [
      { to: ADMIN_ROUTES.PRODUCTS, name: 'Products' },
      { to: ADMIN_ROUTES.PRODUCT_NEW, name: 'New product' },
      { to: adminPath.productDetail('prd-1'), name: 'Product detail' },
      { to: ADMIN_ROUTES.CATALOG_APPROVALS, name: 'Approval queue' },
      { to: ADMIN_ROUTES.CATEGORIES, name: 'Categories & brands' },
      { to: ADMIN_ROUTES.ATTRIBUTES, name: 'Attributes' },
      { to: ADMIN_ROUTES.INVENTORY, name: 'Inventory' },
      { to: ADMIN_ROUTES.SUPPLIER_SYNC, name: 'Supplier sync' },
    ],
  },
  {
    label: 'Orders & fulfilment',
    screens: [
      { to: ADMIN_ROUTES.ORDERS, name: 'Orders' },
      { to: adminPath.orderDetail('KZ-40128'), name: 'Order detail' },
      { to: ADMIN_ROUTES.CARRIER_SHIPMENTS, name: 'Shipments (AWB, pickup, RTO)' },
      { to: ADMIN_ROUTES.RETURNS, name: 'Returns' },
      { to: adminPath.returnDetail('ret-1'), name: 'Return review' },
      { to: ADMIN_ROUTES.INVOICES, name: 'Invoices' },
      { to: adminPath.invoiceDetail('inv-1'), name: 'Tax invoice' },
    ],
  },
  {
    label: 'People & vendors',
    screens: [
      { to: ADMIN_ROUTES.CUSTOMERS, name: 'Customers' },
      { to: ADMIN_ROUTES.B2B_BUYERS, name: 'B2B buyers' },
      { to: ADMIN_ROUTES.SELLERS, name: 'Sellers & partners' },
      { to: ADMIN_ROUTES.PARTNERS, name: 'Dropshipping partners' },
      { to: ADMIN_ROUTES.COMPANIES, name: 'Companies' },
      { to: ADMIN_ROUTES.CHANNEL_PARTNERS, name: 'Channel partners' },
      { to: ADMIN_ROUTES.KYC_QUEUE, name: 'KYC queue' },
      { to: adminPath.kycReview('kyc-2184'), name: 'KYC review' },
      { to: ADMIN_ROUTES.POLICY_ACCEPTANCES, name: 'Policy acceptances' },
      { to: ADMIN_ROUTES.USER_MANAGEMENT, name: 'Staff & roles' },
    ],
  },
  {
    label: 'Finance & accounting',
    screens: [
      { to: ADMIN_ROUTES.FINANCE_OVERVIEW, name: 'Finance overview' },
      { to: ADMIN_ROUTES.TRANSACTIONS, name: 'Transactions' },
      { to: ADMIN_ROUTES.REFUNDS, name: 'Refunds' },
      { to: ADMIN_ROUTES.SETTLEMENTS, name: 'Settlements' },
      { to: adminPath.settlementBatch('stl-1'), name: 'Batch approval' },
      { to: ADMIN_ROUTES.VENDOR_LEDGERS, name: 'Vendor ledgers' },
      { to: adminPath.vendorLedger('slr-2184'), name: 'Vendor statement' },
      { to: ADMIN_ROUTES.COMMISSION_RULES, name: 'Commission rules' },
      { to: ADMIN_ROUTES.PRICING_RULES, name: 'Pricing rules' },
      { to: ADMIN_ROUTES.CHART_OF_ACCOUNTS, name: 'Chart of accounts' },
      { to: ADMIN_ROUTES.JOURNAL_VOUCHERS, name: 'Journal vouchers' },
      { to: ADMIN_ROUTES.EXPENSES, name: 'Expenses' },
      { to: ADMIN_ROUTES.PNL, name: 'Profit & loss' },
      { to: ADMIN_ROUTES.BALANCE_SHEET, name: 'Balance sheet' },
      { to: ADMIN_ROUTES.TRIAL_BALANCE, name: 'Trial balance' },
      { to: ADMIN_ROUTES.CASH_FLOW, name: 'Cash flow' },
      { to: ADMIN_ROUTES.TAX_CENTER, name: 'Tax centre' },
    ],
  },
  {
    label: 'Marketing & reports',
    screens: [
      { to: ADMIN_ROUTES.COUPONS, name: 'Coupons' },
      { to: ADMIN_ROUTES.OFFERS, name: 'Offers' },
      { to: ADMIN_ROUTES.BANNERS, name: 'Banners' },
      { to: ADMIN_ROUTES.CMS_PAGES, name: 'CMS pages' },
      { to: ADMIN_ROUTES.CAMPAIGNS, name: 'Campaigns' },
      { to: ADMIN_ROUTES.TEMPLATES, name: 'Templates' },
      { to: ADMIN_ROUTES.REVIEWS, name: 'Review moderation' },
      { to: ADMIN_ROUTES.REPORTS, name: 'Report centre' },
      { to: adminPath.reportRunner('sales-summary'), name: 'Report runner' },
    ],
  },
  {
    label: 'Settings & system',
    screens: [
      { to: ADMIN_ROUTES.SETTINGS_GENERAL, name: 'General' },
      { to: ADMIN_ROUTES.SETTINGS_BUSINESS_RULES, name: 'Business rules' },
      { to: ADMIN_ROUTES.SETTINGS_TAXES, name: 'Taxes & HSN' },
      { to: ADMIN_ROUTES.SETTINGS_POLICIES, name: 'Policies' },
      { to: ADMIN_ROUTES.SETTINGS_PAYMENTS, name: 'Payments' },
      { to: ADMIN_ROUTES.SETTINGS_LOGISTICS, name: 'Logistics' },
      { to: ADMIN_ROUTES.SETTINGS_NOTIFICATIONS, name: 'Notifications' },
      { to: ADMIN_ROUTES.SETTINGS_INTEGRATIONS, name: 'Integration health' },
      { to: ADMIN_ROUTES.SETTINGS_SECURITY, name: 'Security' },
      { to: ADMIN_ROUTES.SETTINGS_API_WEBHOOKS, name: 'API keys & webhooks' },
      { to: ADMIN_ROUTES.AUDIT_LOGS, name: 'Audit log' },
      { to: ADMIN_ROUTES.BACKUPS, name: 'Backups' },
      { to: ADMIN_ROUTES.SUPPORT_TICKETS, name: 'Support tickets' },
      { to: ADMIN_ROUTES.PROFILE, name: 'My profile' },
    ],
  },
  {
    label: 'Utility',
    screens: [
      { to: ADMIN_ROUTES.FORBIDDEN, name: 'Forbidden (403)' },
      { to: '/admin/does-not-exist', name: 'Not found (404)' },
    ],
  },
])

export const SCREEN_COUNT = SCREEN_GROUPS.reduce((count, group) => count + group.screens.length, 0)
