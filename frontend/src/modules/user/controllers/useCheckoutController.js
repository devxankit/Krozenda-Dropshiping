// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createOrder, createRazorpayOrder } from '../services/orderService'
import { openRazorpayCheckout } from '../../../lib/razorpay'

// A checkout attempt's idempotency key.
//
// crypto.randomUUID is not available on older Android WebViews or over plain
// http, so there is a fallback. The key only has to be unique per attempt for
// one user; it is not a secret.
function newIdempotencyKey() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '')
    }
  } catch {
    // fall through
  }
  return `ck${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function useCheckoutController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({ mutationFn: createOrder })

  // The key is generated once per checkout attempt and REUSED across retries
  // of that same attempt. That is the whole point: a double tap, a retry after
  // a timeout, or a resumed WebView all resend the same key, and the backend
  // answers with the order it already created instead of making a second one.
  const attemptKeyRef = useRef(null)
  // Guards against a second invocation landing before React has re-rendered
  // with isPending — `disabled={isPlacingOrder}` alone loses that race.
  const inFlightRef = useRef(false)

  const payAndPlaceOrder = useCallback(
    // No `shippingFee`: the server quotes it from the carrier for this cart,
    // address and payment method. Sending one was the old hole — any value in
    // [0, 99, 199] was accepted, so a buyer could choose 0.
    async ({ addressId, paymentMethod, couponCode, prefill }) => {
      if (inFlightRef.current) {
        // Not an error the user should see — it is the second half of a double
        // tap. The first call is still running and will resolve.
        return undefined
      }
      inFlightRef.current = true

      if (!attemptKeyRef.current) {
        attemptKeyRef.current = newIdempotencyKey()
      }
      const idempotencyKey = attemptKeyRef.current

      const finish = (order) => {
        // Stock moved and the cart was emptied server-side, so anything that
        // reflects either is now stale.
        queryClient.invalidateQueries({ queryKey: ['user', 'orders'] })
        queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] })
        // A fresh key for the next checkout, so the buyer's NEXT order is not
        // mistaken for a retry of this one.
        attemptKeyRef.current = null
        return order
      }

      try {
        if (paymentMethod !== 'RAZORPAY') {
          const order = await mutation.mutateAsync({
            addressId,
            paymentMethod,
            couponCode,
            idempotencyKey,
          })
          return finish(order)
        }

        // Online payment. The amount is never sent — createRazorpayOrder
        // recomputes it server-side from the caller's own cart, address and
        // coupon, and createOrder then re-verifies the captured payment
        // against that same computation before the order is written.
        const rpOrder = await createRazorpayOrder({ addressId, couponCode })

        const response = await new Promise((resolve, reject) => {
          openRazorpayCheckout({
            keyId: rpOrder.keyId,
            razorpayOrderId: rpOrder.razorpayOrderId,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            name: 'Krozenda',
            description: 'Order payment',
            prefill,
            onSuccess: resolve,
            onFailure: reject,
          })
        })

        const order = await mutation.mutateAsync({
          addressId,
          paymentMethod,
          couponCode,
          idempotencyKey,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        })
        return finish(order)
      } finally {
        inFlightRef.current = false
      }
    },
    [mutation, queryClient],
  )

  return {
    payAndPlaceOrder,
    isPlacingOrder: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
