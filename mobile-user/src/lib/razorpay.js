// Native Razorpay checkout (react-native-razorpay) - replaces the web's checkout.js widget loader.
// Same call shape as the web lib/razorpay.js openRazorpayCheckout so PaymentScreen / WalletScreen
// port over unchanged. onSuccess receives { razorpay_payment_id, razorpay_order_id, razorpay_signature }.
import { env } from '../config/env'

export async function openRazorpayCheckout({
  keyId,
  razorpayOrderId,
  amount,
  currency = 'INR',
  name = 'Krozenda',
  description = '',
  prefill = {},
  onSuccess = () => {},
  onFailure = () => {},
}) {
  const key = keyId || env.razorpayKeyId
  if (!key) {
    onFailure(new Error('Payment gateway is not configured.'))
    return
  }
  let RazorpayCheckout
  try {
    // Loaded on demand: the native SDK is absent in Expo Go and must not break app start-up.
    RazorpayCheckout = require('react-native-razorpay').default ?? require('react-native-razorpay')
  } catch {
    onFailure(new Error('Online payment needs the installed app build (not available in Expo Go).'))
    return
  }
  try {
    const response = await RazorpayCheckout.open({
      key,
      order_id: razorpayOrderId,
      amount: Math.round(amount * 100),
      currency,
      name,
      description,
      prefill,
      theme: { color: '#2563eb' },
    })
    onSuccess(response)
  } catch (error) {
    // Razorpay rejects with { code, description } for both a dismissed sheet and a failed payment.
    const cancelled = error?.code === 0 || /cancel/i.test(error?.description || '')
    onFailure(new Error(cancelled ? 'Payment was cancelled' : error?.description || error?.message || 'Payment failed'))
  }
}
