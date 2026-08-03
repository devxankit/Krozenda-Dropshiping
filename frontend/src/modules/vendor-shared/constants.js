// Constants shared by seller/ and dropshipping-partner/ — those two surfaces
// are ~70% identical (products/orders/settlements views), this file is that
// shared 70% for status data. Module-only constants stay in each module's
// own constants.js.

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
