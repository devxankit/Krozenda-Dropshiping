// Thin wrapper around Razorpay's checkout.js widget. Reused by both the
// wallet top-up flow (ProfileDashboardScreen) and checkout payment
// (PaymentScreen) — the two are kept as separate backend Razorpay orders,
// this module only knows how to open the widget for whichever order it's
// handed.
const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let loadPromise = null

export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_SRC
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  return loadPromise
}

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
  const loaded = await loadRazorpayScript()
  if (!loaded || !window.Razorpay) {
    onFailure(new Error('Could not load the payment gateway. Check your connection and try again.'))
    return
  }

  const rzp = new window.Razorpay({
    key: keyId,
    order_id: razorpayOrderId,
    amount: Math.round(amount * 100),
    currency,
    name,
    description,
    prefill,
    theme: { color: '#2563eb' },
    handler: (response) => onSuccess(response),
    modal: {
      ondismiss: () => onFailure(new Error('Payment was cancelled')),
    },
  })

  rzp.on('payment.failed', (response) => {
    onFailure(new Error(response.error?.description || 'Payment failed'))
  })

  rzp.open()
}
