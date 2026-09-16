import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { DataTable } from '../../components/data/DataTable'
import { FilterBar } from '../../components/data/FilterBar'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { AccountingEmpty, SummaryCard } from '../../components/accounting/AccountingShell'
import { AdjustmentDialog } from '../../components/accounting/AccountingDialogs'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import { ACCOUNTING_TXN_TYPE, ACCOUNTING_TXN_TYPE_LABELS, ADMIN_PERMISSIONS } from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import {
  useAdjustmentController,
  useSellerLedgerController,
  useSellerLedgerListController,
} from '../../controllers/useAccountingController'

// /admin/accounting/seller-ledger — seller-wise financial history.
//
// A seller's balance is the ledger and nothing else: credits minus debits over
// their entries. There is no stored balance field to drift out of agreement
// with it, which is why the running-balance column can be trusted.

const withSerial = (items, page, rowsPerPage) =>
  items.map((row, index) => ({ ...row, sn: (page - 1) * rowsPerPage + index + 1 }))

export function SellerLedgerListPage() {
  const list = useSellerLedgerListController()
  const rows = withSerial(list.items, list.page, list.rowsPerPage)

  function exportCsv() {
    downloadCsv('seller-ledgers.csv', [
      {
        title: 'Seller ledgers',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Seller', value: (row) => row.seller },
          { header: 'Total sales', value: (row) => rupees(row.totalSales) },
          { header: 'Commission', value: (row) => rupees(row.totalCommission) },
          { header: 'Fees', value: (row) => rupees(row.totalFees) },
          { header: 'Refunds', value: (row) => rupees(row.totalRefunds) },
          { header: 'Adjustments', value: (row) => rupees(row.totalAdjustments) },
          { header: 'Paid out', value: (row) => rupees(row.totalPaid) },
          { header: 'Current payable', value: (row) => rupees(row.currentPayable) },
          { header: 'On hold', value: (row) => rupees(row.onHold) },
          { header: 'Available for settlement', value: (row) => rupees(row.availableForSettlement) },
        ],
        rows,
      },
    ])
  }

  return (
    <ListScreen
      title="Seller ledger"
      description="What each seller has earned, what has been taken off it, and what is still owed."
      actions={<ExportMenu onExport={exportCsv} />}
      controller={{ ...list, items: rows }}
      columns={columns.SELLER_LEDGER_COLUMNS}
      tabs={columns.SELLER_LEDGER_TABS}
      searchPlaceholder="Seller name…"
      itemLabel="sellers"
      emptyIcon="ledger"
      emptyTitle="No seller ledgers yet"
      emptyDescription="A seller appears here as soon as their first sale is posted."
    />
  )
}

// ---------------------------------------------------------------------------
// One seller's statement
// ---------------------------------------------------------------------------

const LEDGER_FILTERS = Object.freeze([
  {
    key: 'type',
    label: 'Entry type',
    options: Object.values(ACCOUNTING_TXN_TYPE).map((value) => ({
      value,
      label: ACCOUNTING_TXN_TYPE_LABELS[value],
    })),
  },
])

