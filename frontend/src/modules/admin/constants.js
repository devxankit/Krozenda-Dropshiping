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

  DASHBOARD_VIEW: 'admin.dashboard.view',
  ANALYTICS_VIEW: 'admin.analytics.view',

  CATALOG_VIEW: 'admin.catalog.view',
  CATALOG_MANAGE: 'admin.catalog.manage',
  CATALOG_APPROVE: 'admin.catalog.approve',

  DROPSHIP_VIEW: 'admin.dropship.view',
  DROPSHIP_MANAGE: 'admin.dropship.manage',

  ORDERS_VIEW: 'admin.orders.view',
  ORDERS_MANAGE: 'admin.orders.manage',
  ORDERS_CANCEL: 'admin.orders.cancel',
  RETURNS_MANAGE: 'admin.returns.manage',

  PEOPLE_VIEW: 'admin.people.view',
  PEOPLE_MANAGE: 'admin.people.manage',
  KYC_REVIEW: 'admin.kyc.review',
  ROLES_MANAGE: 'admin.roles.manage',

  FINANCE_VIEW: 'admin.finance.view',
  FINANCE_MANAGE: 'admin.finance.manage',
  PAYOUT_PREPARE: 'admin.payout.prepare',
  PAYOUT_APPROVE: 'admin.payout.approve',
  ACCOUNTING_VIEW: 'admin.accounting.view',
  ACCOUNTING_POST: 'admin.accounting.post',
  TAX_EXPORT: 'admin.tax.export',

  MARKETING_VIEW: 'admin.marketing.view',
  MARKETING_MANAGE: 'admin.marketing.manage',

  REPORTS_VIEW: 'admin.reports.view',

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
    ADMIN_PERMISSIONS.TAX_EXPORT,
    ADMIN_PERMISSIONS.REPORTS_VIEW,
  ]),
  ca_auditor: Object.freeze([
    ADMIN_PERMISSIONS.ACCESS,
    ADMIN_PERMISSIONS.FINANCE_VIEW,
    ADMIN_PERMISSIONS.ACCOUNTING_VIEW,
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
    label: 'Catalog',
    items: [
      {
        label: 'Products',
        to: ADMIN_ROUTES.PRODUCTS,
        icon: 'products',
        permission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Categories & brands',
        to: ADMIN_ROUTES.CATEGORIES,
        icon: 'categories',
        permission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Inventory',
        to: ADMIN_ROUTES.INVENTORY,
        icon: 'inventory',
        permission: ADMIN_PERMISSIONS.CATALOG_VIEW,
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
        label: 'Supplier sync',
        to: ADMIN_ROUTES.SUPPLIER_SYNC,
        icon: 'refresh',
        permission: ADMIN_PERMISSIONS.CATALOG_MANAGE,
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
        permission: ADMIN_PERMISSIONS.ORDERS_VIEW,
        match: '/admin/orders/detail',
      },
      {
        label: 'Sub-orders',
        to: ADMIN_ROUTES.SUB_ORDERS,
        icon: 'list',
        permission: ADMIN_PERMISSIONS.ORDERS_VIEW,
      },
      {
        label: 'Shipments',
        to: ADMIN_ROUTES.SHIPMENTS,
        icon: 'shipments',
        permission: ADMIN_PERMISSIONS.ORDERS_VIEW,
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
        permission: ADMIN_PERMISSIONS.ORDERS_VIEW,
      },
    ],
  },
  {
    id: 'dropshipping',
    label: 'Dropshipping',
    items: [
      {
        label: 'Dropship Hub',
        to: ADMIN_ROUTES.DROPSHIPPING_OVERVIEW,
        icon: 'dropshipping',
        permission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Dropship partners',
        to: ADMIN_ROUTES.DROPSHIPPING_PARTNERS,
        icon: 'sellers',
        permission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
      },
      {
        label: 'Dropship products',
        to: ADMIN_ROUTES.DROPSHIPPING_PRODUCTS,
        icon: 'products',
        permission: ADMIN_PERMISSIONS.CATALOG_VIEW,
      },
      {
        label: 'Forwarded orders',
        to: ADMIN_ROUTES.DROPSHIPPING_ORDERS,
        icon: 'orders',
        permission: ADMIN_PERMISSIONS.ORDERS_VIEW,
      },
      {
        label: 'Supplier sync',
        to: ADMIN_ROUTES.SUPPLIER_SYNC,
        icon: 'refresh',
        permission: ADMIN_PERMISSIONS.CATALOG_MANAGE,
      },
      {
        label: 'Margin & rules',
        to: ADMIN_ROUTES.DROPSHIPPING_MARGINS,
        icon: 'sliders',
        permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
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
        permission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
      },
      {
        label: 'Customers',
        to: ADMIN_ROUTES.CUSTOMERS,
        icon: 'customers',
        permission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
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
        label: 'Staff & roles',
        to: ADMIN_ROUTES.STAFF,
        icon: 'staff',
        permission: ADMIN_PERMISSIONS.ROLES_MANAGE,
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      {
        label: 'Overview',
        to: ADMIN_ROUTES.FINANCE_OVERVIEW,
        icon: 'finance',
        permission: ADMIN_PERMISSIONS.FINANCE_VIEW,
      },
      {
        label: 'Settlements',
        to: ADMIN_ROUTES.SETTLEMENTS,
        icon: 'settlements',
        permission: ADMIN_PERMISSIONS.FINANCE_VIEW,
        badge: 'failedPayouts',
        badgeTone: 'danger',
      },
      {
        label: 'Commission & pricing',
        to: ADMIN_ROUTES.COMMISSION_RULES,
        icon: 'sliders',
        permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
      },
      {
        label: 'Accounting',
        to: ADMIN_ROUTES.PNL,
        icon: 'ledger',
        permission: ADMIN_PERMISSIONS.ACCOUNTING_VIEW,
      },
      {
        label: 'Tax centre',
        to: ADMIN_ROUTES.TAX_CENTER,
        icon: 'tax',
        permission: ADMIN_PERMISSIONS.TAX_EXPORT,
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
        permission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
      {
        label: 'Banners & CMS',
        to: ADMIN_ROUTES.BANNERS,
        icon: 'cms',
        permission: ADMIN_PERMISSIONS.MARKETING_VIEW,
      },
      {
        label: 'Notifications',
        to: ADMIN_ROUTES.CAMPAIGNS,
        icon: 'campaigns',
        permission: ADMIN_PERMISSIONS.MARKETING_MANAGE,
      },
      {
        label: 'Reviews',
        to: ADMIN_ROUTES.REVIEWS,
        icon: 'reviews',
        permission: ADMIN_PERMISSIONS.MARKETING_VIEW,
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
        permission: ADMIN_PERMISSIONS.PEOPLE_VIEW,
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
export const SETTINGS_NAV = Object.freeze([
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'General', to: ADMIN_ROUTES.SETTINGS_GENERAL },
      { label: 'Business rules', to: ADMIN_ROUTES.SETTINGS_BUSINESS_RULES },
      { label: 'Taxes & HSN', to: ADMIN_ROUTES.SETTINGS_TAXES },
      { label: 'Policies & legal', to: ADMIN_ROUTES.SETTINGS_POLICIES },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    items: [
      { label: 'Payments', to: ADMIN_ROUTES.SETTINGS_PAYMENTS },
      { label: 'Logistics', to: ADMIN_ROUTES.SETTINGS_LOGISTICS },
      { label: 'Notifications', to: ADMIN_ROUTES.SETTINGS_NOTIFICATIONS },
      { label: 'Integration health', to: ADMIN_ROUTES.SETTINGS_INTEGRATIONS },
    ],
  },
  {
    id: 'access',
    label: 'Access',
    items: [
      { label: 'Roles & permissions', to: ADMIN_ROUTES.ROLES },
      { label: 'Security', to: ADMIN_ROUTES.SETTINGS_SECURITY },
      { label: 'API keys & webhooks', to: ADMIN_ROUTES.SETTINGS_API_WEBHOOKS },
    ],
  },
])

// ---------------------------------------------------------------------------
// Status vocabularies
// ---------------------------------------------------------------------------

// Every value in config/constants.js ORDER_STATUS and ORDER_STATUS_EXCEPTION
// has an entry. A status with no tone here is a bug, not a default.
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

export const DEFAULT_ROWS_PER_PAGE = 25
