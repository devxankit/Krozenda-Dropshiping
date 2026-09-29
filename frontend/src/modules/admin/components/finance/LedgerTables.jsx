import { SectionCard } from '../display'
import { formatMoney } from '../../lib/format'

// A vendor statement has a running balance, so it is its own table rather
// than a generic one.

function Head({ children, align = 'left', width }) {
  return (
    <th
      className={`px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint text-${align}`}
      style={width ? { width } : undefined}
    >
      {children}
    </th>
  )
}

export function VendorStatementTable({ statement, debits, credits }) {
  return (
    <SectionCard title="Movements" description={statement.period}>
      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-xs">
          <thead>
            <tr className="border-y border-border bg-surface-muted">
              <Head width="7rem">Date</Head>
              <Head>Particulars</Head>
              <Head width="12rem">Reference</Head>
              <Head align="right" width="7rem">
                Debit
              </Head>
              <Head align="right" width="7rem">
                Credit
              </Head>
              <Head align="right" width="8rem">
                Balance
              </Head>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-subtle bg-surface-muted/60">
              <td className="px-4 py-2 text-ink-muted" colSpan={5}>
                Opening balance
              </td>
              <td className="tabular px-4 py-2 text-right font-semibold text-slate-900">
                {formatMoney(statement.opening)}
              </td>
            </tr>
            {statement.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border-subtle">
                <td className="px-4 py-2 text-ink-muted">{entry.date}</td>
                <td className="px-4 py-2 text-slate-800">{entry.particulars}</td>
                <td className="tabular px-4 py-2 text-2xs text-ink-faint">{entry.reference}</td>
                <td className="tabular px-4 py-2 text-right text-slate-800">
                  {entry.debit ? formatMoney(entry.debit) : '—'}
                </td>
                <td className="tabular px-4 py-2 text-right text-slate-800">
                  {entry.credit ? formatMoney(entry.credit) : '—'}
                </td>
                <td className="tabular px-4 py-2 text-right font-semibold text-slate-900">
                  {formatMoney(entry.balance)}
                </td>
              </tr>
            ))}
            <tr className="border-y-2 border-brand-600 bg-brand-50/40 font-bold text-slate-900">
              <td className="px-4 py-2.5" colSpan={3}>
                Closing balance
              </td>
              <td className="tabular px-4 py-2.5 text-right">{formatMoney(debits)}</td>
              <td className="tabular px-4 py-2.5 text-right">{formatMoney(credits)}</td>
              <td className="tabular px-4 py-2.5 text-right">{formatMoney(statement.closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
