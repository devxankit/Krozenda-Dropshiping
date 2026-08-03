import { PageShell } from '../../../components/layout'
import { Skeleton } from '../../../components/ui'
import { useDashboardController } from '../controllers/useDashboardController'
import { StatTile } from '../components/StatTile'

// Reference example for this module's layer pattern (page -> controller ->
// service -> schema). Layer rule demonstrated: this page imports a
// controller hook, never a service or axios directly.
export function DashboardPage() {
  const { summary, isLoading, isError, error } = useDashboardController()

  if (isLoading) {
    return (
      <PageShell title="Admin Dashboard">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Admin Dashboard">
        <p className="text-sm text-danger-700">{error.message}</p>
      </PageShell>
    )
  }

  return (
    <PageShell title="Admin Dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total Users" value={summary.totalUsers} />
        <StatTile label="Total Sellers" value={summary.totalSellers} />
        <StatTile label="Pending Approvals" value={summary.pendingApprovals} />
        <StatTile label="Orders Today" value={summary.ordersToday} />
      </div>
    </PageShell>
  )
}
