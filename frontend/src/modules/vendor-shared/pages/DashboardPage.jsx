import { PageShell } from '../../../components/layout'
import { Skeleton, Badge } from '../../../components/ui'
import { useVendorDashboardController } from '../controllers/useVendorDashboardController'
import { VendorStatsGrid } from '../components/VendorStatsGrid'
import { VENDOR_STATUS_LABELS } from '../constants'

// Reference example for the vendor-shared surface. seller/ and
// dropshipping-partner/ both mount THIS page (via ../vendor-shared/routes)
// instead of each having their own copy — see routes.jsx in this module.
//
// Layer rule demonstrated: page imports a controller hook, never a service
// or axios directly (enforced by eslint.config.js for everything under
// pages/).
export function VendorDashboardPage() {
  const { summary, isLoading, isError, error } = useVendorDashboardController()

  if (isLoading) {
    return (
      <PageShell title="Dashboard">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell title="Dashboard">
        <p className="text-sm text-danger-700">{error.message}</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Dashboard"
      actions={<Badge tone="brand">{VENDOR_STATUS_LABELS[summary.status] ?? summary.status}</Badge>}
    >
      <VendorStatsGrid summary={summary} />
    </PageShell>
  )
}
