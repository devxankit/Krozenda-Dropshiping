// Static reference data pulled from the project context doc. This is DATA,
// not logic — RBAC and status handling must read from these tables rather
// than hardcoding role/status strings inline (project context §2, §6.2).

// ---- Business models (project context §1) --------------------------------
export const BUSINESS_MODEL = Object.freeze({
  DROPSHIPPING: 'dropshipping', // Model A — Direct Dropshipping
  MARKETPLACE: 'marketplace', // Model B — Marketplace (Amazon-style)
  OWN_STOCK: 'own_stock', // Model C — Own Stock
})

export const BUSINESS_MODEL_LABELS = Object.freeze({
  [BUSINESS_MODEL.DROPSHIPPING]: 'Direct Dropshipping',
  [BUSINESS_MODEL.MARKETPLACE]: 'Marketplace',
  [BUSINESS_MODEL.OWN_STOCK]: 'Own Stock',
})

// ---- Roles (project context §2 — 13 roles, permissions are data) ---------
// `surface` maps a role to the panel it lands on; RoleGuard/routing reads
// this instead of switching on role strings. Roles 8–11 can carry both a
// seller and a buyer capability on one account (see §2 architecture note) —
// that is modelled on the user record (`roles[]` + `capabilities[]`), this
// table just enumerates the roles themselves.
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
  { id: ROLE.SUPER_ADMIN, label: 'Super Admin', surface: ROLE_SURFACE.ADMIN_PANEL },
  { id: ROLE.ADMIN, label: 'Admin', surface: ROLE_SURFACE.ADMIN_PANEL },
  { id: ROLE.STAFF, label: 'Staff', surface: ROLE_SURFACE.ADMIN_PANEL },
  { id: ROLE.COMPANY, label: 'Company', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.MANUFACTURER, label: 'Manufacturer', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.VENDOR_SELLER, label: 'Vendor / Seller', surface: ROLE_SURFACE.SELLER_PANEL },
  {
    id: ROLE.DROPSHIPPING_PARTNER,
    label: 'Dropshipping Partner',
    surface: ROLE_SURFACE.SELLER_PANEL,
  },
  { id: ROLE.TRADER, label: 'Trader', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.DEALER, label: 'Dealer', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.DISTRIBUTOR, label: 'Distributor', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.WHOLESALER, label: 'Wholesaler', surface: ROLE_SURFACE.SELLER_PANEL },
  { id: ROLE.RETAIL_CUSTOMER, label: 'Retail Customer', surface: ROLE_SURFACE.BUYER_APP },
  { id: ROLE.B2B_BUYER, label: 'B2B Buyer', surface: ROLE_SURFACE.BUYER_APP },
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

// The happy-path sequence, in order. Drive progress bars / step indicators
// off this array rather than re-deriving the order elsewhere.
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

// Branches off the happy path — a sub-order can land here instead of
// continuing the sequence above.
export const ORDER_STATUS_EXCEPTION = Object.freeze({
  VENDOR_REJECTED: 'vendor_rejected',
  CANCELLED_BUYER: 'cancelled_buyer',
  CANCELLED_ADMIN: 'cancelled_admin',
  RTO_INITIATED: 'rto_initiated',
  RTO_DELIVERED: 'rto_delivered',
  RETURN_REQUESTED: 'return_requested',
  REPLACEMENT_ISSUED: 'replacement_issued',
})

export const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUS.PLACED]: 'Placed',
  [ORDER_STATUS.PAYMENT_VERIFIED]: 'Payment Verified',
  [ORDER_STATUS.AUTO_ASSIGNED_TO_VENDOR]: 'Auto-assigned to Vendor',
  [ORDER_STATUS.VENDOR_ACCEPTED]: 'Vendor Accepted',
  [ORDER_STATUS.PACKED]: 'Packed',
  [ORDER_STATUS.AWB_GENERATED]: 'AWB Generated',
  [ORDER_STATUS.SHIPPED]: 'Shipped',
  [ORDER_STATUS.IN_TRANSIT]: 'In Transit',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.SETTLEMENT_ELIGIBLE]: 'Settlement Eligible',
  [ORDER_STATUS.SETTLED]: 'Settled',
  [ORDER_STATUS_EXCEPTION.VENDOR_REJECTED]: 'Vendor Rejected',
  [ORDER_STATUS_EXCEPTION.CANCELLED_BUYER]: 'Cancelled (Buyer)',
  [ORDER_STATUS_EXCEPTION.CANCELLED_ADMIN]: 'Cancelled (Admin)',
  [ORDER_STATUS_EXCEPTION.RTO_INITIATED]: 'RTO Initiated',
  [ORDER_STATUS_EXCEPTION.RTO_DELIVERED]: 'RTO Delivered',
  [ORDER_STATUS_EXCEPTION.RETURN_REQUESTED]: 'Return Requested',
  [ORDER_STATUS_EXCEPTION.REPLACEMENT_ISSUED]: 'Replacement Issued',
})
