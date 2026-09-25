// Module-local constants for the admin panel. Cross-cutting constants
// (roles, order statuses, business models) live in src/config/constants.js
// and are imported here rather than re-typed.
//
// Rule: status -> tone, status -> label and nav structure are DATA. No screen
// may inline a ternary over a status string; it looks up one of these maps.

import { ADMIN_ROUTES } from '../../config/routes'
import {
  BUSINESS_MODEL,
  ORDER_STATUS,
  ORDER_STATUS_EXCEPTION,
} from '../../config/constants'

// ---------------------------------------------------------------------------
// Permissions
// Permissions are data on the server (project context §2). These keys are the
// contract the UI reads; the seed list below documents which role gets what,
// including the Accountant and CA/Auditor roles the billing specification
// requires (§6 of that document).
// ---------------------------------------------------------------------------
export const ADMIN_PERMISSIONS = Object.freeze({
  ACCESS: 'admin.access',

  // Overview
  DASHBOARD_VIEW: 'admin.dashboard.view',
  ANALYTICS_VIEW: 'admin.analytics.view',

  // Catalog
  CATALOG_VIEW: 'admin.catalog.view',
  CATALOG_MANAGE: 'admin.catalog.manage',
  CATALOG_APPROVE: 'admin.catalog.approve',
  CATALOG_PRODUCTS: 'admin.catalog.products',
  CATALOG_CATEGORIES: 'admin.catalog.categories',
  CATALOG_INVENTORY: 'admin.catalog.inventory',
  CATALOG_SUPPLIER_SYNC: 'admin.catalog.supplier_sync',

  // Sales / Orders
  ORDERS_VIEW: 'admin.orders.view',
  ORDERS_MANAGE: 'admin.orders.manage',
  ORDERS_CANCEL: 'admin.orders.cancel',
  ORDERS_LIST: 'admin.orders.list',
  ORDERS_SUB_ORDERS: 'admin.orders.sub_orders',
  ORDERS_SHIPMENTS: 'admin.orders.shipments',
  ORDERS_INVOICES: 'admin.orders.invoices',
  RETURNS_MANAGE: 'admin.returns.manage',

  // Dropshipping
  DROPSHIP_VIEW: 'admin.dropship.view',
  DROPSHIP_MANAGE: 'admin.dropship.manage',
  DROPSHIP_OVERVIEW: 'admin.dropship.overview',
  DROPSHIP_PARTNERS: 'admin.dropship.partners',
  DROPSHIP_PRODUCTS: 'admin.dropship.products',
  DROPSHIP_ORDERS: 'admin.dropship.orders',
  DROPSHIP_SUPPLIER_SYNC: 'admin.dropship.supplier_sync',
  DROPSHIP_MARGINS: 'admin.dropship.margins',

  // CJ Dropshipping (provider-specific — distinct from the generic
  // admin.dropship.* partner module above)
  CJ_VIEW: 'admin.cj.view',
  CJ_SETTINGS: 'admin.cj.settings',
  CJ_CATALOGUE: 'admin.cj.catalogue',
  CJ_PRODUCTS: 'admin.cj.products',
  CJ_ORDERS: 'admin.cj.orders',
  CJ_SHIPMENTS: 'admin.cj.shipments',
  CJ_RETURNS: 'admin.cj.returns',
  CJ_REFUNDS: 'admin.cj.refunds',
  CJ_SYNC: 'admin.cj.sync',

  // Network
  PEOPLE_VIEW: 'admin.people.view',
  PEOPLE_MANAGE: 'admin.people.manage',
  PEOPLE_SELLERS: 'admin.people.sellers',
  PEOPLE_CUSTOMERS: 'admin.people.customers',
  PEOPLE_SUPPORT: 'admin.people.support',
  KYC_REVIEW: 'admin.kyc.review',
  ROLES_MANAGE: 'admin.roles.manage',
  USER_MANAGEMENT: 'admin.users.manage',

  // Finance
  FINANCE_VIEW: 'admin.finance.view',
  FINANCE_MANAGE: 'admin.finance.manage',
  FINANCE_OVERVIEW: 'admin.finance.overview',
  FINANCE_SETTLEMENTS: 'admin.finance.settlements',
  FINANCE_RULES: 'admin.finance.rules',
  PAYOUT_PREPARE: 'admin.payout.prepare',
  PAYOUT_APPROVE: 'admin.payout.approve',
  ACCOUNTING_VIEW: 'admin.accounting.view',
  ACCOUNTING_POST: 'admin.accounting.post',
  // Accounting module. One key per surface, so a CA/auditor who reads
  // everything is a genuinely different role from whoever releases a payout.
  // Mirrors backend/Config/permissions.js — keep the two in sync.
  ACCOUNTING_TRANSACTIONS_VIEW: 'admin.accounting.transactions.view',
  ACCOUNTING_LEDGER_VIEW: 'admin.accounting.ledger.view',
  ACCOUNTING_COMMISSION_VIEW: 'admin.accounting.commission.view',
  ACCOUNTING_COMMISSION_MANAGE: 'admin.accounting.commission.manage',
  ACCOUNTING_SETTLEMENT_VIEW: 'admin.accounting.settlement.view',
  ACCOUNTING_SETTLEMENT_MANAGE: 'admin.accounting.settlement.manage',
  ACCOUNTING_PAYOUT_VIEW: 'admin.accounting.payout.view',
  ACCOUNTING_PAYOUT_MANAGE: 'admin.accounting.payout.manage',
  ACCOUNTING_REFUND_VIEW: 'admin.accounting.refund.view',
  ACCOUNTING_REFUND_MANAGE: 'admin.accounting.refund.manage',
  ACCOUNTING_REPORT_VIEW: 'admin.accounting.report.view',
  ACCOUNTING_REPORT_EXPORT: 'admin.accounting.report.export',
  TAX_EXPORT: 'admin.tax.export',

  // Marketing
  MARKETING_VIEW: 'admin.marketing.view',
  MARKETING_MANAGE: 'admin.marketing.manage',
  MARKETING_COUPONS: 'admin.marketing.coupons',
  MARKETING_BANNERS: 'admin.marketing.banners',
  MARKETING_NOTIFICATIONS: 'admin.marketing.notifications',
  MARKETING_REVIEWS: 'admin.marketing.reviews',

  // Insight
  REPORTS_VIEW: 'admin.reports.view',

  // System
  SETTINGS_VIEW: 'admin.settings.view',
  SETTINGS_MANAGE: 'admin.settings.manage',
  AUDIT_VIEW: 'admin.audit.view',
  SYSTEM_MANAGE: 'admin.system.manage',
})

