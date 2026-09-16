import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { DataTable } from '../../components/data/DataTable'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import { AccountingEmpty, DetailField, MoneyBreakdown } from '../../components/accounting/AccountingShell'
import { CreatePayoutDialog, HoldSettlementDialog } from '../../components/accounting/AccountingDialogs'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import {
  ACCOUNTING_SETTLEMENT_STATUS_LABELS,
  ACCOUNTING_SETTLEMENT_STATUS_TONE,
  ADMIN_PERMISSIONS,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONE,
} from '../../constants'
import * as columns from '../../tableColumns/accountingColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  usePayoutWriteController,
  useSettlementController,
  useSettlementListController,
  useSettlementWriteController,
} from '../../controllers/useAccountingController'

// /admin/accounting/settlements — what is payable to each seller.
//
// Batches are drafted automatically when this screen is opened: a delivered
// line becomes eligible once its hold window has passed and (for COD) the
// courier has remitted the cash. A line already inside a live batch is never
// picked up again, so generating twice cannot double-count it.

const MANAGE = ADMIN_PERMISSIONS.ACCOUNTING_SETTLEMENT_MANAGE
const PAYOUT_MANAGE = ADMIN_PERMISSIONS.ACCOUNTING_PAYOUT_MANAGE

const PAYABLE_STATUSES = ['ELIGIBLE', 'PENDING', 'AWAITING_APPROVAL', 'FAILED']

