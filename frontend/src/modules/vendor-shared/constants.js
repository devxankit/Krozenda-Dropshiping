// Constants shared by seller/ and dropshipping-partner/

export const VENDOR_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
})

export const VENDOR_STATUS_LABELS = Object.freeze({
  [VENDOR_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [VENDOR_STATUS.APPROVED]: 'Approved',
  [VENDOR_STATUS.REJECTED]: 'Rejected',
  [VENDOR_STATUS.SUSPENDED]: 'Suspended',
})

export const VENDOR_NAV_ITEMS = Object.freeze([
  { label: 'Dashboard', to: 'dashboard', icon: 'dashboard' },
  { label: 'Products', to: 'products', icon: 'products' },
  { label: 'Inventory', to: 'inventory', icon: 'inventory' },
  { label: 'Orders', to: 'orders', icon: 'orders' },
  { label: 'Shipments', to: 'shipments', icon: 'shipments' },
  { label: 'Settlements', to: 'settlements', icon: 'settlements' },
  { label: 'KYC Documents', to: 'kyc-documents', icon: 'kyc' },
  { label: 'Store Settings', to: 'settings', icon: 'settings' },
])

export const VENDOR_ORDER_STATUS_TONE = Object.freeze({
  auto_assigned: 'warning',
  vendor_accepted: 'brand',
  packed: 'brand',
  awb_generated: 'brand',
  shipped: 'success',
  delivered: 'success',
  cancelled: 'danger',
})

export const VENDOR_PRODUCT_STATUS_TONE = Object.freeze({
  active: 'success',
  pending_approval: 'warning',
  rejected: 'danger',
  out_of_stock: 'danger',
})
