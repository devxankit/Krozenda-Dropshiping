// Session-only state shared across the checkout steps (Address -> Delivery ->
// Summary -> Payment). Deliberately NOT persisted like cartStore/wishlistStore
// — a half-finished checkout shouldn't survive a browser restart, and the
// server is always re-validated at order-creation time regardless of what's
// cached here.
import { create } from 'zustand'

export const useCheckoutStore = create((set) => ({
  selectedAddressId: null,
  shippingFee: 0,
  appliedCoupon: null, // { code, discountAmount }

  setSelectedAddressId: (addressId) => set({ selectedAddressId: addressId }),
  setShippingFee: (fee) => set({ shippingFee: fee }),
  setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
  clearCoupon: () => set({ appliedCoupon: null }),

  reset: () => set({ selectedAddressId: null, shippingFee: 0, appliedCoupon: null }),
}))
