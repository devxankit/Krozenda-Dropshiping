import { InlineAlert } from '../../components/feedback'
import { AccountingShell } from '../../components/finance/AccountingShell'
import { Statement } from '../../components/finance/Statement'
import { useStatementController } from '../../controllers/useFinanceController'

// Three comparative statements, one component. They differ only in which
// figures they read and what the note underneath needs to say.

export function ProfitAndLossPage() {
  const controller = useStatementController('pnl')

  return (
    <AccountingShell
      title="Profit & loss"
      description="Where the margin comes from, and what it costs to earn it."
      period={controller.data?.period}
      unreconciled={controller.data?.unreconciled}
      controller={controller}
    >
      {(statement) => (
        <>
          <Statement statement={statement} expenseFrom="Direct costs" />
          <InlineAlert tone="info" title="Commission is recognised at the snapshotted rate">
            Each sub-order carries the commission rate that applied when the order was placed.
            Nothing here is recomputed from the current rule set. Vendor payables and statutory
            taxes are balance sheet items, not costs, so they do not appear above.
          </InlineAlert>
        </>
      )}
    </AccountingShell>
  )
}

export function BalanceSheetPage() {
  const controller = useStatementController('balance-sheet')

  return (
    <AccountingShell
      title="Balance sheet"
      description="What the platform holds against what it owes vendors and the exchequer."
      period={controller.data?.period}
      unreconciled={controller.data?.unreconciled}
      controller={controller}
    >
      {(statement) => (
        <>
          <Statement statement={statement} showShare={false} />
          <InlineAlert tone="info" title="Vendor money is a liability, never revenue">
            Funds sitting in the gateway escrow and owed to vendors appear as an asset and a
            matching liability. Under the RBI payment aggregator framework the platform may not
            treat them as its own — Razorpay Route holds and releases them.
          </InlineAlert>
        </>
      )}
    </AccountingShell>
  )
}

export function CashFlowPage() {
  const controller = useStatementController('cash-flow')

  return (
    <AccountingShell
      title="Cash flow"
      description="Movement in cash across operating, investing and financing activity."
      period={controller.data?.period}
      unreconciled={controller.data?.unreconciled}
      controller={controller}
    >
      {(statement) => <Statement statement={statement} showShare={false} />}
    </AccountingShell>
  )
}
