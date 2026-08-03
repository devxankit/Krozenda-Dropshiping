// Static reference data pulled from the project context doc. This is DATA,
// not logic — RBAC and status handling must read from these tables rather
// than hardcoding role/status strings inline (project context §2, §6.2).
// Kept in lockstep with frontend/src/config/constants.js — the two apps
// must agree on these keys since they cross the wire as plain strings.

// ---- Business models (project context §1) --------------------------------
export const BUSINESS_MODEL = Object.freeze({
  DROPSHIPPING: 'dropshipping', // Model A — Direct Dropshipping
  MARKETPLACE: 'marketplace', // Model B — Marketplace (Amazon-style)
  OWN_STOCK: 'own_stock', // Model C — Own Stock
})

// ---- Roles (project context §2 — 13 roles, permissions are data) ---------
// `surface` mirrors the frontend's ROLE_SURFACE — used by seed data and by
// clients deciding which panel a role lands on. Roles 8–11 can carry both a
// seller and a buyer capability on one account (see §2 architecture note) —
// modelled on the user record as `roles[]` + `capabilities[]`, never a
// single `role` string field.
export const ROLE = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  COMPANY: 'company',
  MANUFACTURER: 'manufacturer',
  VENDOR_SELLER: 'vendor_seller',
  DROPSHIPPING_PARTNER: 'dropshipping_partner',
  TRADER: 'trader',
  DEALER: 'dealer',
  DISTRIBUTOR: 'distributor',
  WHOLESALER: 'wholesaler',
  RETAIL_CUSTOMER: 'retail_customer',
  B2B_BUYER: 'b2b_buyer',
})

export const ROLE_SURFACE = Object.freeze({
  ADMIN_PANEL: 'admin',
  SELLER_PANEL: 'seller',
  BUYER_APP: 'buyer',
})

export const ROLES = Object.freeze([
  { key: ROLE.SUPER_ADMIN, label: 'Super Admin', surface: ROLE_SURFACE.ADMIN_PANEL },
  { key: ROLE.ADMIN, label: 'Admin', surface: ROLE_SURFACE.ADMIN_PANEL },
  { key: ROLE.STAFF, label: 'Staff', surface: ROLE_SURFACE.ADMIN_PANEL },
  { key: ROLE.COMPANY, label: 'Company', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.MANUFACTURER, label: 'Manufacturer', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.VENDOR_SELLER, label: 'Vendor / Seller', surface: ROLE_SURFACE.SELLER_PANEL },
  {
    key: ROLE.DROPSHIPPING_PARTNER,
    label: 'Dropshipping Partner',
    surface: ROLE_SURFACE.SELLER_PANEL,
  },
  { key: ROLE.TRADER, label: 'Trader', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.DEALER, label: 'Dealer', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.DISTRIBUTOR, label: 'Distributor', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.WHOLESALER, label: 'Wholesaler', surface: ROLE_SURFACE.SELLER_PANEL },
  { key: ROLE.RETAIL_CUSTOMER, label: 'Retail Customer', surface: ROLE_SURFACE.BUYER_APP },
  { key: ROLE.B2B_BUYER, label: 'B2B Buyer', surface: ROLE_SURFACE.BUYER_APP },
])

// ---- Order lifecycle (project context §6.2) -------------------------------
export const ORDER_STATUS = Object.freeze({
  PLACED: 'placed',
  PAYMENT_VERIFIED: 'payment_verified',
  AUTO_ASSIGNED_TO_VENDOR: 'auto_assigned_to_vendor',
  VENDOR_ACCEPTED: 'vendor_accepted',
  PACKED: 'packed',
  AWB_GENERATED: 'awb_generated',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  SETTLEMENT_ELIGIBLE: 'settlement_eligible',
  SETTLED: 'settled',
})

export const ORDER_STATUS_SEQUENCE = Object.freeze([
  ORDER_STATUS.PLACED,
  ORDER_STATUS.PAYMENT_VERIFIED,
  ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR,
  ORDER_STATUS.VENDOR_ACCEPTED,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.AWB_GENERATED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.SETTLEMENT_ELIGIBLE,
  ORDER_STATUS.SETTLED,
])

export const ORDER_STATUS_EXCEPTION = Object.freeze({
  VENDOR_REJECTED: 'vendor_rejected',
  CANCELLED_BUYER: 'cancelled_buyer',
  CANCELLED_ADMIN: 'cancelled_admin',
  RTO_INITIATED: 'rto_initiated',
  RTO_DELIVERED: 'rto_delivered',
  RETURN_REQUESTED: 'return_requested',
  REPLACEMENT_ISSUED: 'replacement_issued',
})

export const ALL_ORDER_STATUSES = Object.freeze([
  ...Object.values(ORDER_STATUS),
  ...Object.values(ORDER_STATUS_EXCEPTION),
])
