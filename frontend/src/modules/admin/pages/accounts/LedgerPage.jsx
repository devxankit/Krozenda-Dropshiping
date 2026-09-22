import { useState } from 'react'
import { Input, Pagination, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { MoneyCell, DateCell } from '../../components/display'
import { useLedgerController } from '../../controllers/useAccountsController'

// Accounts MVP — ledger. One row per order with its full financial
// breakdown (customer paid, vendor cost, gateway fee, refunds, profit).
// Read-only, same date-range filter pattern as AccountsDashboardPage.

export function LedgerPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const list = useLedgerController({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const columns = [
    {
      key: 'id',
      header: 'Order',
      render: (row) => (
        <span className="tabular font-semibold text-slate-900 text-sm">#{row.id.slice(-8).toUpperCase()}</span>
      ),
    },
    { key: 'createdAt', header: 'Date', render: (row) => <DateCell value={row.createdAt} /> },
    { key: 'total', header: 'Customer Paid', align: 'right', render: (row) => <MoneyCell amount={row.total} /> },
    {
      key: 'vendorCost',
      header: 'Vendor Cost',
      align: 'right',
      render: (row) => <MoneyCell amount={row.vendorCost} muted />,
    },
    {
      key: 'gatewayFee',
      header: 'Gateway Fee',
      align: 'right',
      render: (row) => <MoneyCell amount={row.gatewayFee} muted />,
    },
    {
      key: 'refunds',
      header: 'Refunds',
      align: 'right',
      render: (row) => <MoneyCell amount={row.refunds} className={row.refunds > 0 ? 'text-danger-700' : ''} />,
    },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      render: (row) => <MoneyCell amount={row.profit} className={row.profit < 0 ? 'text-danger-700' : 'text-emerald-700'} />,
    },
  ]

  if (list.isLoading && list.items.length === 0 && !list.error) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Ledger"
        description="Every order's financial breakdown — customer paid, vendor cost, gateway fee, refunds and profit."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <Input type="date" size="control" value={startDate} onChange={(e) => setStartDate(e.target.value)} containerClassName="w-40" />
          <span className="text-xs text-ink-subtle">to</span>
          <Input type="date" size="control" value={endDate} onChange={(e) => setEndDate(e.target.value)} containerClassName="w-40" />
        </div>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <Table
              columns={columns}
              data={list.items}
              getRowKey={(row) => row.id}
              density="comfortable"
              isLoading={list.isFetching}
            />
          </div>
          {list.totalItems > 0 && (
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              totalItems={list.totalItems}
              rowsPerPage={list.rowsPerPage}
              onPageChange={list.setPage}
              itemLabel="orders"
            />
          )}
        </>
      )}
    </PageBody>
  )
}