export const ALL_ADMIN_PERMISSIONS = Object.freeze(Object.values(ADMIN_PERMISSIONS))

// The finance role matrix from the billing specification, expressed as data.
// A Finance Manager prepares payout drafts but cannot approve them; an
// auditor reads everything in finance and touches nothing else.
export const ADMIN_ROLE_PRESETS = Object.freeze({
  super_admin: ALL_ADMIN_PERMISSIONS,
  finance_manager: Object.freeze([
    ADMIN_PERMISSIONS.ACCESS,
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.FINANCE_VIEW,
    ADMIN_PERMISSIONS.FINANCE_MANAGE,
    ADMIN_PERMISSIONS.PAYOUT_PREPARE,
    ADMIN_PERMISSIONS.ACCOUNTING_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_POST,
    ADMIN_PERMISSIONS.ACCOUNTING_TRANSACTIONS_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_LEDGER_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE,
    ADMIN_PERMISSIONS.ACCOUNTING_SETTLEMENT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_SETTLEMENT_MANAGE,
    ADMIN_PERMISSIONS.ACCOUNTING_PAYOUT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REFUND_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REFUND_MANAGE,
    ADMIN_PERMISSIONS.ACCOUNTING_REPORT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REPORT_EXPORT,
    ADMIN_PERMISSIONS.TAX_EXPORT,
    ADMIN_PERMISSIONS.REPORTS_VIEW,
  ]),
  // Deliberately without PAYOUT_MANAGE: a finance manager prepares and
  // settles, but releasing money to a seller is a separate hand.
  ca_auditor: Object.freeze([
    ADMIN_PERMISSIONS.ACCESS,
    ADMIN_PERMISSIONS.FINANCE_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_TRANSACTIONS_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_LEDGER_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_SETTLEMENT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_PAYOUT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REFUND_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REPORT_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_REPORT_EXPORT,
    ADMIN_PERMISSIONS.TAX_EXPORT,
    ADMIN_PERMISSIONS.REPORTS_VIEW,
  ]),
  operations: Object.freeze([
    ADMIN_PERMISSIONS.ACCESS,
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.ANALYTICS_VIEW,
    ADMIN_PERMISSIONS.CATALOG_VIEW,
    ADMIN_PERMISSIONS.CATALOG_MANAGE,
    ADMIN_PERMISSIONS.CATALOG_APPROVE,
    ADMIN_PERMISSIONS.ORDERS_VIEW,
    ADMIN_PERMISSIONS.ORDERS_MANAGE,
    ADMIN_PERMISSIONS.ORDERS_CANCEL,
    ADMIN_PERMISSIONS.RETURNS_MANAGE,
    ADMIN_PERMISSIONS.PEOPLE_VIEW,
    ADMIN_PERMISSIONS.KYC_REVIEW,
    ADMIN_PERMISSIONS.REPORTS_VIEW,
  ]),
})

