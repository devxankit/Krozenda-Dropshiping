import {
  ORDER_FLOW_STATUS,
  ORDER_FLOW_STATUS_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_TONE,
} from '../../constants'
import { Button } from '../../../../components/ui'
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

const NEXT_STATUS = Object.freeze({
  [ORDER_FLOW_STATUS.PENDING]: [ORDER_FLOW_STATUS.PROCESSING, ORDER_FLOW_STATUS.CANCELLED],
  [ORDER_FLOW_STATUS.PROCESSING]: [ORDER_FLOW_STATUS.SHIPPED, ORDER_FLOW_STATUS.CANCELLED],
  [ORDER_FLOW_STATUS.SHIPPED]: [ORDER_FLOW_STATUS.DELIVERED, ORDER_FLOW_STATUS.CANCELLED],
  [ORDER_FLOW_STATUS.DELIVERED]: [],
  [ORDER_FLOW_STATUS.CANCELLED]: [],
})

export function OrderSummaryRail({ order, onStatusChange, isUpdatingStatus }) {
  const { customer, shippingAddress, subtotal, discountAmount, shippingFee, total, paymentMethod, paymentStatus } =
    order
  const nextOptions = NEXT_STATUS[order.status] || []

  return (
    <div className="flex flex-col gap-4">
      {nextOptions.length > 0 && (
        <SectionCard title="Update status">
          <div className="flex flex-wrap gap-2 p-4">
            {nextOptions.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={status === 'CANCELLED' ? 'dangerOutline' : 'secondary'}
                isLoading={isUpdatingStatus}
                onClick={() => onStatusChange(status)}
              >
                Mark {ORDER_FLOW_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Money">
        <div className="px-4 py-3">
          <TotalRow label="Items subtotal" amount={subtotal} />
          <TotalRow label="Shipping" amount={shippingFee} />
          {discountAmount > 0 && <TotalRow label="Discount" amount={discountAmount} negative />}
          <TotalRow label="Total" amount={total} strong />
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
                    status={paymentStatus}
                    labels={ORDER_PAYMENT_STATUS_LABELS}
                    tones={ORDER_PAYMENT_STATUS_TONE}
                    size="sm"
                  />
                ),
              },
              { label: 'Method', value: ORDER_PAYMENT_METHOD_LABELS[paymentMethod] },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Customer">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Name', value: customer.name || '—' },
              { label: 'Phone', value: <span className="tabular">{customer.mobileNumber || '—'}</span> },
              { label: 'Email', value: customer.email || '—' },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Ship to">
        <address className="px-4 py-3 text-xs not-italic leading-relaxed text-ink-muted">
          <span className="block font-medium text-slate-900">{shippingAddress.fullName}</span>
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
          <br />
          <span className="tabular">{shippingAddress.phone}</span>
        </address>
      </SectionCard>
    </div>
  )
}
