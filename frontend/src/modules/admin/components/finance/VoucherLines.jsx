import { Button, Icon, Input, Select } from '../../../../components/ui'
import { formatRupees, toPaise, toRupeeInput } from '../../lib/money'

const BLANK = { code: '', debit: 0, credit: 0 }

// The editable half of a journal voucher. It shows the running debit and
// credit totals against each other, because the one thing an operator needs
// to know before posting is whether the entry balances — and finding that out
// only after pressing Save is how bad entries get made twice.
export function VoucherLines({ lines, onChange, accounts = [], disabled }) {
  const debit = lines.reduce((total, line) => total + line.debit, 0)
  const credit = lines.reduce((total, line) => total + line.credit, 0)
  const difference = debit - credit
  const balanced = difference === 0 && debit > 0

  const options = accounts.map((account) => ({
    value: account.code,
    label: `${account.code} · ${account.name}`,
  }))

  const setLine = (index, patch) =>
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)))

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_7.5rem_7.5rem_2rem] items-center gap-2 px-1">
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Account</span>
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Debit</span>
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Credit</span>
        <span className="sr-only">Remove</span>
      </div>

      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[1fr_7.5rem_7.5rem_2rem] items-center gap-2">
          <Select
            id={`line-${index}-account`}
            size="control"
            placeholder="Pick an account"
            options={options}
            value={line.code}
            disabled={disabled}
            onChange={(event) => setLine(index, { code: event.target.value })}
          />
          <Input
            id={`line-${index}-debit`}
            size="control"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular text-right"
            disabled={disabled}
            value={toRupeeInput(line.debit)}
            // A line is one side or the other; typing in one clears the other.
            onChange={(event) => setLine(index, { debit: toPaise(event.target.value), credit: 0 })}
          />
          <Input
            id={`line-${index}-credit`}
            size="control"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular text-right"
            disabled={disabled}
            value={toRupeeInput(line.credit)}
            onChange={(event) => setLine(index, { credit: toPaise(event.target.value), debit: 0 })}
          />
          <button
            type="button"
            aria-label={`Remove line ${index + 1}`}
            disabled={disabled || lines.length <= 2}
            onClick={() => onChange(lines.filter((_, position) => position !== index))}
            className="rounded p-1 text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:pointer-events-none disabled:opacity-30"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          icon="add"
          disabled={disabled}
          onClick={() => onChange([...lines, { ...BLANK }])}
        >
          Add line
        </Button>

        <div className="flex items-center gap-4 text-xs">
          <span className="tabular text-ink-muted">Dr {formatRupees(debit)}</span>
          <span className="tabular text-ink-muted">Cr {formatRupees(credit)}</span>
          <span
            className={`tabular font-semibold ${balanced ? 'text-success-700' : 'text-danger-700'}`}
          >
            {balanced ? 'Balanced' : `Out by ${formatRupees(Math.abs(difference))}`}
          </span>
        </div>
      </div>
    </div>
  )
}
