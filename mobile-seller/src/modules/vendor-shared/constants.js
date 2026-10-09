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

// What an unapproved seller may still reach. Everything else in the panel
// assumes an APPROVED vendor: products they cannot list, orders they cannot
// receive, payouts they cannot be paid. These four are exactly the screens
// that EXIST to get them approved, plus the two that let them fix the details
// an admin rejected them over.
//
// Suffix-matched, not absolute, because the same panel is mounted at /seller
// and /partner — see getVendorNavTree.
export const VENDOR_ONBOARDING_ALLOWED = Object.freeze([
  'status',
  'kyc-documents',
  'profile',
  'settings',
  'notifications',
])

// PENDING  — registered, has not submitted the application yet.
// UNDER_REVIEW — submitted, an admin is looking at it.
// REJECTED — admin sent it back; rejectionReason says why, and the seller can
//            fix and resubmit (submitForVerification accepts this state).
// APPROVED — full panel.
export const VENDOR_VERIFICATION_TONE = Object.freeze({
  PENDING: 'warning',
  UNDER_REVIEW: 'brand',
  APPROVED: 'success',
  REJECTED: 'danger',
})
