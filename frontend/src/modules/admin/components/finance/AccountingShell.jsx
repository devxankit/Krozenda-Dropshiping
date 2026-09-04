import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Tabs } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../shell'
import { ErrorState, PageSkeleton } from '../feedback'

const TABS = Object.freeze([
  { id: ADMIN_ROUTES.PNL, label: 'Profit & loss' },
  { id: ADMIN_ROUTES.BALANCE_SHEET, label: 'Balance sheet' },
  { id: ADMIN_ROUTES.TRIAL_BALANCE, label: 'Trial balance' },
  { id: ADMIN_ROUTES.CASH_FLOW, label: 'Cash flow' },
  { id: ADMIN_ROUTES.CHART_OF_ACCOUNTS, label: 'Chart of accounts' },
  { id: ADMIN_ROUTES.JOURNAL_VOUCHERS, label: 'Journal vouchers' },
  { id: ADMIN_ROUTES.EXPENSES, label: 'Expenses' },
])

// The seven accounting screens share a header, a tab strip, a period control
// and all four states. Each page is then only its own table.
export function AccountingShell({
  title,
  description,
  period,
  unreconciled,
  controller,
  // Statements are read-only, so they take the default Print/Export set. The
  // ledger screens — vouchers, expenses, chart of accounts — pass their own.
  actions,
  toolbar,
  children,
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <PageBody>
      <PageHeader
        title={title}
        description={description}
        actions={
          actions ?? (
            <>
              <Button variant="secondary" size="control" icon="calendar" iconRight="chevronDown">
                FY 2026-27 to date
              </Button>
              <Button variant="secondary" size="control" icon="print" onClick={() => window.print()}>
                Print
              </Button>
              <Button size="control" icon="download">
                Export
              </Button>
            </>
          )
        }
      >
        {(period || unreconciled) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
            {period && <span>{period}</span>}
            {unreconciled > 0 && (
              <>
                <span className="text-border-strong">·</span>
                {/* A count an operator cannot act on is just decoration —
                    this takes them to the payments it is counting. */}
                <button
                  type="button"
                  onClick={() => navigate(ADMIN_ROUTES.TRANSACTIONS)}
                  className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Badge tone="warning" size="sm" dot>
                    {unreconciled} entries unreconciled
                  </Badge>
                </button>
              </>
            )}
          </div>
        )}
      </PageHeader>

      <Tabs items={TABS} activeId={pathname} onChange={(id) => navigate(id)} />

      {toolbar}

      {controller.isLoading && <PageSkeleton rows={4} />}
      {controller.error && <ErrorState error={controller.error} onRetry={controller.refetch} />}
      {controller.data && children(controller.data)}
    </PageBody>
  )
}
