// State shared across the checkout steps (Address -> Delivery -> Summary ->
// Payment).
//
// Persisted so an app restart / process kill mid-checkout does not lose the selection:
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
import AsyncStorage from '@react-native-async-storage/async-storage'

// The buyer chooses how to PAY. What shipping costs follows from that — a
// courier charges more to collect cash — and is quoted by the server from the
// carrier, per cart and per address.
//
// This replaces a hardcoded [Standard 0, Express 99, Priority 199] ladder.
// Those numbers were invented: nothing checked whether a courier could do
// "next business day" to the buyer's PIN code, and the client sent the fee it
// had picked to the server, which accepted any of the three.
export const PAYMENT_METHODS = [
  {
    id: 'RAZORPAY',
    label: 'Pay Online',
    description: 'Card, UPI or Netbanking',
  },
  {
    id: 'WALLET',
    label: 'Krozenda Wallet',
    description: 'Pay from your wallet balance',
  },
  {
    id: 'COD',
    label: 'Cash on Delivery',
    description: 'Pay the courier when it arrives',
  },
]

export const useCheckoutStore = create(
  persist(
    (set) => ({
      selectedAddressId: null,
      paymentMethod: 'RAZORPAY',
      appliedCoupon: null, // { code, discountAmount }
      b2b: { isB2B: false, companyName: '', gstin: '' },

      setSelectedAddressId: (addressId) => set({ selectedAddressId: addressId }),

      // Allowlisted rather than stored as given: a tampered persisted store
      // must not carry an unknown method into checkout. The server validates
      // it again anyway — this just keeps the UI honest.
      setPaymentMethod: (method) =>
        set({ paymentMethod: PAYMENT_METHODS.some((m) => m.id === method) ? method : 'RAZORPAY' }),

      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      clearCoupon: () => set({ appliedCoupon: null }),

      setB2B: (b2b) =>
        set((state) => ({
          b2b: {
            ...state.b2b,
            ...b2b,
          },
        })),

      reset: () =>
        set({
          selectedAddressId: null,
          paymentMethod: 'RAZORPAY',
          appliedCoupon: null,
          b2b: { isB2B: false, companyName: '', gstin: '' },
        }),
    }),
    {
      name: 'krozenda.checkout',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
