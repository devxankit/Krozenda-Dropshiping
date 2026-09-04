import { BUYER_TYPE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONE } from '../../constants'
import { KeyValueList, MoneyCell, SectionCard, StatusPill } from '../display'

function TotalRow({ label, amount, strong = false, negative = false }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 text-xs ${strong ? 'border-t border-border pt-2' : ''}`}
    >
      <span className={strong ? 'font-semibold text-slate-900' : 'text-ink-subtle'}>{label}</span>
      <span className="tabular font-semibold text-slate-900">
        {negative && '− '}
        <MoneyCell amount={Math.abs(amount)} muted={!strong} className="inline" />
      </span>
    </div>
  )
}

export function OrderSummaryRail({ order }) {
  const { buyer, shippingAddress, payment, totals } = order

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Money">
        <div className="px-4 py-3">
          <TotalRow label="Items subtotal" amount={totals.subtotal} />
          <TotalRow label="GST" amount={totals.tax} />
          <TotalRow label="Shipping" amount={totals.shipping} />
          {totals.discount > 0 && <TotalRow label="Discount" amount={totals.discount} negative />}
          <TotalRow label="Customer paid" amount={totals.total} strong />
          <div className="mt-3 rounded-md bg-brand-50 px-3 py-2">
            <TotalRow label="Platform commission" amount={totals.commission} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Payment">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              {
                label: 'Status',
                value: (
                  <StatusPill
                    status={payment.status}
                    labels={PAYMENT_STATUS_LABELS}
                    tones={PAYMENT_STATUS_TONE}
                    size="sm"
                  />
                ),
              },
              { label: 'Method', value: payment.method },
              { label: 'Reference', value: <span className="tabular">{payment.reference}</span> },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Customer">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Name', value: buyer.name },
              { label: 'Type', value: BUYER_TYPE_LABELS[buyer.type] },
              { label: 'Phone', value: <span className="tabular">{buyer.phone}</span> },
              { label: 'Email', value: buyer.email },
              ...(buyer.gstin
                ? [{ label: 'GSTIN', value: <span className="tabular">{buyer.gstin}</span> }]
                : []),
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Ship to">
        <address className="px-4 py-3 text-xs not-italic leading-relaxed text-ink-muted">
          <span className="block font-medium text-slate-900">{buyer.name}</span>
          {shippingAddress.line1}
          <br />
          {shippingAddress.line2 && (
            <>
              {shippingAddress.line2}
              <br />
            </>
          )}
          {shippingAddress.city}, {shippingAddress.state}{' '}
          <span className="tabular">{shippingAddress.pincode}</span>
        </address>
      </SectionCard>
    </div>
  )
}
