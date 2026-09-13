// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWallet, createTopupOrder, verifyTopup } from '../services/walletService'
import { openRazorpayCheckout } from '../../../lib/razorpay'

const QUERY_KEY = ['user', 'wallet']

export function useWalletController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchWallet })

  const verifyMutation = useMutation({
    mutationFn: verifyTopup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // Orchestrates the full round trip: create a Razorpay order for the
  // amount, open the checkout widget, then verify+credit on success. Resolves
  // once the wallet has actually been credited; rejects on cancel/failure.
  const topup = (amount, prefill = {}) =>
    createTopupOrder(amount).then(
      (order) =>
        new Promise((resolve, reject) => {
          openRazorpayCheckout({
            keyId: order.keyId,
            razorpayOrderId: order.razorpayOrderId,
            amount: order.amount,
            currency: order.currency,
            name: 'Krozenda Wallet Top-up',
            description: `Add ₹${order.amount.toLocaleString('en-IN')} to your Krozenda Wallet`,
            prefill,
            onSuccess: (response) => {
              verifyMutation
                .mutateAsync({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  amount,
                })
                .then(resolve, reject)
            },
            onFailure: reject,
          })
        })
    )

  return {
    balance: query.data?.balance ?? 0,
    transactions: query.data?.transactions || [],
    isLoading: query.isLoading,
    topup,
    isToppingUp: verifyMutation.isPending,
  }
}
