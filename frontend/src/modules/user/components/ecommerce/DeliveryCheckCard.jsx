import { HiCheckCircle, HiMapPin, HiTruck } from 'react-icons/hi2'
import { useDeliveryCheckController } from '../../controllers/useDeliveryCheckController'

// "Do you deliver to my PIN code, and what will it cost?"
//
// Real carrier rates for this product's actual lane, not a generic promise.
// A signed-in shopper's default address fills this in and answers on its own —
// being asked for a PIN code you have already saved is the small friction this
// removes.
//
// Everything it shows comes from the carrier. When the carrier cannot be
// reached, it says so rather than falling back to "we deliver everywhere":
// "could not check" and "we do not deliver there" are different answers, and
// showing the wrong one loses a sale or creates a false promise.

function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const UNAVAILABLE_COPY = {
  SHIPPING_DISABLED: 'Delivery checks are unavailable right now.',
  NO_ORIGIN: 'Delivery pricing is not set up for this item yet.',
  CARRIER_UNAVAILABLE: 'Could not reach the courier just now. Please try again in a moment.',
}

export function DeliveryCheckCard({ productId }) {
  const { pincode, setPincode, check, isChecking, result, error, fromSavedAddress, savedAddressLabel, isValid } =
    useDeliveryCheckController(productId)

  const onSubmit = (event) => {
    event.preventDefault()
    check()
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
        <HiTruck className="h-4 w-4 text-blue-600" />
        Delivery Details
      </h3>

      <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
        <form onSubmit={onSubmit} className="flex items-center justify-between gap-2">
          <label htmlFor="pincode" className="sr-only">
            Delivery PIN code
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <HiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              id="pincode"
              // type/inputMode/autoComplete together are what make the WebView
              // open a numeric keypad and offer the saved PIN code (§101, §102).
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="postal-code"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN code"
              className="w-full min-w-0 bg-transparent text-sm font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!isValid || isChecking}
            className="shrink-0 text-sm font-bold text-orange-600 disabled:opacity-40"
          >
            {isChecking ? 'Checking…' : 'Check'}
          </button>
        </form>

        {fromSavedAddress && savedAddressLabel && (
          <p className="mt-1 pl-6 text-[10px] font-medium text-slate-400">From your saved address</p>
        )}

        {(result || error) && <div className="my-3 border-t border-slate-100" />}

        {error && (
          <p role="status" className="text-xs font-bold text-red-600">
            Could not check delivery right now. Please try again.
          </p>
        )}

        {result && !result.available && (
          <p role="status" className="text-xs font-semibold text-slate-600">
            {UNAVAILABLE_COPY[result.reason] || 'Could not check delivery for this PIN code.'}
          </p>
        )}

        {result?.available && !result.serviceable && (
          <p role="status" className="text-xs font-bold text-red-600">
            Sorry, we don&apos;t deliver to {result.pincode} yet.
          </p>
        )}

        {result?.available && result.serviceable && (
          <dl role="status" className="space-y-2">
            <Row
              icon={<HiTruck className="h-4 w-4 text-slate-400" />}
              label="Prepaid Delivery"
              value={result.prepaid?.available ? formatMoney(result.prepaid.charge) : 'Not available'}
              muted={!result.prepaid?.available}
            />
            <Row
              icon={<HiTruck className="h-4 w-4 text-slate-400" />}
              label="COD Delivery"
              value={result.cod?.available ? formatMoney(result.cod.charge) : 'Not available'}
              muted={!result.cod?.available}
            />
            {result.estimatedDeliveryDate && (
              <Row
                icon={<HiCheckCircle className="h-4 w-4 text-emerald-500" />}
                label="Est. Delivery Date"
                value={formatDate(result.estimatedDeliveryDate)}
                tone="text-emerald-600"
              />
            )}
          </dl>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value, tone = 'text-slate-900', muted = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-xs font-medium text-slate-600">
        {icon}
        {label}
      </dt>
      <dd className={`text-xs font-bold ${muted ? 'text-slate-400' : tone}`}>{value}</dd>
    </div>
  )
}