// ---------------------------------------------------------------------------
// Navigation
// The sidebar, the breadcrumb trail and the command palette all read this one
// tree. Adding a screen means adding an entry here — never editing three
// separate lists.
//
// `badge` names a counter the shell resolves from the action-queue query;
// it is a key, not a number, so the nav definition stays static.
// ---------------------------------------------------------------------------
export const NAV_TREE = Object.freeze([
  {
    id: 'overview',
    label: null,
    items: [
      {
        label: 'Dashboard',
        to: ADMIN_ROUTES.DASHBOARD,
        icon: 'dashboard',
        permission: ADMIN_PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Analytics',
        to: ADMIN_ROUTES.ANALYTICS_SALES,
        icon: 'analytics',
        permission: ADMIN_PERMISSIONS.ANALYTICS_VIEW,
        match: '/admin/analytics',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Own Stock',
    items: [
      {
        label: 'Products',
        to: ADMIN_ROUTES.PRODUCTS,
        ownStockModule: true,
        icon: 'products',
        permission: ADMIN_PERMISSIONS.CATALOG_PRODUCTS,
        legacyPermission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Categories',
        to: ADMIN_ROUTES.CATEGORIES,
        ownStockModule: true,
        icon: 'categories',
        permission: ADMIN_PERMISSIONS.CATALOG_CATEGORIES,
        legacyPermission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Brands',
        to: ADMIN_ROUTES.BRANDS,
        ownStockModule: true,
        icon: 'brands',
        permission: ADMIN_PERMISSIONS.CATALOG_CATEGORIES,
        legacyPermission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Inventory',
        to: ADMIN_ROUTES.INVENTORY,
        ownStockModule: true,
        icon: 'inventory',
        permission: ADMIN_PERMISSIONS.CATALOG_INVENTORY,
        legacyPermission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      {
        label: 'Orders',
        to: ADMIN_ROUTES.ORDERS,
        icon: 'orders',
        permission: ADMIN_PERMISSIONS.ORDERS_LIST,
        legacyPermission: ADMIN_PERMISSIONS.ORDERS_VIEW,
        match: '/admin/orders/detail',
      },
      {
        label: 'Returns & RTO',
        to: ADMIN_ROUTES.RETURNS,
        icon: 'returns',
        permission: ADMIN_PERMISSIONS.RETURNS_MANAGE,
        badge: 'openReturns',
        badgeTone: 'danger',
      },
      {
        label: 'Invoices',
        to: ADMIN_ROUTES.INVOICES,
        icon: 'invoices',
        permission: ADMIN_PERMISSIONS.ORDERS_INVOICES,
        legacyPermission: ADMIN_PERMISSIONS.ORDERS_VIEW,
      },
    ],
  },
  {
    // Section heading "Dropshipping"; `submenu` renders the items nested under
    // one collapsible "CJ Dropshipping" parent. Items stay a flat list so the
    // permission picker, breadcrumb and command palette read them unchanged.
    id: 'cj-dropshipping',
    label: 'Dropshipping',
    submenu: { label: 'CJ Dropshipping', icon: 'dropshipping' },
    items: [
      {
        label: 'Dashboard',
        to: ADMIN_ROUTES.CJ_DASHBOARD,
        icon: 'dashboard',
        permission: ADMIN_PERMISSIONS.CJ_VIEW,
        exact: true,
      },
      {
        label: 'Category',
        to: ADMIN_ROUTES.CJ_CATEGORY,
        icon: 'catalog',
        permission: ADMIN_PERMISSIONS.CJ_PRODUCTS,
      },
      {
        label: 'Products',
        to: ADMIN_ROUTES.CJ_PRODUCTS,
        icon: 'products',
        permission: ADMIN_PERMISSIONS.CJ_PRODUCTS,
      },
      {
        label: 'Orders',
        to: ADMIN_ROUTES.CJ_ORDERS,
        icon: 'orders',
        permission: ADMIN_PERMISSIONS.CJ_ORDERS,
      },
      {
        label: 'Shipments',
        to: ADMIN_ROUTES.CJ_SHIPMENTS,
        icon: 'shipments',
        permission: ADMIN_PERMISSIONS.CJ_SHIPMENTS,
        legacyPermission: ADMIN_PERMISSIONS.CJ_VIEW,
      },
      {
        label: 'Disputes',
        to: ADMIN_ROUTES.CJ_DISPUTES,
        icon: 'flag',
        permission: ADMIN_PERMISSIONS.CJ_RETURNS,
        legacyPermission: ADMIN_PERMISSIONS.CJ_VIEW,
      },
      {
        label: 'Sync Logs',
        to: ADMIN_ROUTES.CJ_SYNC_LOGS,
        icon: 'activity',
        permission: ADMIN_PERMISSIONS.CJ_SYNC,
        legacyPermission: ADMIN_PERMISSIONS.CJ_VIEW,
      },
      {
        // Live CJ search + select-to-onboard flow. Same screen and route as
        // before (CjCataloguePage) — only the label changed, to say what an
        // admin actually uses it for.
        label: 'Onboard Products',
        to: ADMIN_ROUTES.CJ_CATALOGUE,
        icon: 'add',
        permission: ADMIN_PERMISSIONS.CJ_CATALOGUE,
      },
      {
        label: 'Settings',
        to: ADMIN_ROUTES.CJ_SETTINGS,
        icon: 'key',
        permission: ADMIN_PERMISSIONS.CJ_SETTINGS,
        legacyPermission: ADMIN_PERMISSIONS.CJ_VIEW,
      },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    items: [
      {
        label: 'Sellers & partners',
        to: ADMIN_ROUTES.SELLERS,
        icon: 'sellers',
        permission: ADMIN_PERMISSIONS.PEOPLE_SELLERS,
        legacyPermission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
      },
      {
        label: 'Approvals',
        to: ADMIN_ROUTES.CATALOG_APPROVALS,
        icon: 'approvals',
        permission: ADMIN_PERMISSIONS.CATALOG_APPROVE,
        badge: 'productApprovals',
        badgeTone: 'warning',
      },
      {
        label: 'Customers',
        to: ADMIN_ROUTES.CUSTOMERS,
        icon: 'customers',
        permission: ADMIN_PERMISSIONS.PEOPLE_CUSTOMERS,
        legacyPermission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
      },
      {
        label: 'KYC review',
        to: ADMIN_ROUTES.KYC_QUEUE,
        icon: 'kyc',
        permission: ADMIN_PERMISSIONS.KYC_REVIEW,
        badge: 'pendingKyc',
        badgeTone: 'warning',
      },
      {
        label: 'Roles',
        to: ADMIN_ROUTES.ROLES,
        icon: 'roles',
        permission: ADMIN_PERMISSIONS.ROLES_MANAGE,
        adminOnly: true,
      },
      {
        label: 'User Management',
        to: ADMIN_ROUTES.USER_MANAGEMENT,
        icon: 'staff',
        permission: ADMIN_PERMISSIONS.USER_MANAGEMENT,
        adminOnly: true,
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      {
        label: 'Coupons & offers',
        to: ADMIN_ROUTES.COUPONS,
        icon: 'marketing',
        permission: ADMIN_PERMISSIONS.MARKETING_COUPONS,
        legacyPermission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
      {
        label: 'Banners',
        to: ADMIN_ROUTES.BANNERS,
        icon: 'banners',
        permission: ADMIN_PERMISSIONS.MARKETING_BANNERS,
        legacyPermission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
      {
        label: 'CMS pages',
        to: ADMIN_ROUTES.CMS_PAGES,
        icon: 'cms',
        permission: ADMIN_PERMISSIONS.MARKETING_BANNERS,
        legacyPermission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
      {
        label: 'Notifications',
        to: ADMIN_ROUTES.CAMPAIGNS,
        icon: 'campaigns',
        permission: ADMIN_PERMISSIONS.MARKETING_NOTIFICATIONS,
        legacyPermission: ADMIN_PERMISSIONS.MARKETING_MANAGE,
      },
      {
        label: 'Reviews',
        to: ADMIN_ROUTES.REVIEWS,
        icon: 'reviews',
        permission: ADMIN_PERMISSIONS.MARKETING_REVIEWS,
        legacyPermission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
    ],
  },
  // Finance and Accounting nav groups intentionally removed from the sidebar
  // (routes/pages/services/permissions kept in code, just not linked here).
  //
  // "Accounts" below is a separate, deliberately minimal MVP (not the
  // Accounting module above) — see backend/Controllers/accountsController.js.
  {
    id: 'accounts',
    label: 'Accounts',
    items: [
      {
        label: 'Dashboard',
        to: ADMIN_ROUTES.ACCOUNTS_DASHBOARD,
        icon: 'money',
      },
      {
        label: 'Vendor Payouts',
        to: ADMIN_ROUTES.ACCOUNTS_PAYOUTS,
        icon: 'settlements',
      },
      {
        label: 'Transactions',
        to: ADMIN_ROUTES.ACCOUNTS_TRANSACTIONS,
        icon: 'ledger',
      },
      {
        label: 'Ledger',
        to: ADMIN_ROUTES.ACCOUNTS_LEDGER,
        icon: 'reports',
      },
    ],
  },
  {
    id: 'insight',
    label: 'Insight',
    items: [
      {
        label: 'Reports',
        to: ADMIN_ROUTES.REPORTS,
        icon: 'reports',
        permission: ADMIN_PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: 'Support tickets',
        to: ADMIN_ROUTES.SUPPORT_TICKETS,
        icon: 'support',
        permission: ADMIN_PERMISSIONS.PEOPLE_SUPPORT,
        legacyPermission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        label: 'Settings',
        to: ADMIN_ROUTES.SETTINGS_GENERAL,
        icon: 'settings',
        permission: ADMIN_PERMISSIONS.SETTINGS_VIEW,
        match: '/admin/settings',
      },
      {
        label: 'Audit log',
        to: ADMIN_ROUTES.AUDIT_LOGS,
        icon: 'audit',
        permission: ADMIN_PERMISSIONS.AUDIT_VIEW,
      },
      {
        label: 'Backups',
        to: ADMIN_ROUTES.BACKUPS,
        icon: 'backups',
        permission: ADMIN_PERMISSIONS.SYSTEM_MANAGE,
      },
    ],
  },
])

// Sub-navigation for the settings shell — a second level that would clutter
// the sidebar but has to live somewhere structured.
// Trimmed to what the platform actually needs day to day — profile and
// password live on the profile page, so this is just the business-critical
// settings (commission, GST) plus the identity fields invoices need.
export const SETTINGS_NAV = Object.freeze([
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'General', to: ADMIN_ROUTES.SETTINGS_GENERAL },
      { label: 'Payments', to: ADMIN_ROUTES.SETTINGS_PAYMENTS },
      { label: 'Security', to: ADMIN_ROUTES.SETTINGS_SECURITY },
      { label: 'Commission & business rules', to: ADMIN_ROUTES.SETTINGS_BUSINESS_RULES },
      { label: 'Taxes & GST', to: ADMIN_ROUTES.SETTINGS_TAXES },
    ],
  },
])

// ---------------------------------------------------------------------------
// Status vocabularies
// ---------------------------------------------------------------------------

// Every value in config/constants.js ORDER_STATUS and ORDER_STATUS_EXCEPTION
// has an entry. A status with no tone here is a bug, not a default.
// CJ Dropshipping's own internal statuses (backend/services/cj/cjStatusMapper.js
// and CjOrder/CjShipment/CjDispute models) — never the raw CJ string.
export const CJ_ORDER_STATUS_TONE = Object.freeze({
  PENDING_PAYMENT: 'neutral',
  CONFIRMED: 'brand',
  PROCESSING: 'brand',
  SHIPPED: 'brand',
  IN_TRANSIT: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  FULFILLMENT_FAILED: 'danger',
})

export const CJ_SHIPMENT_STATUS_TONE = Object.freeze({
  PROCESSING: 'neutral',
  SHIPPED: 'brand',
  IN_TRANSIT: 'brand',
  OUT_FOR_DELIVERY: 'brand',
  DELIVERED: 'success',
  DELIVERY_FAILED: 'danger',
  RTO: 'warning',
})

export const CJ_DISPUTE_STATUS_TONE = Object.freeze({
  CREATED: 'neutral',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
})

export const CJ_SYNC_STATUS_TONE = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'danger',
})

export const ORDER_STATUS_TONE = Object.freeze({
  [ORDER_STATUS.PLACED]: 'neutral',
  [ORDER_STATUS.PAYMENT_VERIFIED]: 'brand',
  [ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR]: 'neutral',
  [ORDER_STATUS.VENDOR_ACCEPTED]: 'brand',
  [ORDER_STATUS.PACKED]: 'brand',
  [ORDER_STATUS.AWB_GENERATED]: 'brand',
  [ORDER_STATUS.SHIPPED]: 'brand',
  [ORDER_STATUS.IN_TRANSIT]: 'brand',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.SETTLEMENT_ELIGIBLE]: 'accent',
  [ORDER_STATUS.SETTLED]: 'success',
  [ORDER_STATUS_EXCEPTION.VENDOR_REJECTED]: 'danger',
  [ORDER_STATUS_EXCEPTION.CANCELLED_BUYER]: 'danger',
  [ORDER_STATUS_EXCEPTION.CANCELLED_ADMIN]: 'danger',
  [ORDER_STATUS_EXCEPTION.RTO_INITIATED]: 'warning',
  [ORDER_STATUS_EXCEPTION.RTO_DELIVERED]: 'warning',
  [ORDER_STATUS_EXCEPTION.RETURN_REQUESTED]: 'warning',
  [ORDER_STATUS_EXCEPTION.REPLACEMENT_ISSUED]: 'accent',
})

// A PARENT order has no status of its own — it has N sub-orders that each
// carry one. These are the derived roll-ups the orders list shows, and the
// "partly" values are the whole point: a cart split across three vendors is
// routinely half shipped and half waiting.
export const FULFILMENT_STATUS = Object.freeze({
  AWAITING_VENDOR: 'awaiting_vendor',
  PARTLY_PACKED: 'partly_packed',
  PACKED: 'packed',
  PARTLY_SHIPPED: 'partly_shipped',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  PARTLY_DELIVERED: 'partly_delivered',
  DELIVERED: 'delivered',
  RTO: 'rto',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
})

export const FULFILMENT_STATUS_LABELS = Object.freeze({
  [FULFILMENT_STATUS.AWAITING_VENDOR]: 'Awaiting vendor',
  [FULFILMENT_STATUS.PARTLY_PACKED]: 'Partly packed',
  [FULFILMENT_STATUS.PACKED]: 'Packed',
  [FULFILMENT_STATUS.PARTLY_SHIPPED]: 'Partly shipped',
  [FULFILMENT_STATUS.SHIPPED]: 'Shipped',
  [FULFILMENT_STATUS.IN_TRANSIT]: 'In transit',
  [FULFILMENT_STATUS.PARTLY_DELIVERED]: 'Partly delivered',
  [FULFILMENT_STATUS.DELIVERED]: 'Delivered',
  [FULFILMENT_STATUS.RTO]: 'RTO initiated',
  [FULFILMENT_STATUS.RETURNED]: 'Returned',
  [FULFILMENT_STATUS.CANCELLED]: 'Cancelled',
})

export const FULFILMENT_STATUS_TONE = Object.freeze({
  [FULFILMENT_STATUS.AWAITING_VENDOR]: 'neutral',
  [FULFILMENT_STATUS.PARTLY_PACKED]: 'neutral',
  [FULFILMENT_STATUS.PACKED]: 'brand',
  [FULFILMENT_STATUS.PARTLY_SHIPPED]: 'brand',
  [FULFILMENT_STATUS.SHIPPED]: 'brand',
  [FULFILMENT_STATUS.IN_TRANSIT]: 'brand',
  [FULFILMENT_STATUS.PARTLY_DELIVERED]: 'accent',
  [FULFILMENT_STATUS.DELIVERED]: 'success',
  [FULFILMENT_STATUS.RTO]: 'warning',
  [FULFILMENT_STATUS.RETURNED]: 'warning',
  [FULFILMENT_STATUS.CANCELLED]: 'danger',
})

export const BUYER_TYPE_LABELS = Object.freeze({
  retail: 'Retail',
  b2b_dealer: 'B2B dealer',
  b2b_distributor: 'B2B distributor',
  b2b_wholesaler: 'B2B wholesaler',
  b2b_trader: 'B2B trader',
})

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  AUTHORISED: 'authorised',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
})

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.PENDING]: 'Pending',
  [PAYMENT_STATUS.AUTHORISED]: 'Authorised',
  [PAYMENT_STATUS.CAPTURED]: 'Captured',
  [PAYMENT_STATUS.FAILED]: 'Failed',
  [PAYMENT_STATUS.REFUND_PENDING]: 'Refund pending',
  [PAYMENT_STATUS.REFUNDED]: 'Refunded',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'Partly refunded',
})

