import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, Timeline, formatMoney } from '../../components/display'
import { DetailField } from '../../components/accounting/AccountingShell'
import { CompletePayoutDialog, FailPayoutDialog } from '../../components/accounting/AccountingDialogs'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import { ADMIN_PERMISSIONS, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONE } from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import { usePayoutController, usePayoutListController, usePayoutWriteController } from '../../controllers/useAccountingController'

// /admin/accounting/payouts — money actually sent to sellers.
//
// Bank details arrive already masked from the API; nothing on this screen has
// ever seen a full account number. A payout is created from a settlement, so
// there is no form here that could send money to the wrong seller.

const MANAGE = ADMIN_PERMISSIONS.ACCOUNTING_PAYOUT_MANAGE

// Only a live payout can still be moved. COMPLETED, FAILED and CANCELLED are
// terminal — a completed one is corrected with an adjustment, never reopened.
const OPEN_STATUSES = ['PENDING', 'PROCESSING']

export function PayoutsPage() {
  const list = usePayoutListController()
  const writer = usePayoutWriteController()
  const [completing, setCompleting] = useState(null)
  const [failing, setFailing] = useState(null)

  const rows = list.items.map((row, index) => ({
    ...row,
    sn: (list.page - 1) * list.rowsPerPage + index + 1,
  }))

  const cols = useMemo(
    () =>
      withRowActions(columns.PAYOUT_COLUMNS, (row) => [
        {
          label: 'Mark completed',
          icon: 'check',
          permission: MANAGE,
          disabled: !OPEN_STATUSES.includes(row.status),
          onSelect: () => setCompleting(row),
        },
        {
          label: 'Mark failed',
          icon: 'close',
          tone: 'danger',
          permission: MANAGE,
          disabled: !OPEN_STATUSES.includes(row.status),
          onSelect: () => setFailing(row),
        },
      ]),
    [],
  )

  function exportCsv() {
    downloadCsv('payouts.csv', [
      {
        title: 'Payouts',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Payout ID', value: (row) => row.payoutId },
          { header: 'Seller', value: (row) => row.seller },
          { header: 'Settlement', value: (row) => row.settlementId },
          { header: 'Amount', value: (row) => rupees(row.amount) },
          { header: 'Method', value: (row) => row.method },
          { header: 'Bank account', value: (row) => row.bankAccountMasked },
          { header: 'UTR', value: (row) => row.utr || '' },
          { header: 'Status', value: (row) => PAYOUT_STATUS_LABELS[row.status] || row.status },
          { header: 'Created at', value: (row) => new Date(row.createdAt).toISOString() },
          { header: 'Processed at', value: (row) => (row.processedAt ? new Date(row.processedAt).toISOString() : '') },
        ],
        rows,
      },
    ])
  }

  return (
    <>
      <ListScreen
        title="Payouts"
        description="Transfers to sellers, their bank reference and where each one got to."
        actions={<ExportMenu onExport={exportCsv} />}
        banner={
          (list.tabCounts.FAILED || 0) > 0 && (
            <InlineAlert tone="danger" title={`${list.tabCounts.FAILED} payout(s) failed`}>
              Nothing was debited for a failed payout and its settlement is payable again — retry it
              from the settlement.
            </InlineAlert>
          )
        }
        controller={{ ...list, items: rows }}
        columns={cols}
        tabs={columns.PAYOUT_TABS}
        searchPlaceholder="Payout ID, seller, settlement or UTR…"
        itemLabel="payouts"
        emptyIcon="send"
        emptyTitle="No payouts found"
        emptyDescription="A payout is created from a settlement — start there."
      />

      <CompletePayoutDialog
        isOpen={Boolean(completing)}
        onClose={() => setCompleting(null)}
        payout={completing}
        onSubmit={(payload) => {
          writer.setStatus.run(payload)
          setCompleting(null)
        }}
        isSubmitting={writer.setStatus.isSubmitting}
      />

      <FailPayoutDialog
        isOpen={Boolean(failing)}
        onClose={() => setFailing(null)}
        payout={failing}
        onSubmit={(payload) => {
          writer.setStatus.run(payload)
          setFailing(null)
        }}
        isSubmitting={writer.setStatus.isSubmitting}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

const AUDIT_TONE = {
  PAYOUT_COMPLETED: 'success',
  PAYOUT_FAILED: 'danger',
  PAYOUT_CANCELLED: 'danger',
}

const AUDIT_LABEL = {
  PAYOUT_INITIATED: 'Payout initiated',
  PAYOUT_PROCESSING: 'Sent to the bank',
  PAYOUT_COMPLETED: 'Transfer completed',
  PAYOUT_FAILED: 'Transfer failed',
  PAYOUT_CANCELLED: 'Payout cancelled',
}

export function PayoutDetailPage() {
  const { payoutId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = usePayoutController(payoutId)
  const writer = usePayoutWriteController()
  const [completing, setCompleting] = useState(false)
  const [failing, setFailing] = useState(false)

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

  const isOpen = OPEN_STATUSES.includes(data.status)

  return (
    <PageBody>
      <PageHeader
        title={data.payoutId}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formatMoney(data.amount)} to {data.seller}
            </span>
            <Badge tone={PAYOUT_STATUS_TONE[data.status] || 'neutral'} size="sm" dot>
              {PAYOUT_STATUS_LABELS[data.status] || data.status}
            </Badge>
            {data.attempt > 1 && (
              <Badge tone="warning" size="sm">
                Attempt {data.attempt}
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
              onClick={() => navigate(ADMIN_ROUTES.ACCOUNTING_PAYOUTS)}
            >
              Back
            </Button>
            {isOpen && (
              <PermissionGate permission={MANAGE}>
                <Button variant="dangerOutline" size="control" icon="close" onClick={() => setFailing(true)}>
                  Mark failed
                </Button>
                <Button size="control" icon="check" onClick={() => setCompleting(true)}>
                  Mark completed
                </Button>
              </PermissionGate>
            )}
          </>
        }
      />

      {data.status === 'FAILED' && (
        <InlineAlert tone="danger" title="This payout failed">
          {data.failureReason || 'No reason was recorded.'} Nothing was debited from the seller, and
          the settlement is payable again.
        </InlineAlert>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <SectionCard title="Payout">
            <dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Payout ID" value={data.payoutId} mono />
              <DetailField label="Amount" value={formatMoney(data.amount)} mono />
              <DetailField label="Method" value={data.method} />
              <DetailField
                label="Seller"
                value={
                  <a
                    href={adminPath.accountingSellerLedger(data.sellerId)}
                    className="text-brand-700 hover:text-brand-600"
                  >
                    {data.seller}
                  </a>
                }
              />
              <DetailField
                label="Settlement"
                value={
                  data.settlement ? (
                    <a
                      href={adminPath.accountingSettlement(data.settlement.id)}
                      className="text-brand-700 hover:text-brand-600"
                    >
                      {data.settlement.settlementId}
                    </a>
                  ) : null
                }
                mono
              />
              <DetailField label="UTR" value={data.utr} mono />
              <DetailField label="Provider reference" value={data.providerReference} mono />
              <DetailField label="Initiated by" value={data.initiatedBy || 'System'} />
              <DetailField label="Created" value={new Date(data.createdAt).toLocaleString('en-IN')} />
              <DetailField
                label="Processed"
                value={data.processedAt ? new Date(data.processedAt).toLocaleString('en-IN') : null}
              />
              <DetailField label="Ledger entry" value={data.ledgerTransactionId} mono />
              <DetailField label="Failure reason" value={data.failureReason} tone="negative" />
            </dl>
            {data.notes && (
              <div className="border-t border-border-subtle px-4 py-3">
                <p className="text-2xs uppercase tracking-wider text-ink-faint">Notes</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-900">{data.notes}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Audit history"
            description="Every state this payout has been through, and who moved it"
          >
            <div className="px-4 py-4">
              {data.auditHistory.length === 0 ? (
                <p className="text-xs text-ink-subtle">Nothing recorded.</p>
              ) : (
                <Timeline
                  events={data.auditHistory.map((entry) => ({
                    label: AUDIT_LABEL[entry.action] || entry.action,
                    at: new Date(entry.at).toLocaleString('en-IN'),
                    actor: entry.by,
                    reason: entry.reason,
                    tone: AUDIT_TONE[entry.action],
                    done: true,
                  }))}
                />
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Bank details" description="Masked — the full account number is never exposed">
          <dl className="px-4 py-2">
            <DetailField label="Account holder" value={data.accountHolderName} />
            <DetailField label="Bank" value={data.bankName} />
            <DetailField label="Account" value={data.bankAccountMasked} mono />
            <DetailField label="IFSC" value={data.ifsc} mono />
          </dl>
        </SectionCard>
      </div>

      <CompletePayoutDialog
        isOpen={completing}
        onClose={() => setCompleting(false)}
        payout={data}
        onSubmit={(payload) => {
          writer.setStatus.run(payload)
          setCompleting(false)
        }}
        isSubmitting={writer.setStatus.isSubmitting}
      />

      <FailPayoutDialog
        isOpen={failing}
        onClose={() => setFailing(false)}
        payout={data}
        onSubmit={(payload) => {
          writer.setStatus.run(payload)
          setFailing(false)
        }}
        isSubmitting={writer.setStatus.isSubmitting}
      />
    </PageBody>
  )
}
