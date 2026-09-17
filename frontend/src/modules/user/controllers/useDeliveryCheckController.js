import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { checkProductDelivery } from '../services/productService'
import { useAddressesController } from './useAddressesController'
import { useAuthStore } from '../../../lib/authStore'

// The product page's delivery check.
//
// Two jobs: run the check, and fill the PIN code in from the buyer's own
// default address so a signed-in shopper is told the answer instead of being
// asked a question they have already answered.

const LAST_PINCODE_KEY = 'krozenda.lastPincode'
const PINCODE = /^\d{6}$/

function readLastPincode() {
  try {
    const saved = localStorage.getItem(LAST_PINCODE_KEY)
    return PINCODE.test(saved || '') ? saved : ''
  } catch {
    // Private window, or storage blocked. Not an error — just no pre-fill.
    return ''
  }
}

export function useDeliveryCheckController(productId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // A guest has no addresses and would only get a 401 for asking.
  const { addresses } = useAddressesController({ enabled: isAuthenticated })

  const defaultAddress = isAuthenticated
    ? addresses.find((a) => a.isDefault) || addresses[0] || null
    : null

  // What the shopper typed. `null` means they have not typed anything yet, so
  // the field falls back to their saved address (or the last PIN code they
  // checked as a guest).
  //
  // Deriving the displayed value rather than copying it into state with an
  // effect is deliberate: an effect that writes state re-renders for no reason
  // and, worse, would fight the shopper if their address loaded a moment after
  // they started typing.
  const [typed, setTyped] = useState(null)
  // The last PIN code this visitor checked, so a guest who comes back is not
  // asked again. Read once on mount (lazy initialiser), then kept in state
  // because it is rendered — a ref would be the wrong tool and React forbids
  // reading one during render for exactly that reason.
  const [lastSeen, setLastSeen] = useState(readLastPincode)

  const pincode = typed ?? defaultAddress?.pincode ?? lastSeen ?? ''

  const mutation = useMutation({
    mutationFn: (code) => checkProductDelivery(productId, code),
    onSuccess: (_result, code) => {
      setLastSeen(code)
      try {
        localStorage.setItem(LAST_PINCODE_KEY, code)
      } catch {
        // Nothing persisted; the answer is still on screen.
      }
    },
  })

  const { mutateAsync, reset } = mutation

  const run = useCallback(
    (code) => {
      const clean = String(code ?? '').trim()
      if (!PINCODE.test(clean)) return Promise.resolve(null)
      return mutateAsync(clean).catch(() => null)
    },
    [mutateAsync]
  )

  // Answer on arrival, once per product. Firing a request is a side effect on
  // an external system, which is what an effect is for; no state is written
  // here, so there is no cascading render.
  const autoRanFor = useRef(null)
  useEffect(() => {
    if (!productId) return
    if (autoRanFor.current === productId) return

    const auto = defaultAddress?.pincode || lastSeen
    if (!PINCODE.test(auto || '')) return

    autoRanFor.current = productId
    run(auto)
  }, [productId, defaultAddress, lastSeen, run])

  // Moving to another product clears the previous answer.
  const shownFor = useRef(productId)
  useEffect(() => {
    if (shownFor.current === productId) return
    shownFor.current = productId
    reset()
  }, [productId, reset])

  return {
    pincode,
    setPincode: setTyped,
    check: () => run(pincode),
    isChecking: mutation.isPending,
    result: mutation.data ?? null,
    error: mutation.error,
    // True when the PIN code came from the buyer's saved address rather than
    // being typed, so the screen can say where it got it from.
    fromSavedAddress: Boolean(typed === null && defaultAddress?.pincode),
    savedAddressLabel: defaultAddress
      ? [defaultAddress.city, defaultAddress.pincode].filter(Boolean).join(' ')
      : '',
    isValid: PINCODE.test(pincode || ''),
  }
}
