import { PageShell } from '../../../components/layout'
import { Skeleton, Badge } from '../../../components/ui'
import { useDashboardController } from '../controllers/useDashboardController'

// Reference example for this module's layer pattern (page -> controller ->
// service -> schema). Auth's real first pages are Login/Register — this
// exists purely as the template every other page in this module should
// copy. Layer rule demonstrated: this page imports a controller hook, never
// a service or axios directly.
export function DashboardPage() {
  const { session, isLoading, isError, error } = useDashboardController()

  if (isLoading) {
    return (
      <PageShell title="Session">
        <Skeleton className="h-24 w-full" />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Session">
        <p className="text-sm text-danger-700">{error.message}</p>
      </PageShell>
    )
  }

  return (
    <PageShell title="Session">
      <Badge tone={session.isAuthenticated ? 'success' : 'neutral'}>
        {session.isAuthenticated ? 'Active session' : 'No active session'}
      </Badge>
    </PageShell>
  )
}
