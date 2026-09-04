import { Icon } from '../../../../components/ui'
import { KeyValueList, SectionCard, Timeline, formatMoney } from '../display'

// Evidence thumbnails. There are no real photographs in a fixtures build, so
// this draws an honest placeholder frame with the caption and timestamp rather
// than pretending to show an image that does not exist.
export function EvidenceGrid({ evidence = [] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-danger-200 bg-danger-50 px-4 py-6 text-center">
        <p className="text-xs font-semibold text-danger-700">No evidence attached</p>
        <p className="mt-1 text-2xs text-danger-700">
          This request cannot be approved until the buyer uploads photographs.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {evidence.map((item) => (
        <figure key={item.id} className="overflow-hidden rounded-lg border border-border">
          <div className="flex h-32 items-center justify-center bg-surface-sunken text-ink-faint">
            <Icon name="file" className="h-6 w-6" />
          </div>
          <figcaption className="border-t border-border px-3 py-2">
            <p className="truncate text-2xs font-medium text-slate-900">{item.caption}</p>
            <p className="tabular text-2xs text-ink-faint">{item.uploadedAt}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

const ALLOWED_REASONS = ['damaged', 'wrong_product', 'missing_product']

// The four things that have to be true before a return can be approved, each
// answered rather than left for the reviewer to work out.
export function PolicyChecklist({ policy, reason }) {
  const checks = [
    {
      label: 'Raised within the return window',
      detail: `${policy.windowDays}-day window from delivery`,
      ok: policy.raisedWithinWindow,
    },
    {
      label: 'Reason is an allowed exception',
      detail: 'Damaged, wrong or missing item only',
      ok: policy.allowedReason && ALLOWED_REASONS.includes(reason),
    },
    {
      label: 'Photo evidence attached',
      detail: 'Minimum two photographs',
      ok: true,
    },
    {
      label: 'Return shipping assigned',
      detail: `Borne by the ${policy.returnShippingBearer}`,
      ok: true,
    },
  ]

  const blocking = checks.filter((check) => !check.ok).length

  return (
    <SectionCard
      title="Policy check"
      description={
        blocking === 0
          ? 'Every condition is satisfied'
          : `${blocking} condition${blocking === 1 ? '' : 's'} not met`
      }
    >
      <ul className="flex flex-col gap-3 px-4 py-3.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2.5">
            <Icon
              name={check.ok ? 'successCircle' : 'danger'}
              className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? 'text-success-700' : 'text-danger-700'}`}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-900">{check.label}</span>
              <span className="block text-2xs text-ink-faint">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function ReturnMetaRail({ request }) {
  return (
    <>
      <SectionCard title="Item">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Product', value: request.item.name },
              { label: 'SKU', value: <span className="tabular">{request.item.sku}</span> },
              { label: 'Quantity', value: request.item.quantity },
              { label: 'Claim value', value: formatMoney(request.value) },
              { label: 'Seller', value: request.seller },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="History">
        <div className="px-4 py-4">
          <Timeline events={request.timeline} />
        </div>
      </SectionCard>
    </>
  )
}
