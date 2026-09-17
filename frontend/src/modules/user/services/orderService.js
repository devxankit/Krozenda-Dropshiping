// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { orderSchema, orderListSchema, orderTrackingSchema, razorpayOrderSchema } from '../schemas/orderSchema'

// The backend computes the amount itself from the caller's own cart/address/
// coupon — it never trusts a client-supplied total (see orderController.js's
// computeCheckoutTotals), so this only forwards the checkout selections.
export async function createRazorpayOrder({ addressId, couponCode, shippingFee }) {
  const response = await api.post('/user/orders/razorpay-order', { addressId, couponCode, shippingFee })
  return razorpayOrderSchema.parse(response.data.data)
}

// `idempotencyKey` is required, not optional: it is what makes a double-tapped
// "Place Order", or a retry after a timeout, resolve to ONE order instead of
// two. The backend keys on (user, idempotencyKey) and returns the original
// order for a repeat (see orderController.createOrder).
export async function createOrder({ idempotencyKey, ...payload }) {
  const response = await api.post('/user/orders', payload, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  })
  return orderSchema.parse(response.data.data)
}

export async function cancelOrder(id) {
  const response = await api.patch(`/user/orders/${id}/cancel`)
  return response.data
}

// Unvalidated, error-swallowing variant kept for existing callers (e.g.
// RaiseTicketModal's "link this ticket to an order" picker) that just want a
// best-effort list without failing their own flow if it errors.
export async function fetchUserOrders() {
  try {
    const response = await api.get('/user/orders')
    return response.data?.data?.items || []
  } catch (err) {
    return []
  }
}

export async function fetchOrders({ status, page = 1, limit = 20 } = {}, { signal } = {}) {
  const response = await api.get('/user/orders', {
    params: { ...(status ? { status } : {}), page, limit },
    signal,
  })
  return {
    items: orderListSchema.parse(response.data.data.items),
    pagination: response.data.pagination ?? null,
  }
}

export async function fetchOrder(id, { signal } = {}) {
  const response = await api.get(`/user/orders/${id}`, { signal })
  return orderSchema.parse(response.data.data)
}

// Where this order's parcels are. Reads the stored timeline only — it never
// calls the courier, so refreshing this screen cannot spend the seller's
// carrier rate limit.
export async function fetchOrderTracking(id, { signal } = {}) {
  const response = await api.get(`/user/orders/${id}/tracking`, { signal })
  return orderTrackingSchema.parse(response.data.data)
}
