import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Icon } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import { Drawer } from '../../components/overlay/Drawer'
import { AccountingEmpty, DetailField, MoneyBreakdown } from '../../components/accounting/AccountingShell'
import { CodRemittanceDialog } from '../../components/accounting/AccountingDialogs'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import {
  ACCOUNTING_TXN_STATUS_LABELS,
  ACCOUNTING_TXN_TYPE_LABELS,
  ADMIN_PERMISSIONS,
  ORDER_PAYMENT_METHOD_LABELS,
} from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { TypeBadge } from '../../components/accounting/AccountingCells'
import {
  useAccountingTransactionController,
  useAccountingTransactionListController,
  useCodRemittanceController,
  useCommissionOptionsController,
  usePendingCodController,
} from '../../controllers/useAccountingController'

// /admin/accounting/transactions — the master financial history.
//
// Rows are numbered per page rather than globally, because SN on a paged
// table is a reading aid for "the third row down", not an identifier. The
// identifier is the transaction id, which is always shown beside it.
const withSerial = (items, page, rowsPerPage) =>
  items.map((row, index) => ({ ...row, sn: (page - 1) * rowsPerPage + index + 1 }))

export function AccountingTransactionsPage() {
  const list = useAccountingTransactionListController()
  const options = useCommissionOptionsController()
  const [codOpen, setCodOpen] = useState(false)

  const filters = useMemo(
    () => columns.transactionFilters(options.data?.sellers || []),
    [options.data],
  )

  const rows = withSerial(list.items, list.page, list.rowsPerPage)

  function exportCsv() {
    downloadCsv('accounting-transactions.csv', [
      {
        title: 'Accounting transactions',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Transaction ID', value: (row) => row.transactionId },
          { header: 'Order', value: (row) => row.orderNumber || '' },
          { header: 'Seller', value: (row) => row.seller },
          { header: 'Type', value: (row) => ACCOUNTING_TXN_TYPE_LABELS[row.type] || row.type },
          { header: 'Credit', value: (row) => rupees(row.credit) },
          { header: 'Debit', value: (row) => rupees(row.debit) },
          { header: 'Net', value: (row) => rupees(row.net) },
          { header: 'Status', value: (row) => ACCOUNTING_TXN_STATUS_LABELS[row.status] || row.status },
          { header: 'Reference', value: (row) => row.reference },
          { header: 'Created at', value: (row) => new Date(row.createdAt).toISOString() },
        ],
        rows,
      },
    ])
  }

  return (
    <>
      <ListScreen
        title="Transactions"
        description="Every entry on the ledger — sales, commission, fees, refunds, payouts and adjustments."
        actions={
          <>
            <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_POST}>
              <Button variant="secondary" size="control" icon="money" onClick={() => setCodOpen(true)}>
                COD collection
              </Button>
            </PermissionGate>
            <ExportMenu onExport={exportCsv} />
          </>
        }
        controller={{ ...list, items: rows }}
        columns={columns.TRANSACTION_COLUMNS}
        filters={filters}
        tabs={columns.TRANSACTION_TABS}
        searchPlaceholder="Transaction ID, order or seller…"
        itemLabel="transactions"
        emptyIcon="ledger"
        emptyTitle="No transactions found"
        emptyDescription="Nothing matches this view. Entries are posted automatically when money moves."
      />

      <PendingCodDrawer isOpen={codOpen} onClose={() => setCodOpen(false)} />
    </>
  )
}

