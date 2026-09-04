import { formatMoney } from '../../lib/format'

// A comparative financial statement: groups, lines, subtotals and one total,
// with the prior period beside it. Accounting tables have their own typographic
// rules — right-aligned tabular figures, a rule above a subtotal, a double rule
// on the bottom line — and this is where they live.

const ROW_CLASS = Object.freeze({
  group:
    'bg-surface-muted text-2xs font-semibold uppercase tracking-wider text-ink-subtle border-y border-border',
  line: 'text-ink-muted',
  subtotal: 'border-t border-border-strong font-semibold text-slate-900',
  total:
    'border-y-2 border-brand-600 bg-brand-50/40 text-sm font-bold text-slate-900',
})

function Change({ current, prior, invert }) {
  if (!prior) return <span className="text-ink-faint">—</span>
  const delta = ((current - prior) / Math.abs(prior)) * 100
  // On an expense line, going up is bad — so the tone is inverted rather than
  // the arithmetic.
  const good = invert ? delta < 0 : delta > 0
  return (
    <span className={`tabular font-semibold ${good ? 'text-success-700' : 'text-danger-700'}`}>
      {delta > 0 ? '+' : '−'}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export function Statement({ statement, showShare = true, expenseFrom }) {
  const incomeTotal =
    statement.lines.find((line) => line.label.toLowerCase().startsWith('total income'))?.current || 0

  // Everything after the first expense heading is an expense line, so the
  // flag is a pure index comparison — no variable is mutated during render.
  const expenseStart = expenseFrom
    ? statement.lines.findIndex((line) => line.kind === 'group' && line.label === expenseFrom)
    : -1
  const rows = statement.lines.map((line, index) => ({
    ...line,
    isExpense: expenseStart >= 0 && index > expenseStart,
  }))

  return (
    <div className="admin-scroll overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[42rem] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              Account
            </th>
            <th className="w-32 px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              This period
            </th>
            <th className="w-32 px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              Prior period
            </th>
            <th className="w-24 px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              Change
            </th>
            {showShare && (
              <th className="w-24 px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                % of income
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((line, index) => {
            if (line.kind === 'group') {
              return (
                <tr key={`${line.label}-${index}`} className={ROW_CLASS.group}>
                  <td colSpan={showShare ? 5 : 4} className="px-4 py-2">
                    {line.label}
                  </td>
                </tr>
              )
            }

            return (
              <tr
                key={`${line.label}-${index}`}
                className={`border-b border-border-subtle last:border-b-0 ${ROW_CLASS[line.kind]}`}
              >
                <td className={`px-4 py-2 ${line.kind === 'line' ? 'pl-8' : ''}`}>{line.label}</td>
                <td className="tabular px-4 py-2 text-right">{formatMoney(line.current)}</td>
                <td className="tabular px-4 py-2 text-right text-ink-subtle">
                  {line.prior ? formatMoney(line.prior) : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Change current={line.current} prior={line.prior} invert={line.isExpense} />
                </td>
                {showShare && (
                  <td className="tabular px-4 py-2 text-right text-ink-subtle">
                    {incomeTotal ? `${((line.current / incomeTotal) * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