export function AccountingSettlementsPage() {
  const list = useSettlementListController()
  const writer = useSettlementWriteController()
  const [holding, setHolding] = useState(null)

  const rows = list.items.map((row, index) => ({
    ...row,
    sn: (list.page - 1) * list.rowsPerPage + index + 1,
  }))

  const cols = useMemo(
    () =>
      withRowActions(columns.SETTLEMENT_COLUMNS, (row) => [
        {
          label: 'Put on hold',
          icon: 'lock',
          tone: 'danger',
          permission: MANAGE,
          disabled: !PAYABLE_STATUSES.includes(row.status),
          onSelect: () => setHolding(row),
        },
        {
          label: 'Release hold',
          icon: 'check',
          permission: MANAGE,
          disabled: row.status !== 'ON_HOLD',
          onSelect: () => writer.release.run({ id: row.id }),
        },
      ]),
    [writer.release],
  )

  function exportCsv() {
    downloadCsv('settlements.csv', [
      {
        title: 'Settlements',
        columns: [
          { header: 'SN', value: (row) => row.sn },
          { header: 'Settlement ID', value: (row) => row.settlementId },
          { header: 'Seller', value: (row) => row.seller },
          {
            header: 'Period',
            value: (row) =>
              row.periodStart && row.periodEnd
                ? `${new Date(row.periodStart).toISOString().slice(0, 10)} to ${new Date(row.periodEnd).toISOString().slice(0, 10)}`
                : '',
          },
          { header: 'Gross sales', value: (row) => rupees(row.grossSales) },
          { header: 'Commission', value: (row) => rupees(row.commission) },
          { header: 'Fees', value: (row) => rupees(row.fees) },
          { header: 'Refunds', value: (row) => rupees(row.refunds) },
          { header: 'Adjustments', value: (row) => rupees(row.adjustments) },
          { header: 'Net payable', value: (row) => rupees(row.netPayable) },
          { header: 'Status', value: (row) => ACCOUNTING_SETTLEMENT_STATUS_LABELS[row.status] || row.status },
          { header: 'Created at', value: (row) => new Date(row.createdAt).toISOString() },
          { header: 'Paid at', value: (row) => (row.paidAt ? new Date(row.paidAt).toISOString() : '') },
        ],
        rows,
      },
    ])
  }

  return (
    <>
      <ListScreen
        title="Settlements"
        description="What each seller is owed for delivered orders past their hold window."
        actions={
          <>
            <PermissionGate permission={MANAGE}>
              <Button
                variant="secondary"
                size="control"
                icon="refresh"
                isLoading={writer.generate.isSubmitting}
                onClick={() => writer.generate.run({})}
              >
                Generate
              </Button>
            </PermissionGate>
            <ExportMenu onExport={exportCsv} />
          </>
        }
        controller={{ ...list, items: rows }}
        columns={cols}
        tabs={columns.SETTLEMENT_TABS}
        searchPlaceholder="Settlement ID, seller or UTR…"
        itemLabel="settlements"
        emptyIcon="settlements"
        emptyTitle="No settlements found"
        emptyDescription="A delivered line becomes settleable once its hold window has passed — and, for COD, once the courier has remitted the cash."
      />

      <HoldSettlementDialog
        isOpen={Boolean(holding)}
        onClose={() => setHolding(null)}
        settlement={holding}
        onSubmit={(payload) => {
          writer.hold.run(payload)
          setHolding(null)
        }}
        isSubmitting={writer.hold.isSubmitting}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function AccountingSettlementDetailPage() {
  const { settlementId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useSettlementController(settlementId)
  const settlementWriter = useSettlementWriteController()
  const payoutWriter = usePayoutWriteController()
  const [paying, setPaying] = useState(false)
  const [holding, setHolding] = useState(false)

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

  const canPay = PAYABLE_STATUSES.includes(data.status)

  return (
    <PageBody>
      <PageHeader
        title={data.settlementId}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.seller}</span>
            <Badge tone={ACCOUNTING_SETTLEMENT_STATUS_TONE[data.status] || 'neutral'} size="sm" dot>
              {ACCOUNTING_SETTLEMENT_STATUS_LABELS[data.status] || data.status}
            </Badge>
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="control"
              icon="arrowLeft"
              onClick={() => navigate(ADMIN_ROUTES.ACCOUNTING_SETTLEMENTS)}
            >
              Back
            </Button>
            {data.status === 'ON_HOLD' ? (
              <PermissionGate permission={MANAGE}>
                <Button
                  variant="secondary"
                  size="control"
                  icon="check"
                  isLoading={settlementWriter.release.isSubmitting}
                  onClick={() => settlementWriter.release.run({ id: data.id })}
                >
                  Release hold
                </Button>
              </PermissionGate>
            ) : (
              canPay && (
                <PermissionGate permission={MANAGE}>
                  <Button variant="dangerOutline" size="control" icon="lock" onClick={() => setHolding(true)}>
                    Hold
                  </Button>
                </PermissionGate>
              )
            )}
            {canPay && (
              <PermissionGate permission={PAYOUT_MANAGE}>
                <Button size="control" icon="send" onClick={() => setPaying(true)}>
                  Pay seller
                </Button>
              </PermissionGate>
            )}
          </>
        }
      />

      {data.status === 'ON_HOLD' && (
        <InlineAlert tone="warning" title="This settlement is on hold">
          {data.holdReason || 'No reason was recorded.'} Nothing can be paid out until it is released.
        </InlineAlert>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <SectionCard
            title="What this settles"
            description={`${data.lineCount} delivered line${data.lineCount === 1 ? '' : 's'}`}
          >
            {data.lines.length === 0 ? (
              <div className="px-4 pb-4 pt-2">
                <AccountingEmpty title="No lines on this settlement" />
              </div>
            ) : (
              <DataTable
                columns={columns.SETTLEMENT_LINE_COLUMNS}
                data={data.lines}
                getRowKey={(row) => `${row.orderId}-${row.sn}`}
                itemLabel="lines"
                emptyTitle="No lines"
              />
            )}
          </SectionCard>

          {data.payouts.length > 0 && (
            <SectionCard
              title="Payout attempts"
              description="Every attempt is kept, including the ones that failed"
            >
              <ul className="divide-y divide-border-subtle">
                {data.payouts.map((payout) => (
                  <li key={payout.id}>
                    <a
                      href={adminPath.accountingPayout(payout.id)}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="tabular block text-xs font-semibold text-slate-900">
                          {payout.payoutId}
                        </span>
                        <span className="block text-2xs text-ink-subtle">
                          Attempt {payout.attempt}
                          {payout.utr ? ` · UTR ${payout.utr}` : ''}
                          {payout.failureReason ? ` · ${payout.failureReason}` : ''}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs font-semibold text-slate-900">
                        {formatMoney(payout.amount)}
                      </span>
                      <Badge tone={PAYOUT_STATUS_TONE[payout.status] || 'neutral'} size="sm" dot>
                        {PAYOUT_STATUS_LABELS[payout.status] || payout.status}
                      </Badge>
                    </a>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="Calculation">
            <MoneyBreakdown
              lines={[
                { label: 'Gross sales', value: data.grossSales, sign: '+' },
                { label: 'Commission', value: data.commission, sign: '-' },
                { label: 'Fees', value: data.fees, sign: '-' },
                { label: 'Refunds', value: data.refunds, sign: '-' },
                { label: 'Adjustments', value: data.adjustments, sign: data.adjustments < 0 ? '-' : '+' },
              ]}
              total={data.netPayable}
              totalLabel="Seller payable"
            />
          </SectionCard>

          <SectionCard title="Payment destination" description="Masked — the full number is never shown">
            <dl className="px-4 py-2">
              <DetailField label="Account holder" value={data.fundAccount.accountHolderName} />
              <DetailField label="Bank" value={data.fundAccount.bankName} />
              <DetailField label="Account" value={data.fundAccount.accountMasked} mono />
              <DetailField label="IFSC" value={data.fundAccount.ifsc} mono />
              <DetailField label="GSTIN" value={data.gstin} mono />
            </dl>
            {!data.fundAccount.onFile && (
              <div className="border-t border-border px-4 py-3">
                <InlineAlert tone="warning" title="No bank account on file">
                  This seller cannot be paid until their payout details are collected.
                </InlineAlert>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Timeline">
            <dl className="px-4 py-2">
              <DetailField label="Created" value={new Date(data.createdAt).toLocaleString('en-IN')} />
              <DetailField
                label="Eligible at"
                value={data.eligibleAt ? new Date(data.eligibleAt).toLocaleString('en-IN') : null}
              />
              <DetailField
                label="Paid at"
                value={data.paidAt ? new Date(data.paidAt).toLocaleString('en-IN') : null}
              />
              <DetailField label="UTR" value={data.utr} mono />
            </dl>
          </SectionCard>
        </div>
      </div>

      <CreatePayoutDialog
        isOpen={paying}
        onClose={() => setPaying(false)}
        settlement={data}
        onSubmit={(payload) => {
          payoutWriter.create.run(payload)
          setPaying(false)
        }}
        isSubmitting={payoutWriter.create.isSubmitting}
      />

      <HoldSettlementDialog
        isOpen={holding}
        onClose={() => setHolding(false)}
        settlement={data}
        onSubmit={(payload) => {
          settlementWriter.hold.run(payload)
          setHolding(false)
        }}
        isSubmitting={settlementWriter.hold.isSubmitting}
      />
    </PageBody>
  )
}