export const PAYMENT_STATUS_TONE = Object.freeze({
  [PAYMENT_STATUS.PENDING]: 'neutral',
  [PAYMENT_STATUS.AUTHORISED]: 'brand',
  [PAYMENT_STATUS.CAPTURED]: 'success',
  [PAYMENT_STATUS.FAILED]: 'danger',
  [PAYMENT_STATUS.REFUND_PENDING]: 'warning',
  [PAYMENT_STATUS.REFUNDED]: 'neutral',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'warning',
})

export const REVIEW_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
  NOT_APPLICABLE: 'not_applicable',
})

export const REVIEW_STATUS_LABELS = Object.freeze({
  [REVIEW_STATUS.DRAFT]: 'Draft',
  [REVIEW_STATUS.SUBMITTED]: 'Submitted',
  [REVIEW_STATUS.REVIEWING]: 'Reviewing',
  [REVIEW_STATUS.APPROVED]: 'Approved',
  [REVIEW_STATUS.REJECTED]: 'Rejected',
  [REVIEW_STATUS.CHANGES_REQUESTED]: 'Changes requested',
  [REVIEW_STATUS.NOT_APPLICABLE]: 'Not applicable',
})

export const REVIEW_STATUS_TONE = Object.freeze({
  [REVIEW_STATUS.DRAFT]: 'neutral',
  [REVIEW_STATUS.SUBMITTED]: 'brand',
  [REVIEW_STATUS.REVIEWING]: 'warning',
  [REVIEW_STATUS.APPROVED]: 'success',
  [REVIEW_STATUS.REJECTED]: 'danger',
  [REVIEW_STATUS.CHANGES_REQUESTED]: 'warning',
  [REVIEW_STATUS.NOT_APPLICABLE]: 'neutral',
})