export function SellerLedgerDetailPage() {
  const { sellerId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch, filters, changeFilters, setPage } =
    useSellerLedgerController(sellerId)
  const [adjusting, setAdjusting] = useState(false)
  const adjustment = useAdjustmentController({ onDone: () => setAdjusting(false) })

  const entries = useMemo(() => data?.ledger.items ?? [], [data])

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

  const { summary } = data

  function exportCsv() {
    downloadCsv(`seller-ledger-${data.seller.replace(/\s+/g, '-').toLowerCase()}.csv`, [
      {
        title: `${data.seller} — summary`,
        columns: [
          { header: 'Measure', value: (row) => row.label },
          { header: 'Amount', value: (row) => rupees(row.value) },
        ],
        rows: [
          { label: 'Total sales', value: summary.totalSales },
          { label: 'Commission', value: summary.totalCommission },
          { label: 'Fees', value: summary.totalFees },
          { label: 'Refunds', value: summary.totalRefunds },
          { label: 'Adjustments', value: summary.totalAdjustments },
          { label: 'Paid out', value: summary.totalPaid },
          { label: 'Current payable', value: summary.currentPayable },
        ],
      },
      {
        title: 'Ledger entries',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Date', value: (row) => new Date(row.date).toISOString() },
          { header: 'Reference', value: (row) => row.transactionId },
          { header: 'Order', value: (row) => row.orderNumber || '' },
          { header: 'Type', value: (row) => ACCOUNTING_TXN_TYPE_LABELS[row.type] || row.type },
          { header: 'Credit', value: (row) => rupees(row.credit) },
          { header: 'Debit', value: (row) => rupees(row.debit) },
          { header: 'Running balance', value: (row) => rupees(row.runningBalance) },
          { header: 'Description', value: (row) => row.description },
        ],
        rows: entries,
      },
    ])
  }

  return (
    <PageBody>
      <PageHeader
        title={data.seller}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Seller statement</span>
            {data.gstin && <span className="tabular text-ink-faint">GSTIN {data.gstin}</span>}
            {!data.isActive && (
              <Badge tone="warning" size="sm" dot>
                Inactive seller
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="control"
              icon="arrowLeft"
              onClick={() => navigate(ADMIN_ROUTES.ACCOUNTING_SELLER_LEDGER)}
            >
              All sellers
            </Button>
            <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_POST}>
              <Button variant="secondary" size="control" icon="add" onClick={() => setAdjusting(true)}>
                Adjustment
              </Button>
            </PermissionGate>
            <ExportMenu onExport={exportCsv} />
          </>
        }
      />

      {/* A seller who owes the platform is a genuine state (refunded after
          being paid), so it is called out rather than hidden. */}
      {summary.currentPayable < 0 && (
        <SectionCard className="border-danger-200 bg-danger-50/40">
          <p className="px-4 py-3 text-xs leading-relaxed text-danger-700">
            This seller&rsquo;s balance is negative — refunds have exceeded what they have earned since
            their last payout. The amount is recovered from their next settlement.
          </p>
        </SectionCard>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SummaryCard
          title="Earnings"
          description="Everything posted for this seller, all time"
          columns={2}
          rows={[
            { label: 'Total sales', value: summary.totalSales },
            { label: 'Commission', value: summary.totalCommission, tone: 'negative' },
            { label: 'Fees', value: summary.totalFees, tone: 'negative' },
            { label: 'Refunds', value: summary.totalRefunds, tone: 'negative' },
            {
              label: 'Adjustments',
              value: summary.totalAdjustments,
              tone: summary.totalAdjustments < 0 ? 'negative' : 'positive',
            },
            { label: 'Paid out', value: summary.totalPaid, tone: 'muted' },
          ]}
        />

        <SummaryCard
          title="Position"
          description="Where the money owed to them currently sits"
          columns={2}
          rows={[
            {
              label: 'Current payable',
              value: summary.currentPayable,
              tone: summary.currentPayable < 0 ? 'negative' : 'positive',
            },
            { label: 'Available for settlement', value: summary.availableForSettlement },
            { label: 'On hold', value: summary.onHold, tone: 'muted' },
            { label: 'Settled to date', value: summary.settled, tone: 'muted' },
          ]}
        />
      </div>

      <SectionCard
        title="Ledger"
        description="Every entry, newest first. The running balance is calculated across all entries, not just the ones shown."
      >
        <div className="px-4 py-3">
          <FilterBar
            filters={LEDGER_FILTERS}
            value={filters}
            onChange={changeFilters}
            searchPlaceholder="Not searchable — filter by type or date"
          />
        </div>

        {entries.length === 0 ? (
          <div className="px-4 pb-4">
            <AccountingEmpty
              title="No ledger entries"
              hint="Nothing has been posted for this seller in this view."
            />
          </div>
        ) : (
          <DataTable
            columns={columns.LEDGER_ENTRY_COLUMNS}
            data={entries}
            getRowKey={(row) => row.id}
            page={data.ledger.page}
            totalPages={data.ledger.totalPages}
            totalItems={data.ledger.totalItems}
            rowsPerPage={data.ledger.rowsPerPage}
            onPageChange={setPage}
            itemLabel="entries"
            emptyTitle="No ledger entries"
          />
        )}
      </SectionCard>

      <AdjustmentDialog
        isOpen={adjusting}
        onClose={() => setAdjusting(false)}
        seller={data.seller}
        sellerId={sellerId}
        onSubmit={adjustment.run}
        isSubmitting={adjustment.isSubmitting}
      />
    </PageBody>
  )
}
