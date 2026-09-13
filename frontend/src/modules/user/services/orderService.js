// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { orderSchema, razorpayOrderSchema } from '../schemas/orderSchema'

export async function createRazorpayOrder(amount) {
  const response = await api.post('/user/orders/razorpay-order', { amount })
  return razorpayOrderSchema.parse(response.data.data)
}

export async function createOrder(payload) {
  const response = await api.post('/user/orders', payload)
  return orderSchema.parse(response.data.data)
}
