// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation } from '@tanstack/react-query'
import { createOrder, createRazorpayOrder } from '../services/orderService'
import { openRazorpayCheckout } from '../../../lib/razorpay'

export function useCheckoutController() {
  const mutation = useMutation({ mutationFn: createOrder })

  // For COD/WALLET this is just createOrder. For RAZORPAY it first opens the
  // checkout widget against a fresh order-payment Razorpay order (kept
  // separate from the wallet top-up one — see lib/razorpay.js), then creates
  // the real Order once the payment succeeds, carrying the signature for the
  // backend to verify before it ever marks the order PAID.
  const payAndPlaceOrder = ({ addressId, paymentMethod, couponCode, shippingFee, prefill }) => {
    if (paymentMethod === 'RAZORPAY') {
      return createRazorpayOrder({ addressId, couponCode, shippingFee }).then(
        (rpOrder) =>
          new Promise((resolve, reject) => {
            openRazorpayCheckout({
              keyId: rpOrder.keyId,
              razorpayOrderId: rpOrder.razorpayOrderId,
              amount: rpOrder.amount,
              currency: rpOrder.currency,
              name: 'Krozenda',
              description: 'Order payment',
              prefill,
              onSuccess: (response) => {
                mutation
                  .mutateAsync({
                    addressId,
                    paymentMethod,
                    couponCode,
                    shippingFee,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  })
                  .then(resolve, reject)
              },
              onFailure: reject,
            })
          })
      )
    }

    return mutation.mutateAsync({ addressId, paymentMethod, couponCode, shippingFee })
  }

  return {
    payAndPlaceOrder,
    isPlacingOrder: mutation.isPending,
    error: mutation.error,
  }
}
