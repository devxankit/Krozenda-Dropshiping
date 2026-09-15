// Constants shared by seller/ and dropshipping-partner/

export const VENDOR_STATUS_LABELS = Object.freeze({
  pending: 'Pending Approval',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
})

export const VENDOR_ORDER_STATUS_TONE = Object.freeze({
  PENDING: 'warning',
  PROCESSING: 'brand',
  SHIPPED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'danger',
})

export const VENDOR_PRODUCT_STATUS_TONE = Object.freeze({
  active: 'success',
  inactive: 'neutral',
  pending: 'warning',
  rejected: 'danger',
  out_of_stock: 'danger',
})

export const VENDOR_RETURN_STATUS_TONE = Object.freeze({
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
})

export const VENDOR_COUPON_STATUS_TONE = Object.freeze({
  ACTIVE: 'success',
  UPCOMING: 'brand',
  EXPIRED: 'neutral',
  USAGE_LIMIT_REACHED: 'warning',
  INACTIVE: 'neutral',
})
