import { InlineAlert } from '../../components/feedback'
import { AccountingShell } from '../../components/finance/AccountingShell'
import { TrialBalanceTable } from '../../components/finance/LedgerTables'
import { formatMoney } from '../../lib/format'
import {
  useTrialBalanceController,
} from '../../controllers/useFinanceController'


export function TrialBalancePage() {
  const controller = useTrialBalanceController()
  const rows = controller.data?.rows || []
  const debit = rows.reduce((total, row) => total + row.debit, 0)
  const credit = rows.reduce((total, row) => total + row.credit, 0)
  const balanced = debit === credit

  return (
    <AccountingShell
      title="Trial balance"
      description="Every account, debit against credit, for the chosen period."
      period={controller.data?.period}
      controller={controller}
    >
      {(data) => (
        <>
          <InlineAlert
            tone={balanced ? 'success' : 'danger'}
            title={
              balanced
                ? `In balance — ${formatMoney(debit)} on both sides`
                : `Out of balance by ${formatMoney(Math.abs(debit - credit))}`
            }
          >
            {balanced
              ? 'Assets and expenses carry debit balances; liabilities, equity and income carry credit balances. Retained earnings here is the opening figure — the period’s profit still sits unclosed in the income and expense accounts.'
              : 'A trial balance that does not agree means a posting is missing one of its two sides. Find it before relying on any statement above.'}
          </InlineAlert>

          <TrialBalanceTable rows={data.rows} debit={debit} credit={credit} />
        </>
      )}
    </AccountingShell>
  )
}