export const SETTLEMENT_STATUS = Object.freeze({
  LOCKED_IN_HOLD: 'locked_in_hold',
  ELIGIBLE: 'eligible',
  DRAFTED: 'drafted',
  AWAITING_APPROVAL: 'awaiting_approval',
  PROCESSING: 'processing',
  SETTLED: 'settled',
  FAILED: 'failed',
  REVERSED: 'reversed',
})

export const SETTLEMENT_STATUS_LABELS = Object.freeze({
  [SETTLEMENT_STATUS.LOCKED_IN_HOLD]: 'In hold',
  [SETTLEMENT_STATUS.ELIGIBLE]: 'Eligible',
  [SETTLEMENT_STATUS.DRAFTED]: 'Draft batch',
  [SETTLEMENT_STATUS.AWAITING_APPROVAL]: 'Awaiting approval',
  [SETTLEMENT_STATUS.PROCESSING]: 'Processing',
  [SETTLEMENT_STATUS.SETTLED]: 'Settled',
  [SETTLEMENT_STATUS.FAILED]: 'Failed',
  [SETTLEMENT_STATUS.REVERSED]: 'Reversed',
})

export const SETTLEMENT_STATUS_TONE = Object.freeze({
  [SETTLEMENT_STATUS.LOCKED_IN_HOLD]: 'neutral',
  [SETTLEMENT_STATUS.ELIGIBLE]: 'brand',
  [SETTLEMENT_STATUS.DRAFTED]: 'neutral',
  [SETTLEMENT_STATUS.AWAITING_APPROVAL]: 'warning',
  [SETTLEMENT_STATUS.PROCESSING]: 'brand',
  [SETTLEMENT_STATUS.SETTLED]: 'success',
  [SETTLEMENT_STATUS.FAILED]: 'danger',
  [SETTLEMENT_STATUS.REVERSED]: 'danger',
})

