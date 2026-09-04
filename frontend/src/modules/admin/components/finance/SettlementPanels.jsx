import { Badge } from '../../../../components/ui'
import { MoneyCell, KeyValueList, SectionCard } from '../display'
import { SETTLEMENT_STATUS_LABELS, SETTLEMENT_STATUS_TONE } from '../../constants'
import { formatMoney } from '../../lib/format'

export const BATCH_LINE_COLUMNS = Object.freeze([
  {
    key: 'subOrderId',
    header: 'Sub-order',
    width: '9.5rem',
    cellClassName: 'tabular font-semibold text-slate-900',
  },
  { key: 'deliveredAt', header: 'Delivered', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'eligibleAt', header: 'Eligible', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'gross',
    header: 'Gross',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.gross} muted />,
  },
  {
    key: 'commission',
    header: 'Commission',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} muted />,
  },
  {
    key: 'tds',
    header: 'TDS',
    width: '6rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.tds} muted />,
  },
  {
    key: 'net',
    header: 'Net',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.net} />,
  },
])

// Gross less commission, TDS and deductions. Showing the subtractions rather
// than just the net is the difference between an approver who can check the
// number and one who is only clicking a button.
export function BatchMoneyRail({ batch }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="What will be paid">
        <div className="px-4 py-3">
          <KeyValueList
            items={[
              { label: 'Gross', value: formatMoney(batch.gross) },
              { label: 'Less commission', value: `− ${formatMoney(batch.commission)}` },
              { label: 'Less TDS u/s 194-O', value: `− ${formatMoney(batch.tds)}` },
              { label: 'Less deductions', value: `− ${formatMoney(batch.deductions)}` },
            ]}
          />
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-brand-600 pt-2.5">
            <span className="text-xs font-bold text-slate-900">Net payable</span>
            <span className="tabular text-base font-bold text-brand-700">
              {formatMoney(batch.net)}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Fund account">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Bank', value: batch.fundAccount.bank },
              {
                label: 'Account',
                value: <span className="tabular">{batch.fundAccount.accountMasked}</span>,
              },
              { label: 'IFSC', value: <span className="tabular">{batch.fundAccount.ifsc}</span> },
              { label: 'Mode', value: batch.mode },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  )
}

export function BatchHeaderMeta({ batch }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
      <Badge tone={SETTLEMENT_STATUS_TONE[batch.status]} dot>
        {SETTLEMENT_STATUS_LABELS[batch.status]}
      </Badge>
      <span>
        Prepared by {batch.preparedBy} at {batch.preparedAt}
      </span>
      {batch.utr && (
        <>
          <span className="text-border-strong">·</span>
          <span className="tabular">UTR {batch.utr}</span>
        </>
      )}
    </div>
  )
}
