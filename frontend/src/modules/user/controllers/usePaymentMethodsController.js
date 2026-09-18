import { useQuery } from '@tanstack/react-query'
import { fetchPaymentMethods } from '../services/orderService'

// Which of COD/RAZORPAY/WALLET the admin currently allows. Refetched fresh
// on every checkout visit — a toggle flipped mid-session should take effect
// immediately, not wait out a stale cache.
export function usePaymentMethodsController() {
  const query = useQuery({
    queryKey: ['user', 'payment-methods'],
    queryFn: () => fetchPaymentMethods(),
    staleTime: 0,
  })

  return {
    methods: query.data ?? null,
    isLoading: query.isLoading,
  }
}