// The queue of delivered COD orders whose cash the courier still holds. Kept
// in a drawer off Transactions rather than as a ninth sidebar entry — it is a
// step in the transaction flow, not a module of its own.
function PendingCodDrawer({ isOpen, onClose }) {
  const list = usePendingCodController()
  const [selected, setSelected] = useState(null)
  const remit = useCodRemittanceController({ onDone: () => setSelected(null) })

  const rows = withSerial(list.items, list.page, list.rowsPerPage)

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="COD awaiting collection"
        description="Delivered cash orders the courier has not remitted yet. Nothing is on the ledger until they are."
        width="lg"
      >
        <div className="p-5">
          {list.isLoading ? (
            <PageSkeleton rows={3} />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={list.refetch} />
          ) : rows.length === 0 ? (
            <AccountingEmpty
              title="Nothing awaiting collection"
              hint="Every delivered COD order has been remitted."
              icon="check"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3.5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="tabular block text-xs font-semibold text-slate-900">
                      {row.orderNumber}
                    </span>
                    <span className="block truncate text-2xs text-ink-subtle">
                      {row.buyer} · delivered{' '}
                      {row.deliveredAt
                        ? new Date(row.deliveredAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-bold text-slate-900">
                    {formatMoney(row.amount)}
                  </span>
                  <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_POST}>
                    <Button variant="secondary" size="xs" onClick={() => setSelected(row)}>
                      Record collection
                    </Button>
                  </PermissionGate>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Drawer>

      <CodRemittanceDialog
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        order={selected}
        onSubmit={remit.run}
        isSubmitting={remit.isSubmitting}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function AccountingTransactionDetailPage() {
  const { transactionId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useAccountingTransactionController(transactionId)

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
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

  const order = data.orderSummary
  const meta = data.metadata || {}

  return (
    <PageBody>
      <PageHeader
        title={data.transactionId}
        description={data.description || ACCOUNTING_TXN_TYPE_LABELS[data.type]}
        actions={
          <Button
            variant="secondary"
            size="control"
            icon="arrowLeft"
            onClick={() => navigate(ADMIN_ROUTES.ACCOUNTING_TRANSACTIONS)}
          >
            Back
          </Button>
        }
      />

      {data.reversalOf && (
        <InlineAlert tone="info" title="This entry reverses an earlier one">
          The original entry is still on the ledger, untouched — a reversal is posted alongside it
          rather than editing history.
        </InlineAlert>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <SectionCard title="Entry">
            <dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Transaction ID" value={data.transactionId} mono />
              <DetailField label="Type" value={<TypeBadge type={data.type} />} />
              <DetailField
                label="Status"
                value={ACCOUNTING_TXN_STATUS_LABELS[data.status] || data.status}
              />
              <DetailField
                label="Order"
                value={
                  data.orderId ? (
                    <a
                      href={adminPath.orderDetail(data.orderId)}
                      className="text-brand-700 hover:text-brand-600"
                    >
                      {data.orderNumber}
                    </a>
                  ) : null
                }
                mono
              />
              <DetailField
                label="Seller"
                value={
                  data.sellerId ? (
                    <a
                      href={adminPath.accountingSellerLedger(data.sellerId)}
                      className="text-brand-700 hover:text-brand-600"
                    >
                      {data.seller}
                    </a>
                  ) : (
                    'Platform'
                  )
                }
              />
              <DetailField label="Customer" value={data.customer} />
              <DetailField label="Product" value={data.productName} />
              <DetailField
                label="Credit"
                value={data.credit > 0 ? formatMoney(data.credit) : null}
                mono
                tone="positive"
              />
              <DetailField
                label="Debit"
                value={data.debit > 0 ? formatMoney(data.debit) : null}
                mono
                tone="negative"
              />
              <DetailField label="Currency" value={data.currency} />
              <DetailField
                label="Created"
                value={new Date(data.createdAt).toLocaleString('en-IN')}
              />
              <DetailField
                label="Updated"
                value={new Date(data.updatedAt).toLocaleString('en-IN')}
              />
            </dl>
          </SectionCard>

          {order && (
            <SectionCard
              title="The order behind it"
              description={`Placed ${new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            >
              <MoneyBreakdown
                lines={[
                  { label: 'Product amount', value: order.subtotal, sign: '+' },
                  { label: 'Discount', value: order.discount, sign: '-' },
                  { label: 'Shipping', value: order.shipping, sign: '+' },
                ]}
                total={order.total}
                totalLabel="Total payment"
              />
              <dl className="grid gap-x-6 border-t border-border-subtle px-4 py-2 sm:grid-cols-3">
                <DetailField
                  label="Payment method"
                  value={ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                />
                <DetailField label="Payment status" value={order.paymentStatus} />
                <DetailField label="Coupon" value={order.couponCode} mono />
              </dl>
            </SectionCard>
          )}

          {data.relatedEntries.length > 0 && (
            <SectionCard
              title="Everything else posted for this line"
              description="The full story of this sale, in the order it happened"
            >
              <ul className="divide-y divide-border-subtle">
                {data.relatedEntries.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={adminPath.accountingTransaction(entry.id)}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                    >
                      <TypeBadge type={entry.type} />
                      <span className="tabular min-w-0 flex-1 truncate text-xs text-ink-muted">
                        {entry.transactionId}
                      </span>
                      <span
                        className={`tabular shrink-0 text-xs font-semibold ${
                          entry.direction === 'CREDIT' ? 'text-success-700' : 'text-danger-700'
                        }`}
                      >
                        {entry.direction === 'CREDIT' ? '' : '−'}
                        {formatMoney(entry.amount)}
                      </span>
                      <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                    </a>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="References" description="What this entry points at">
            <dl className="px-4 py-2">
              <DetailField label="Reference type" value={data.referenceType} />
              <DetailField label="Reference ID" value={data.reference} mono />
              <DetailField label="Payment gateway ID" value={data.paymentGatewayId} mono />
              <DetailField label="Settlement" value={data.settlementId} mono />
              <DetailField label="Payout" value={data.payoutId} mono />
              <DetailField label="Refund request" value={data.refundId} mono />
            </dl>
          </SectionCard>

          {Object.keys(meta).length > 0 && (
            <SectionCard
              title="Working"
              description="The figures this entry was calculated from, frozen at posting time"
            >
              <dl className="px-4 py-2">
                {Object.entries(meta).map(([key, value]) => (
                  <DetailField
                    key={key}
                    label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                    // Anything named in paise is money and is formatted as
                    // such; the rest (rates, rule names, ids) renders as is.
                    value={
                      /paise$/i.test(key) && typeof value === 'number'
                        ? formatMoney(value)
                        : typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)
                    }
                    mono={/paise$/i.test(key)}
                  />
                ))}
              </dl>
            </SectionCard>
          )}
        </div>
      </div>
    </PageBody>
  )
}
