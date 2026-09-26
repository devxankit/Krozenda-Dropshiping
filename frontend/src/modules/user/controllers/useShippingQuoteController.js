import { useQuery } from '@tanstack/react-query'
import { fetchShippingQuote } from '../services/orderService'
import { useCartStore, lineKey } from '../../../lib/cartStore'

// The price of this checkout, as the server computes it.
//
// A query keyed on everything that changes the answer — address, payment
// method, coupon — so switching between COD and prepaid simply asks a
// different question, and switching back answers from cache.
//
// Nothing here adds anything up. The total displayed is the server's total,
// because that is the one that gets charged; a second implementation in the
// client is how a screen ends up promising a number nobody honours.
export function useShippingQuoteController({ addressId, paymentMethod, couponCode }) {
  // The cart is part of the question too. Without it, removing an item or
  // changing a quantity kept answering from the old cart's cached quote for
  // up to five minutes — a total that no longer matched the items listed.
  const cartKey = useCartStore((s) =>
    s.items.map((item) => `${lineKey(item.id, item.variantId)}x${item.quantity}@${item.price}`).join('|'),
  )

  const query = useQuery({
    queryKey: ['user', 'shipping-quote', addressId, paymentMethod, couponCode || null, cartKey],
    queryFn: () => fetchShippingQuote({ addressId, paymentMethod, couponCode }),
    enabled: Boolean(addressId && paymentMethod),
    // Carrier rates do not move minute to minute, and re-quoting on every
    // screen the buyer steps through would spend calls for the same answer.
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return {
    quote: query.data ?? null,
    isLoading: query.isFetching && !query.data,
    // The reason matters: an unserviceable address is the buyer's to fix, a
    // carrier outage is not.
    error: query.error,
    errorCode: query.error?.code ?? null,
    refetch: query.refetch,
  }
}