// ---------------------------------------------------------------------------
// Accounting (real backend — see backend/Models/AccountingTransaction.js).
// Money in this module is INTEGER PAISE end to end: the ledger stores paise,
// the API returns paise, formatMoney renders paise. Nothing converts on the
// way through, so nothing can round twice.
// ---------------------------------------------------------------------------

export const ACCOUNTING_TXN_TYPE = Object.freeze({
  SALE: 'SALE',
  COMMISSION: 'COMMISSION',
  PAYMENT_GATEWAY_FEE: 'PAYMENT_GATEWAY_FEE',
  SHIPPING_CHARGE: 'SHIPPING_CHARGE',
  REFUND: 'REFUND',
  REFUND_REVERSAL: 'REFUND_REVERSAL',
  PAYOUT: 'PAYOUT',
  ADJUSTMENT: 'ADJUSTMENT',
})

export const ACCOUNTING_TXN_TYPE_LABELS = Object.freeze({
  [ACCOUNTING_TXN_TYPE.SALE]: 'Sale',
  [ACCOUNTING_TXN_TYPE.COMMISSION]: 'Commission',
  [ACCOUNTING_TXN_TYPE.PAYMENT_GATEWAY_FEE]: 'Gateway fee',
  [ACCOUNTING_TXN_TYPE.SHIPPING_CHARGE]: 'Shipping',
  [ACCOUNTING_TXN_TYPE.REFUND]: 'Refund',
  [ACCOUNTING_TXN_TYPE.REFUND_REVERSAL]: 'Refund reversal',
  [ACCOUNTING_TXN_TYPE.PAYOUT]: 'Payout',
  [ACCOUNTING_TXN_TYPE.ADJUSTMENT]: 'Adjustment',
})

export const ACCOUNTING_TXN_TYPE_TONE = Object.freeze({
  [ACCOUNTING_TXN_TYPE.SALE]: 'success',
  [ACCOUNTING_TXN_TYPE.COMMISSION]: 'brand',
  [ACCOUNTING_TXN_TYPE.PAYMENT_GATEWAY_FEE]: 'neutral',
  [ACCOUNTING_TXN_TYPE.SHIPPING_CHARGE]: 'neutral',
  [ACCOUNTING_TXN_TYPE.REFUND]: 'danger',
  [ACCOUNTING_TXN_TYPE.REFUND_REVERSAL]: 'warning',
  [ACCOUNTING_TXN_TYPE.PAYOUT]: 'accent',
  [ACCOUNTING_TXN_TYPE.ADJUSTMENT]: 'warning',
})

export const ACCOUNTING_TXN_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  REVERSED: 'Reversed',
  FAILED: 'Failed',
})

