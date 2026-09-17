// State shared across the checkout steps (Address -> Delivery -> Summary ->
// Payment).
//
// Persisted to sessionStorage, not memory and not localStorage:
//
//   - In memory alone (the previous behaviour) a WebView reload — which
//     Android does freely when it reclaims memory, and which happens on every
//     return from a UPI app — wiped the selected address, the delivery choice
//     and the applied coupon. The payment screen then rendered a ₹0 total with
//     a disabled button and no way forward except starting over (§111, §112).
//   - localStorage would be worse in the other direction: a half-finished
//     checkout from last week should not be waiting when the app reopens.
//
// sessionStorage is the right lifetime: survives a reload, dies with the tab.
//
// None of this is trusted for money. The server recomputes subtotal, discount,
// shipping and total from the buyer's own cart at both quote time and order
// time — this only remembers which options they picked.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// The only shipping prices the app offers. Mirrors ALLOWED_SHIPPING_FEES in
// backend/Controllers/orderController.js — anything else is rejected there, so
// keeping the two lists aligned is what stops the UI quoting a fee the server
// will silently replace with 0.
export const SHIPPING_OPTIONS = [
  {
    id: 'standard',
    fee: 0,
    label: 'Standard Delivery',
    description: 'Free • 5-7 business days',
  },
  {
    id: 'express',
    fee: 99,
    label: 'Express Delivery',
    description: '2-3 business days',
  },
  {
    id: 'priority',
    fee: 199,
    label: 'Priority Delivery',
    description: 'Next business day where serviceable',
  },
]

export const ALLOWED_SHIPPING_FEES = SHIPPING_OPTIONS.map((option) => option.fee)

export const useCheckoutStore = create(
  persist(
    (set) => ({
      selectedAddressId: null,
      shippingFee: 0,
      appliedCoupon: null, // { code, discountAmount }

      setSelectedAddressId: (addressId) => set({ selectedAddressId: addressId }),

      setShippingFee: (fee) =>
        // Clamped to the allowed set rather than stored as given: a value the
        // server will not honour must never reach the summary screen, or the
        // buyer agrees to a total that is not the one they are charged.
        set({ shippingFee: ALLOWED_SHIPPING_FEES.includes(Number(fee)) ? Number(fee) : 0 }),

      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      clearCoupon: () => set({ appliedCoupon: null }),

      reset: () => set({ selectedAddressId: null, shippingFee: 0, appliedCoupon: null }),
    }),
    {
      name: 'krozenda.checkout',
      storage: createJSONStorage(() => {
        // sessionStorage can throw in a WebView with site data blocked, and in
        // a private window. Falling back to a no-op keeps checkout working
        // (in-memory only) rather than crashing the store's creation.
        try {
          const probe = '__krozenda_probe__'
          window.sessionStorage.setItem(probe, '1')
          window.sessionStorage.removeItem(probe)
          return window.sessionStorage
        } catch {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
      }),
    },
  ),
)
