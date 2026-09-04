import { Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { StatutoryPosition, StatutoryReturns } from '../../components/finance/TaxPanels'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useTaxCentreController } from '../../controllers/useFinanceController'

// A marketplace operator has statutory obligations a plain seller does not:
// TCS under GST section 52 and TDS under income tax section 194-O, both
// collected from the vendor's money and remitted by the platform.
export function TaxCentrePage() {
  const { data, isLoading, error, refetch } = useTaxCentreController()

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

  const due = data.returns.filter((row) => row.status === 'due' || row.status === 'overdue')

  return (
    <PageBody>
      <PageHeader
        title="Tax centre"
        description="Statutory position and the returns the platform files as a marketplace operator."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.TAX_EXPORT}>
            <Button variant="secondary" size="control" icon="calendar" iconRight="chevronDown">
              August 2026
            </Button>
            <Button size="control" icon="download">
              Export all
            </Button>
          </PermissionGate>
        }
      />

      {due.length > 0 && (
        <InlineAlert tone="warning" title={`${due.length} returns are due this month`}>
          {due.map((row) => `${row.form} for ${row.period} by ${row.dueOn}`).join(' · ')}
        </InlineAlert>
      )}

      <StatutoryPosition position={data.position} />
      <StatutoryReturns returns={data.returns} />

      <InlineAlert tone="info" title="TCS and TDS come out of the vendor's money, not ours">
        Both are collected on the vendor&rsquo;s behalf and remitted by the platform. They sit as
        liabilities on the balance sheet until the return is filed and paid — they are never
        income.
      </InlineAlert>
    </PageBody>
  )
}
