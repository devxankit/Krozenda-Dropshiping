import { useMemo, useState } from 'react'
import { Badge } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { Drawer } from '../../components/overlay/Drawer'
import { SectionCard, formatMoney } from '../../components/display'
import { DetailField } from '../../components/accounting/AccountingShell'
import { RefundDecisionDialog } from '../../components/accounting/AccountingDialogs'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import {
  ACCOUNTING_REFUND_STATUS_LABELS,
  ACCOUNTING_REFUND_STATUS_TONE,
  ACCOUNTING_TXN_TYPE_LABELS,
  ADMIN_PERMISSIONS,
} from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useAccountingRefundController,
  useAccountingRefundListController,
  useAccountingRefundWriteController,
} from '../../controllers/useAccountingController'

// /admin/accounting/refunds — customer refunds and what they did to the
// ledger.
//
// A refund never edits the sale it claws back. Approving one posts a REFUND
// debit against the seller and a proportional REFUND_REVERSAL credit giving
// back the commission charged on the refunded part — which is what the
// "Ledger" column and the drawer below are showing.

const MANAGE = ADMIN_PERMISSIONS.ACCOUNTING_REFUND_MANAGE

export function AccountingRefundsPage() {
  const list = useAccountingRefundListController()
  const [deciding, setDeciding] = useState(null)
  const [viewing, setViewing] = useState(null)
  const writer = useAccountingRefundWriteController({ onDone: () => setDeciding(null) })

  const rows = list.items.map((row, index) => ({
    ...row,
    sn: (list.page - 1) * list.rowsPerPage + index + 1,
  }))

  const cols = useMemo(
    () =>
      withRowActions(columns.REFUND_COLUMNS, (row) => [
        {
          label: 'View accounting impact',
          icon: 'eye',
          onSelect: () => setViewing(row),
        },
        {
          label: 'Approve refund',
          icon: 'check',
          permission: MANAGE,
          disabled: !row.canDecide,
          onSelect: () => setDeciding({ row, decision: 'approve' }),
        },
        {
          label: 'Decline refund',
          icon: 'close',
          tone: 'danger',
          permission: MANAGE,
          disabled: !row.canDecide,
          onSelect: () => setDeciding({ row, decision: 'reject' }),
        },
      ]),
    [],
  )

  function exportCsv() {
    downloadCsv('refunds.csv', [
      {
        title: 'Refunds',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Refund ID', value: (row) => row.refundId },
          { header: 'Order', value: (row) => row.orderNumber },
          { header: 'Seller', value: (row) => row.seller },
          { header: 'Customer', value: (row) => row.customer },
          { header: 'Refund amount', value: (row) => rupees(row.amount) },
          { header: 'Refund type', value: (row) => row.refundType },
          { header: 'Reason', value: (row) => row.reason },
          { header: 'Payment method', value: (row) => row.paymentMethod || '' },
          { header: 'Status', value: (row) => ACCOUNTING_REFUND_STATUS_LABELS[row.status] || row.status },
          { header: 'Posted to ledger', value: (row) => (row.ledgerPosted ? 'Yes' : 'No') },
          { header: 'Created at', value: (row) => new Date(row.createdAt).toISOString() },
          { header: 'Completed at', value: (row) => (row.completedAt ? new Date(row.completedAt).toISOString() : '') },
        ],
        rows,
      },
    ])
  }

  const open = list.tabCounts.open || 0

  return (
    <>
      <ListScreen
        title="Refunds"
        description="Money returned to buyers, and the reversal each one posted to the seller's ledger."
        actions={<ExportMenu onExport={exportCsv} />}
        banner={
          open > 0 && (
            <InlineAlert tone="warning" title={`${open} refund(s) are waiting on a decision`}>
              Approving one credits the buyer&rsquo;s wallet and reverses the same amount off the
              seller, along with the commission charged on it.
            </InlineAlert>
          )
        }
        controller={{ ...list, items: rows }}
        columns={cols}
        tabs={columns.REFUND_TABS}
        searchPlaceholder="Refund ID, order, customer or seller…"
        itemLabel="refunds"
        emptyIcon="returns"
        emptyTitle="No refunds found"
        emptyDescription="Refunds appear here when a buyer returns an item or an order is cancelled after payment."
        onRowClick={(row) => setViewing(row)}
      />

      <RefundDecisionDialog
        isOpen={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        refund={deciding?.row}
        decision={deciding?.decision}
        onSubmit={(payload) =>
          deciding.decision === 'approve' ? writer.approve.run(payload) : writer.reject.run(payload)
        }
        isSubmitting={writer.approve.isSubmitting || writer.reject.isSubmitting}
      />

      <RefundDetailDrawer refund={viewing} onClose={() => setViewing(null)} />
    </>
  )
}

