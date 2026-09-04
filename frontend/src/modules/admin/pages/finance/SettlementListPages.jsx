import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { LedgerAdjustmentDialog } from '../../components/finance/LedgerAdjustmentDialog'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useSettlementListController,
  useSettlementWriteController,
  useVendorLedgerListController,
  useVendorLedgerWriteController,
} from '../../controllers/useFinanceController'
import * as columns from '../../tableColumns/financeColumns'
import { withRowActions } from '../../tableColumns/rowActions'

export function SettlementsPage() {
  const navigate = useNavigate()
  const list = useSettlementListController()
  const writer = useSettlementWriteController()
  const failed = list.tabCounts.failed || 0
  const awaiting = list.tabCounts.awaiting || 0

  const cols = useMemo(
    () =>
      withRowActions(columns.SETTLEMENT_COLUMNS, (row) => [
        { label: 'Open batch', icon: 'externalLink', onSelect: () => navigate(adminPath.settlementBatch(row.id)) },
        {
          label: 'Retry payout',
          icon: 'refresh',
          permission: ADMIN_PERMISSIONS.PAYOUT_PREPARE,
          disabled: row.status !== 'failed',
          onSelect: () => writer.retry.run({ id: row.id }),
        },
      ]),
    [navigate, writer.retry],
  )

  return (
    <ListScreen
      title="Settlements"
      description="Payout batches, the 30-day hold window, and the maker–checker approval queue."
      actions={<ExportMenu onExport={() => {}} />}
      banner={
        <>
          {failed > 0 && (
            <InlineAlert tone="danger" title={`${failed} payout batches failed`}>
              RazorpayX rejected these transfers. The amount is credited back to the vendor
              payable and the vendor is flagged to update their bank details.
            </InlineAlert>
          )}
          {awaiting > 0 && (
            <InlineAlert tone="warning" title={`${awaiting} batches are waiting for approval`}>
              Approval mode is maker–checker: the nightly job prepares the batch, an admin
              releases it with a two-factor code. Nothing moves without that second person.
            </InlineAlert>
          )}
        </>
      }
      controller={list}
      columns={cols}
      filters={columns.SETTLEMENT_FILTERS}
      tabs={columns.SETTLEMENT_TABS}
      searchPlaceholder="Batch, vendor or UTR…"
      onRowClick={(row) => navigate(adminPath.settlementBatch(row.id))}
      itemLabel="batches"
      emptyIcon="settlements"
      emptyTitle="No settlement batches in this view"
    />
  )
}

export function VendorLedgersPage() {
  const navigate = useNavigate()
  const list = useVendorLedgerListController()
  const [adjusting, setAdjusting] = useState(null)
  const writer = useVendorLedgerWriteController({ onDone: () => setAdjusting(null) })

  const cols = useMemo(
    () =>
      withRowActions(columns.VENDOR_LEDGER_COLUMNS, (row) => [
        { label: 'Open statement', icon: 'externalLink', onSelect: () => navigate(adminPath.vendorLedger(row.id)) },
        {
          label: 'Adjust balance',
          icon: 'edit',
          permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
          onSelect: () => setAdjusting(row),
        },
      ]),
    [navigate],
  )

  return (
    <>
      <ListScreen
        title="Vendor ledgers"
        description="What each vendor is owed today, and when they were last paid."
        actions={<ExportMenu onExport={() => {}} />}
        banner={
          <InlineAlert tone="info" title="Closing balance is a sub-ledger of account 2010">
            Opening plus credited less paid out. The sum of every closing balance below equals the
            accounts payable figure on the balance sheet.
          </InlineAlert>
        }
        controller={list}
        columns={cols}
        tabs={columns.VENDOR_LEDGER_TABS}
        searchPlaceholder="Vendor or model…"
        onRowClick={(row) => navigate(adminPath.vendorLedger(row.id))}
        itemLabel="vendors"
        emptyIcon="ledger"
        emptyTitle="No vendor ledgers in this view"
      />

      {adjusting && (
        <LedgerAdjustmentDialog
          isOpen
          onClose={() => setAdjusting(null)}
          ledger={adjusting}
          adjust={writer.adjust}
        />
      )}
    </>
  )
}