export const ACCOUNTING_TXN_STATUS_TONE = Object.freeze({
  PENDING: 'warning',
  COMPLETED: 'success',
  REVERSED: 'neutral',
  FAILED: 'danger',
})

export const ACCOUNTING_SETTLEMENT_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  ELIGIBLE: 'Eligible',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  // Batches drafted before the Accounting module shipped still carry these.
  AWAITING_APPROVAL: 'Eligible',
  SETTLED: 'Completed',
})

export const ACCOUNTING_SETTLEMENT_STATUS_TONE = Object.freeze({
  PENDING: 'neutral',
  ELIGIBLE: 'brand',
  PROCESSING: 'accent',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  AWAITING_APPROVAL: 'brand',
  SETTLED: 'success',
})

export const PAYOUT_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  // RELEASED: release requested from Razorpay Route, awaiting the webhook
  // that confirms the transfer actually settled — a distinct in-flight state
  // from PROCESSING (which is the pre-transfer manual-payout state).
  RELEASED: 'Release requested',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
})

export const PAYOUT_STATUS_TONE = Object.freeze({
  PENDING: 'neutral',
  PROCESSING: 'brand',
  RELEASED: 'accent',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
})

// Payout.method — see backend/Models/Payout.js. RAZORPAY_ROUTE is the
// automated seller-settlement path; the others are manual/legacy entries an
// operator typed in themselves.
export const PAYOUT_METHOD_LABELS = Object.freeze({
  RAZORPAY_ROUTE: 'Razorpay Route',
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  MANUAL: 'Manual',
  CHEQUE: 'Cheque',
})

export const PAYOUT_METHOD_TONE = Object.freeze({
  RAZORPAY_ROUTE: 'accent',
})

// Settlement.holdReason — free text for older holds, but the automation puts
// one of these fixed codes on a hold it created itself. Anything not in this
// map (an older, hand-typed reason) is shown as-is.
export const SETTLEMENT_HOLD_REASON_LABELS = Object.freeze({
  VENDOR_RAZORPAY_NOT_ACTIVE: "Seller's Razorpay account is not active",
  ACTIVE_RETURN_OR_REFUND: 'An order in this settlement has an active return or refund',
  AMOUNT_MISMATCH: 'Computed payable does not match the amount on file',
  NO_RAZORPAY_PAYMENT_TO_TRANSFER_AGAINST: 'No matching Razorpay payment to transfer against',
  MULTI_ORDER_SETTLEMENT_UNSUPPORTED: 'Settlement spans multiple orders — not yet supported for auto-transfer',
  REFUND_AFTER_SETTLEMENT_GENERATED_NEEDS_REGEN: 'A refund landed after this settlement was generated — needs regeneration',
  REFUND_BEFORE_RELEASE_REVERSAL_FAILED_MANUAL_RECONCILIATION:
    'A pre-release refund reversal failed — needs manual reconciliation',
})

// backend/Models/Vendor.js razorpay.onboardingStatus
export const RAZORPAY_ONBOARDING_STATUS_OPTIONS = Object.freeze([
  'NOT_STARTED',
  'PENDING',
  'ONBOARDING',
  'KYC_PENDING',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
])

export const RAZORPAY_ONBOARDING_STATUS_LABELS = Object.freeze({
  NOT_STARTED: 'Not started',
  PENDING: 'Pending',
  ONBOARDING: 'Onboarding',
  KYC_PENDING: 'KYC pending',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
})

export const RAZORPAY_ONBOARDING_STATUS_TONE = Object.freeze({
  NOT_STARTED: 'neutral',
  PENDING: 'warning',
  ONBOARDING: 'warning',
  KYC_PENDING: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
})

export const ACCOUNTING_REFUND_STATUS_LABELS = Object.freeze({
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
})

export const ACCOUNTING_REFUND_STATUS_TONE = Object.freeze({
  REQUESTED: 'warning',
  APPROVED: 'brand',
  PROCESSING: 'brand',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
})

export const COMMISSION_SCOPE_LABELS = Object.freeze({
  GLOBAL: 'Global',
  SELLER: 'Seller',
  CATEGORY: 'Category',
  PRODUCT: 'Product',
})

export const COMMISSION_RULE_STATE_LABELS = Object.freeze({
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  EXPIRED: 'Expired',
  INACTIVE: 'Retired',
})

export const COMMISSION_RULE_STATE_TONE = Object.freeze({
  ACTIVE: 'success',
  SCHEDULED: 'brand',
  EXPIRED: 'neutral',
  INACTIVE: 'neutral',
})

// The Overview/report range picker. `custom` opens the two date inputs.
export const ACCOUNTING_RANGES = Object.freeze([
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'previous_month', label: 'Previous month' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
])

export const INTEGRATION_HEALTH = Object.freeze({
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  DOWN: 'down',
  NOT_CONFIGURED: 'not_configured',
})

export const INTEGRATION_HEALTH_LABELS = Object.freeze({
  [INTEGRATION_HEALTH.OPERATIONAL]: 'Operational',
  [INTEGRATION_HEALTH.DEGRADED]: 'Degraded',
  [INTEGRATION_HEALTH.DOWN]: 'Down',
  [INTEGRATION_HEALTH.NOT_CONFIGURED]: 'Not configured',
})

export const INTEGRATION_HEALTH_TONE = Object.freeze({
  [INTEGRATION_HEALTH.OPERATIONAL]: 'success',
  [INTEGRATION_HEALTH.DEGRADED]: 'warning',
  [INTEGRATION_HEALTH.DOWN]: 'danger',
  [INTEGRATION_HEALTH.NOT_CONFIGURED]: 'neutral',
})

