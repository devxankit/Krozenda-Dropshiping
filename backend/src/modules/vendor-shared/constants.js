// Shared by seller/ and dropshipping-partner/ — those two surfaces are
// ~70% identical (products/orders/settlements). Kept identical to
// frontend's modules/vendor-shared/constants.js.
export const VENDOR_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
})
