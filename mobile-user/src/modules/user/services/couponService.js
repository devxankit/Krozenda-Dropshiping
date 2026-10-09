// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { usedCouponListSchema, applyCouponResultSchema } from '../schemas/couponSchema'

export async function applyCoupon(code) {
  const response = await api.post('/user/coupons/apply', { code })
  return applyCouponResultSchema.parse(response.data.data)
}

export async function fetchUsedCoupons() {
  const response = await api.get('/user/coupons/used')
  return usedCouponListSchema.parse(response.data.data.items)
}