// The accounting impact of one refund — the entries it actually produced.
// A drawer rather than a page: it is read against the list, not navigated to.
function RefundDetailDrawer({ refund, onClose }) {
  const { data, isLoading } = useAccountingRefundController(refund?.id)

  if (!refund) return null

  const detail = data || refund

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={detail.refundId}
      description={`${formatMoney(detail.amount)} · ${detail.refundType === 'FULL' ? 'Full refund' : 'Partial refund'}`}
      width="lg"
    >
      <div className="flex flex-col gap-4 p-5">
        <SectionCard title="Refund">
          <dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
            <DetailField
              label="Order"
              value={
                <a href={adminPath.orderDetail(detail.orderId)} className="text-brand-700 hover:text-brand-600">
                  {detail.orderNumber}
                </a>
              }
              mono
            />
            <DetailField
              label="Seller"
              value={
                detail.sellerId ? (
                  <a
                    href={adminPath.accountingSellerLedger(detail.sellerId)}
                    className="text-brand-700 hover:text-brand-600"
                  >
                    {detail.seller}
                  </a>
                ) : (
                  detail.seller
                )
              }
            />
            <DetailField label="Customer" value={detail.customer} />
            <DetailField label="Product" value={detail.productName || 'Whole order'} />
            <DetailField label="Refund amount" value={formatMoney(detail.amount)} mono />
            <DetailField label="Payment method" value={detail.paymentMethod} />
            <DetailField
              label="Status"
              value={
                <Badge tone={ACCOUNTING_REFUND_STATUS_TONE[detail.status] || 'neutral'} size="sm" dot>
                  {ACCOUNTING_REFUND_STATUS_LABELS[detail.status] || detail.status}
                </Badge>
              }
            />
            <DetailField label="Reason" value={detail.reason} />
            <DetailField label="Created" value={new Date(detail.createdAt).toLocaleString('en-IN')} />
            <DetailField
              label="Completed"
              value={detail.completedAt ? new Date(detail.completedAt).toLocaleString('en-IN') : null}
            />
          </dl>
          {detail.adminNote && (
            <div className="border-t border-border-subtle px-4 py-3">
              <p className="text-2xs uppercase tracking-wider text-ink-faint">Admin note</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-900">{detail.adminNote}</p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Accounting impact"
          description="The entries this refund posted. The original sale is untouched."
        >
          {isLoading ? (
            <p className="px-4 py-4 text-xs text-ink-subtle">Loading…</p>
          ) : !data?.ledgerEntries?.length ? (
            <p className="px-4 py-4 text-xs text-ink-subtle">
              {detail.status === 'COMPLETED'
                ? 'Nothing was posted — this order had no sale on the ledger to reverse (an unremitted COD order, for example).'
                : 'Nothing is posted until the refund is approved.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {data.ledgerEntries.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={adminPath.accountingTransaction(entry.id)}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="tabular block text-xs font-semibold text-slate-900">
                        {entry.transactionId}
                      </span>
                      <span className="block text-2xs text-ink-subtle">
                        {ACCOUNTING_TXN_TYPE_LABELS[entry.type] || entry.type} · {entry.description}
                      </span>
                    </span>
                    <span
                      className={`tabular shrink-0 text-xs font-semibold ${
                        entry.direction === 'CREDIT' ? 'text-success-700' : 'text-danger-700'
                      }`}
                    >
                      {entry.direction === 'CREDIT' ? '' : '−'}
                      {formatMoney(entry.amount)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </Drawer>
  )
}
