import { useState } from 'react'
import { Icon, Input } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { useAccountsDashboardController } from '../../controllers/useAccountsController'
import { formatMoney } from '../../lib/format'

// Accounts MVP — dashboard. Deliberately separate from the existing
// Accounting module's overview screen (pages/accounting/AccountingOverviewPage.jsx):
// this is a minimal, order-level revenue/cost/profit summary only.

const CARDS = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: 'trendUp', tone: 'text-brand-600 bg-brand-50 ring-brand-500/10' },
  { key: 'totalVendorCost', label: 'Vendor Cost', icon: 'sellers', tone: 'text-warning-600 bg-warning-50 ring-warning-500/10' },
  { key: 'totalGatewayFee', label: 'Gateway Fees', icon: 'settlements', tone: 'text-slate-600 bg-slate-100 ring-slate-500/10' },
  { key: 'totalRefunds', label: 'Refunds', icon: 'returns', tone: 'text-danger-600 bg-danger-50 ring-danger-500/10' },
  { key: 'netProfit', label: 'Net Profit', icon: 'money', tone: 'text-success-600 bg-success-50 ring-success-500/10' },
  { key: 'pendingPayoutTotal', label: 'Pending Payouts', icon: 'ledger', tone: 'text-warning-600 bg-warning-50 ring-warning-500/10' },
]

export function AccountsDashboardPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedRange, setAppliedRange] = useState({})

  const { data, isLoading, error, refetch } = useAccountsDashboardController(appliedRange)

  if (isLoading && !data) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (error && !data) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Accounts Dashboard"
        description="Order-level revenue, vendor cost, gateway fees and profit for a date range."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              size="control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              containerClassName="w-40"
            />
            <span className="text-xs text-ink-subtle">to</span>
            <Input
              type="date"
              size="control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              containerClassName="w-40"
            />
            <button
              type="button"
              onClick={() =>
                setAppliedRange({ startDate: startDate || undefined, endDate: endDate || undefined })
              }
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all disabled:opacity-50"
            >
              <Icon name={isLoading ? 'refresh' : 'search'} className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Apply</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">{card.label}</span>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${card.tone}`}>
                <Icon name={card.icon} className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 tabular">
              {formatMoney(data?.[card.key] ?? 0)}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Order Count</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10">
              <Icon name="orders" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 tabular">
            {(data?.orderCount ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </PageBody>
  )
}
