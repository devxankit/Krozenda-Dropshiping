import { Link } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { KpiGrid } from '../../components/dashboard'
import { formatMoney } from '../../components/display'
import { AccountingEmpty, RangePicker, SummaryCard } from '../../components/accounting/AccountingShell'
import { TypeBadge } from '../../components/accounting/AccountingCells'
import { useAccountingOverviewController } from '../../controllers/useAccountingController'

// /admin/accounting — the marketplace's money, in one screen.
//
// Every figure here is the backend's aggregation over the ledger. Nothing is
// computed in this component, precisely so the Overview and the Reports can
// never quietly disagree about the same number.

function RecentTransactions({ rows }) {
  if (rows.length === 0) {
    return (
      <AccountingEmpty
        title="No transactions yet"
        hint="Entries appear here the moment an order is paid for, a commission is charged or a payout completes."
        icon="money"
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent transactions</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">The latest entries on the ledger</p>
        </div>
        <Link
          to={ADMIN_ROUTES.ACCOUNTING_TRANSACTIONS}
          className="shrink-0 text-xs font-medium text-brand-700 hover:text-brand-600"
        >
          View all
        </Link>
      </div>

      {/* Scrolls rather than reflowing on a phone: these are figures in
          columns, and stacking them into cards loses the comparison. */}
      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-muted text-2xs uppercase tracking-wider text-ink-muted">
              <th className="px-4 py-2 text-left font-semibold">Transaction</th>
              <th className="px-4 py-2 text-left font-semibold">Type</th>
              <th className="px-4 py-2 text-left font-semibold">Order</th>
              <th className="px-4 py-2 text-left font-semibold">Seller</th>
              <th className="px-4 py-2 text-right font-semibold">Amount</th>
              <th className="px-4 py-2 text-left font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-surface-muted/60">
                <td className="px-4 py-2.5">
                  <Link
                    to={adminPath.accountingTransaction(row.id)}
                    className="tabular font-medium text-brand-700 hover:text-brand-600"
                  >
                    {row.transactionId}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <TypeBadge type={row.type} />
                </td>
                <td className="tabular px-4 py-2.5 text-ink-muted">{row.orderNumber || '—'}</td>
                <td className="px-4 py-2.5 text-ink-muted">{row.seller}</td>
                <td
                  className={`tabular px-4 py-2.5 text-right font-semibold ${
                    row.direction === 'CREDIT' ? 'text-success-700' : 'text-danger-700'
                  }`}
                >
                  {row.direction === 'CREDIT' ? '' : '−'}
                  {formatMoney(row.amount)}
                </td>
                <td className="px-4 py-2.5 text-ink-faint">
                  {new Date(row.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function AccountingOverviewPage() {
  const { data, isLoading, error, refetch, range } = useAccountingOverviewController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const { salesSummary, sellerPayableSummary, paymentSummary } = data
  // "No data" is a real answer, and saying so beats ten cards of ₹0 that read
  // like a broken screen.
  const hasAnything =
    salesSummary.orders > 0 || data.recentTransactions.length > 0 || sellerPayableSummary.totalPayable !== 0

  return (
    <PageBody>
      <PageHeader
        title="Accounting"
        description="Where the marketplace's money is: what was sold, what is owed, and what has been paid."
        actions={<RangePicker {...range} />}
      />

      {!hasAnything ? (
        <AccountingEmpty
          title="No accounting data found"
          hint={
            range.range === 'all'
              ? 'Nothing has been posted to the ledger yet. Entries appear as soon as an order is paid for.'
              : 'Nothing was posted in this period. Try a wider range.'
          }
        />
      ) : (
        <>
          <KpiGrid kpis={data.kpis} columns={5} />

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <SummaryCard
              title="Sales summary"
              description="What was sold in this period"
              rows={[
                { label: 'Gross sales', value: salesSummary.grossSales },
                { label: 'Discounts', value: salesSummary.discounts, tone: 'muted' },
                { label: 'Refunds', value: salesSummary.refunds, tone: 'negative' },
                { label: 'Net sales', value: salesSummary.netSales },
                { label: 'Orders', value: salesSummary.orders, format: 'count' },
              ]}
            />

            <SummaryCard
              title="Seller payable"
              description="What the platform owes, by where it is"
              rows={[
                { label: 'Total payable', value: sellerPayableSummary.totalPayable },
                { label: 'Settlement pending', value: sellerPayableSummary.settlementPending },
                { label: 'Settlement eligible', value: sellerPayableSummary.settlementEligible },
                { label: 'On hold', value: sellerPayableSummary.onHold, tone: 'muted' },
                { label: 'Already paid', value: sellerPayableSummary.alreadyPaid, tone: 'positive' },
              ]}
              footer={
                <Link to={ADMIN_ROUTES.ACCOUNTING_SETTLEMENTS} className="text-brand-700 hover:text-brand-600">
                  Go to settlements →
                </Link>
              }
            />

            <SummaryCard
              title="Payments"
              description="How buyers paid"
              rows={[
                { label: 'Online payments', value: paymentSummary.online },
                { label: 'COD payments', value: paymentSummary.cod },
                { label: 'Failed payments', value: paymentSummary.failed, tone: 'muted' },
                { label: 'Refunded payments', value: paymentSummary.refunded, tone: 'negative' },
              ]}
              footer={
                <span className="flex items-center gap-1.5">
                  <Icon name="info" className="h-3 w-3 shrink-0" />
                  COD counts only once the courier has remitted it.
                </span>
              }
            />
          </div>

          <RecentTransactions rows={data.recentTransactions} />
        </>
      )}
    </PageBody>
  )
}
