import { useDeferredValue, useState } from 'react'
import { HiOutlineCheck, HiOutlineMagnifyingGlass, HiOutlineXMark } from 'react-icons/hi2'
import { FormDrawer } from '../forms/FormDrawer'
import { InlineAlert } from '../feedback'
import { useCouponWhatsappController } from '../../controllers/useMarketingController'

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All customers', description: 'Every customer this coupon is valid for' },
  { value: 'specific', label: 'Specific customers', description: 'Pick one or more customers by name or mobile' },
]

const ELIGIBILITY_NOTE = {
  NEW: 'This coupon is for new customers, so only customers with no orders yet will get it.',
  EXISTING: 'This coupon is for existing customers, so only customers who have ordered before will get it.',
  SPECIFIC: 'This coupon is limited to specific customers — only the ones on the coupon will get it.',
}

// The coupon list serializes money in paise; the template shows rupees.
const rupees = (paise) => `Rs.${(Number(paise || 0) / 100).toLocaleString('en-IN')}`

function offerText(coupon) {
  let offer =
    coupon.discountType === 'PERCENTAGE'
      ? `${coupon.discountValue}% off${coupon.maxDiscountAmount != null ? ` (up to ${rupees(coupon.maxDiscountAmount)})` : ''}`
      : `${rupees(coupon.discountValue)} off`
  if (coupon.applicableTo !== 'ALL') offer += ' on selected items'
  return offer
}

function formatDate(value) {
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function CouponWhatsappDrawer({ coupon, onClose }) {
  const [audience, setAudience] = useState('all')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState([])
  const deferredSearch = useDeferredValue(search.trim())

  const wa = useCouponWhatsappController(coupon.id, {
    onSent: onClose,
    search: deferredSearch,
    wantsCustomers: audience === 'specific',
  })
  const blocked = wa.stats?.blockedReason
  const canSubmit = !blocked && (audience === 'all' || picked.length > 0)

  function toggle(customer) {
    setPicked((list) => (list.some((c) => c.id === customer.id) ? list.filter((c) => c.id !== customer.id) : [...list, customer]))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    wa.send.run({
      id: coupon.id,
      audience,
      customerIds: audience === 'specific' ? picked.map((c) => c.id) : undefined,
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={`Send ${coupon.code} on WhatsApp`}
      description="Sends the approved coupon_offer template. A customer who already got this coupon is never messaged twice."
      submitLabel={audience === 'all' ? 'Send to all' : `Send to ${picked.length || ''} customer${picked.length === 1 ? '' : 's'}`}
      isSubmitting={wa.send.isSubmitting}
      canSubmit={canSubmit}
      error={wa.send.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      {blocked && (
        <InlineAlert tone="warning" title="WhatsApp can't send this coupon yet">
          {blocked}
        </InlineAlert>
      )}

      {wa.stats && (wa.stats.sent > 0 || wa.stats.failed > 0 || wa.stats.sending > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Sent', wa.stats.sent, 'text-success-700'],
            ['Sending', wa.stats.sending, 'text-brand-700'],
            ['Failed', wa.stats.failed, 'text-danger-700'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-2xs font-semibold uppercase text-slate-500">{label}</p>
              <p className={`text-lg font-bold ${tone}`}>{value.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <span className="block text-xs font-bold text-slate-800">Send to</span>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {AUDIENCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                audience === option.value ? 'border-brand-500 bg-brand-50/70 shadow-2xs' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={option.value}
                checked={audience === option.value}
                onChange={() => setAudience(option.value)}
                className="mt-0.5 text-brand-600"
              />
              <span className="flex-1">
                <span className="block text-xs font-bold text-slate-900">{option.label}</span>
                <span className="mt-0.5 block text-2xs leading-tight text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {ELIGIBILITY_NOTE[coupon.customerEligibility] && (
          <p className="text-2xs text-slate-600">{ELIGIBILITY_NOTE[coupon.customerEligibility]}</p>
        )}

        {audience === 'specific' && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-semibold text-brand-800">
                    {c.name || c.phone}
                    <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c.name || c.phone}`}>
                      <HiOutlineXMark className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer by name, mobile or email..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none"
              />
            </div>

            {wa.isLoadingCustomers ? (
              <div className="py-4 text-center text-xs text-slate-500">Loading customers...</div>
            ) : wa.customers.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                {search ? 'No matching customers found.' : 'No customers with a mobile number yet.'}
              </div>
            ) : (
              <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {wa.customers.map((c) => {
                  const isPicked = picked.some((p) => p.id === c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c)}
                      className={`flex w-full items-center justify-between p-2.5 text-left transition-colors ${isPicked ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-900">{c.name || 'Unnamed customer'}</span>
                        <span className="block truncate text-2xs text-slate-500">
                          {c.phone}
                          {c.email ? ` · ${c.email}` : ''}
                        </span>
                      </span>
                      {isPicked ? (
                        <HiOutlineCheck className="ml-2 h-4 w-4 shrink-0 text-success-600" />
                      ) : (
                        <span className="ml-2 shrink-0 text-2xs font-semibold text-brand-600">Select</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-success-200 bg-success-50/60 p-4">
        <p className="mb-2 text-2xs font-bold uppercase text-success-800">Message preview</p>
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-800">
          {`Hi {name}, here is a special offer from Krozenda just for you! 🎁

Use code *${coupon.code}* to get ${offerText(coupon)} on your next order.
Minimum order value: ${coupon.minOrderAmount > 0 ? rupees(coupon.minOrderAmount) : 'no minimum'}
Valid till: ${formatDate(coupon.endDate)}

Apply the code at checkout in the Krozenda app. Happy shopping!`}
        </p>
      </div>
    </FormDrawer>
  )
}
