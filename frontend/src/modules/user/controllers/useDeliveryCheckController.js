import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkProductDelivery } from '../services/productService'
import { useAddressesController } from './useAddressesController'
import { useAuthStore } from '../../../lib/authStore'

// The product page's delivery check.
//
// This is a READ — "what does delivery to this PIN code cost?" — so it is a
// query, not a mutation. That distinction is the whole design:
//
//   * the PIN code being asked about is part of the query key, so asking is
//     just a matter of changing it. No effect fires the request, no ref
//     guards it, and nothing has to be reset when the shopper moves on
//   * two components asking the same question at once get one request, and a
//     PIN code checked a moment ago answers from cache
//   * the answer cannot get stuck: react-query owns the lifecycle
//
// It was a mutation first, driven by an effect, and that is exactly how it
// ended up firing twice and sitting on "Checking…" — the effect re-ran on a
// remount while the state that said "already asked" did not survive with it.

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

function remember(pincode) {
  try {
    localStorage.setItem(LAST_PINCODE_KEY, pincode)
  } catch {
    // Nothing persisted; the answer is still on screen.
  }
}

export function useDeliveryCheckController(productId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // A guest has no addresses and would only get a 401 for asking.
  const { addresses } = useAddressesController({ enabled: isAuthenticated })

  const defaultAddress = isAuthenticated
    ? addresses.find((a) => a.isDefault) || addresses[0] || null
    : null

  // What we would check without being asked: the buyer's own default address,
  // else the last PIN code this visitor looked up.
  const [lastSeen] = useState(readLastPincode)
  const suggested = defaultAddress?.pincode || lastSeen || ''

  // What the shopper typed. `null` means they have not touched the field, so
  // it shows the suggestion.
  const [typed, setTyped] = useState(null)
  const pincode = typed ?? suggested

  // What is actually being asked about. Until the shopper presses Check this
  // is the suggestion, so a signed-in buyer gets their answer on arrival
  // rather than being asked a question they have already answered. Typing
  // does not change it — the result on screen keeps matching the PIN code it
  // was for until they ask again.
  const [submitted, setSubmitted] = useState(null)
  const active = submitted ?? suggested

  const query = useQuery({
    queryKey: ['user', 'delivery', productId, active],
    queryFn: () => checkProductDelivery(productId, active),
    enabled: Boolean(productId) && PINCODE.test(active),
    // The server keeps its own 5-minute per-lane cache; matching it here stops
    // a back-and-forth between two products re-asking the same question.
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const check = () => {
    if (!PINCODE.test(pincode)) return
    setSubmitted(pincode)
    remember(pincode)
  }

  return {
    pincode,
    setPincode: setTyped,
    check,
    // isFetching, not isPending: a cached answer is already on screen while a
    // refetch happens, and calling that "Checking…" would hide a usable result.
    isChecking: query.isFetching && !query.data,
    result: query.data ?? null,
    error: query.error,
    // True when the PIN code came from the buyer's saved address rather than
    // being typed, so the screen can say where it got it from.
    fromSavedAddress: Boolean(typed === null && defaultAddress?.pincode),
    savedAddressLabel: defaultAddress
      ? [defaultAddress.city, defaultAddress.pincode].filter(Boolean).join(' ')
      : '',
    isValid: PINCODE.test(pincode),
  }
}
