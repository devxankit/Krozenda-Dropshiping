// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQuery } from '@tanstack/react-query'
import { applyCoupon, fetchUsedCoupons } from '../services/couponService'

// OrderSummaryScreen's coupon-code field — read-only preview, the real
// redemption happens server-side inside orderController.createOrder.
export function useApplyCouponController() {
  const mutation = useMutation({ mutationFn: applyCoupon })
  return {
    applyCoupon: mutation.mutateAsync,
    isApplying: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}

// CouponsOffersScreen's "Used Coupons" section.
export function useUsedCouponsController() {
  const query = useQuery({ queryKey: ['user', 'coupons', 'used'], queryFn: fetchUsedCoupons })
  return { usedCoupons: query.data || [], isLoading: query.isLoading }
}