// Business model -> categorical series slot. Fixed assignment: the colour
// follows the model, never its rank in a filtered list.
export const BUSINESS_MODEL_SERIES = Object.freeze({
  [BUSINESS_MODEL.MARKETPLACE]: 1,
  [BUSINESS_MODEL.DROPSHIPPING]: 2,
  [BUSINESS_MODEL.OWN_STOCK]: 3,
})

export const PRODUCT_TYPE = Object.freeze({
  SIMPLE: 'simple',
  VARIABLE: 'variable',
  BULK: 'bulk',
  WHOLESALE: 'wholesale',
  PACK_SIZE: 'pack_size',
})

export const PRODUCT_TYPE_LABELS = Object.freeze({
  [PRODUCT_TYPE.SIMPLE]: 'Simple',
  [PRODUCT_TYPE.VARIABLE]: 'Variable',
  [PRODUCT_TYPE.BULK]: 'Bulk',
  [PRODUCT_TYPE.WHOLESALE]: 'Wholesale',
  [PRODUCT_TYPE.PACK_SIZE]: 'Pack size',
})

// Temporary static catalog for the Banner "linked product" dropdown — there's
// no live product API to query yet. Swap for a real product search once the
// catalog module is wired up; the id here is what gets stored as productId.
export const STATIC_BANNER_PRODUCTS = Object.freeze([
  { id: 'prd-1', name: 'Nirvaan Triply Stainless Steel Kadai, 1.2 L' },
  { id: 'prd-2', name: 'Aarohi Cotton Table Runner, 180 cm' },
  { id: 'prd-3', name: 'Vayu 1.5 Ton 3-Star Inverter AC' },
  { id: 'prd-4', name: 'Surya Cold-Pressed Groundnut Oil, 5 L' },
  { id: 'prd-5', name: 'Meher Handloom Cotton Kurta' },
  { id: 'prd-6', name: 'Surya Turmeric Powder, 500 g' },
  { id: 'prd-7', name: 'Vayu Ceiling Fan 1200 mm, BLDC' },
  { id: 'prd-8', name: 'Aarohi Jute Storage Basket, Large' },
  { id: 'prd-9', name: 'Nirvaan Silicone Spatula Set of 3' },
  { id: 'prd-10', name: 'Kritika Bulk Cotton Fabric, 100 m roll' },
])

// ---------------------------------------------------------------------------
// Vendor verification (real backend model — see backend/Models/Vendor.js).
// A partner is either B2B or B2C and moves PENDING -> UNDER_REVIEW ->
// APPROVED / REJECTED; `isActive` is a separate suspend switch on top.
// ---------------------------------------------------------------------------
export const VENDOR_TYPE_LABELS = Object.freeze({
  B2B: 'B2B partner',
  B2C: 'B2C partner',
})

export const VENDOR_TYPE_TONE = Object.freeze({
  B2B: 'brand',
  B2C: 'accent',
})

export const VENDOR_VERIFICATION_LABELS = Object.freeze({
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
})

export const VENDOR_VERIFICATION_TONE = Object.freeze({
  PENDING: 'neutral',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
})

// ---------------------------------------------------------------------------
// Order status (real backend model — see backend/Models/Order.js). Distinct
// from ORDER_STATUS above, which describes the sub-order lifecycle of the
// marketplace concept this platform doesn't implement.
// ---------------------------------------------------------------------------
export const ORDER_FLOW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
})

export const ORDER_FLOW_STATUS_LABELS = Object.freeze({
  [ORDER_FLOW_STATUS.PENDING]: 'Pending',
  [ORDER_FLOW_STATUS.PROCESSING]: 'Processing',
  [ORDER_FLOW_STATUS.SHIPPED]: 'Shipped',
  [ORDER_FLOW_STATUS.DELIVERED]: 'Delivered',
  [ORDER_FLOW_STATUS.CANCELLED]: 'Cancelled',
})

export const ORDER_FLOW_STATUS_TONE = Object.freeze({
  [ORDER_FLOW_STATUS.PENDING]: 'neutral',
  [ORDER_FLOW_STATUS.PROCESSING]: 'brand',
  [ORDER_FLOW_STATUS.SHIPPED]: 'accent',
  [ORDER_FLOW_STATUS.DELIVERED]: 'success',
  [ORDER_FLOW_STATUS.CANCELLED]: 'danger',
})

export const ORDER_PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
})

export const ORDER_PAYMENT_STATUS_LABELS = Object.freeze({
  [ORDER_PAYMENT_STATUS.PENDING]: 'Pending',
  [ORDER_PAYMENT_STATUS.PAID]: 'Paid',
  [ORDER_PAYMENT_STATUS.FAILED]: 'Failed',
  [ORDER_PAYMENT_STATUS.REFUNDED]: 'Refunded',
})

export const ORDER_PAYMENT_STATUS_TONE = Object.freeze({
  [ORDER_PAYMENT_STATUS.PENDING]: 'neutral',
  [ORDER_PAYMENT_STATUS.PAID]: 'success',
  [ORDER_PAYMENT_STATUS.FAILED]: 'danger',
  [ORDER_PAYMENT_STATUS.REFUNDED]: 'warning',
})

export const ORDER_PAYMENT_METHOD_LABELS = Object.freeze({
  COD: 'Cash on delivery',
  WALLET: 'Wallet',
  RAZORPAY: 'Razorpay',
})

export const DEFAULT_ROWS_PER_PAGE = 25
