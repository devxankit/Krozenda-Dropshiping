import { Icon, SegmentedControl } from '../../../../components/ui'
import { ACCOUNTING_RANGES } from '../../constants'
import { formatMoney } from '../display'

// The pieces the eight Accounting screens share, so each page is only its own
// figures. Money everywhere below is INTEGER PAISE — formatMoney divides.

/**
 * The range picker used by the Overview and the report runner. Picking
 * "Custom" reveals the two date inputs inline rather than opening a dialog:
 * the range is the primary control on these screens, not a side setting.
 */
export function RangePicker({ range, setRange, custom, setCustom, isIncomplete }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl items={ACCOUNTING_RANGES} activeId={range} onChange={setRange} />

      {range === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={custom.from}
            max={custom.to || undefined}
            onChange={(event) => setCustom({ ...custom, from: event.target.value })}
            className="h-control rounded-md border border-border bg-surface px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-2xs text-ink-faint">to</span>
          <input
            type="date"
            aria-label="To date"
            value={custom.to}
            min={custom.from || undefined}
            onChange={(event) => setCustom({ ...custom, to: event.target.value })}
            className="h-control rounded-md border border-border bg-surface px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {isIncomplete && (
            <span className="text-2xs text-ink-faint">Pick both dates</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A labelled block of money figures — the Sales / Seller payable / Payment
 * summaries on the Overview, and the summary above a seller's ledger.
 *
 * `rows` is [{ label, value, format, tone }]. Anything not given a format is
 * money, because on these screens almost everything is.
 */
export function SummaryCard({ title, description, rows = [], columns = 1, footer }) {
  const TONE = {
    positive: 'text-success-700',
    negative: 'text-danger-700',
    muted: 'text-ink-subtle',
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{description}</p>}
      </div>
      <dl
        className="grid gap-x-6 px-4 py-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-baseline justify-between gap-4 py-2.5 text-xs ${
              index >= columns ? 'border-t border-border-subtle' : ''
            }`}
          >
            <dt className="shrink-0 text-ink-subtle">{row.label}</dt>
            <dd className={`tabular min-w-0 truncate text-right font-semibold ${TONE[row.tone] || 'text-slate-900'}`}>
              {row.format === 'count'
                ? Number(row.value).toLocaleString('en-IN')
                : row.format === 'percent'
                  ? `${row.value}%`
                  : row.format === 'text'
                    ? row.value
                    : formatMoney(row.value)}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="border-t border-border px-4 py-3 text-2xs text-ink-subtle">{footer}</div>}
    </section>
  )
}

/**
 * A worked calculation — gross, the things taken off it, and the net.
 *
 * This is the shape an operator checks a settlement or a transaction against,
 * so it renders as an actual sum with a rule above the total rather than as a
 * list of unrelated figures.
 *
 * `lines` is [{ label, value, sign }] where sign is '+' or '-'.
 */
export function MoneyBreakdown({ lines = [], total, totalLabel = 'Net payable', className = '' }) {
  return (
    <div className={`px-4 py-3 ${className}`}>
      <dl className="flex flex-col">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4 py-1.5 text-xs">
            <dt className="text-ink-subtle">{line.label}</dt>
            <dd
              className={`tabular font-medium ${
                line.sign === '-' ? 'text-danger-700' : 'text-slate-900'
              }`}
            >
              {line.sign === '-' ? '−' : ''}
              {formatMoney(Math.abs(line.value))}
            </dd>
          </div>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-border-strong pt-2.5">
          <dt className="text-xs font-semibold text-slate-900">{totalLabel}</dt>
          <dd
            className={`tabular text-base font-bold ${total < 0 ? 'text-danger-700' : 'text-slate-900'}`}
          >
            {total < 0 ? '−' : ''}
            {formatMoney(Math.abs(total))}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * The empty state for an accounting surface. Deliberately says that there is
 * no DATA rather than showing a zero that could be mistaken for a real
 * balance — on these screens the difference matters.
 */
export function AccountingEmpty({ title = 'No accounting data found', hint, icon = 'ledger' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-muted/40 px-6 py-14 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-ink-faint">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {hint && <p className="max-w-sm text-xs leading-relaxed text-ink-subtle">{hint}</p>}
    </div>
  )
}

/**
 * A labelled value in a detail view. Supports a mono treatment for the
 * identifiers (UTR, transaction id, gateway reference) an operator copies.
 */
export function DetailField({ label, value, mono = false, tone }) {
  const TONE = { muted: 'text-ink-subtle', positive: 'text-success-700', negative: 'text-danger-700' }
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-2xs font-medium uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd
        className={`break-words text-xs font-medium ${mono ? 'tabular' : ''} ${TONE[tone] || 'text-slate-900'}`}
      >
        {value === null || value === undefined || value === '' ? (
          <span className="text-ink-faint">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
