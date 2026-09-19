import { Link } from 'react-router-dom'
import { Badge } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { StatTile } from '../../components/StatTile'
import { useCjDashboardController, useCjSettingsController } from '../../controllers/useCjController'

function money(amount, currency = 'USD') {
  if (typeof amount !== 'number') return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function CjDashboardPage() {
  const dashboard = useCjDashboardController()
  const settings = useCjSettingsController()

  if (dashboard.isLoading || settings.isLoading) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping" description="Products, orders and fulfillment health for CJ-sourced products." />
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }

  if (dashboard.error) {
    return (
      <PageBody>
        <PageHeader title="CJ Dropshipping" />
        <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />
      </PageBody>
    )
  }

  const data = dashboard.data
  const isConnected = settings.data?.status === 'CONNECTED'

  return (
    <PageBody>
      <PageHeader
        title="CJ Dropshipping"
        description="Products, orders and fulfillment health for CJ-sourced products. Admin-only — sellers never see this module."
        actions={
          <Link to={ADMIN_ROUTES.CJ_SETTINGS}>
            <Badge tone={isConnected ? 'success' : 'danger'}>{settings.data?.status || 'DISCONNECTED'}</Badge>
          </Link>
        }
      />

      {!isConnected && (
        <InlineAlert tone="warning" title="No CJ account connected">
          Connect a CJ account in Settings before browsing the catalogue or onboarding products.
        </InlineAlert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="CJ Products"
          value={data.products.total}
          caption={`${data.products.outOfStock} out of stock`}
          tone="brand"
        />
        <StatTile label="Active Products" value={data.products.active} />
        <StatTile label="CJ Orders" value={data.orders.total} caption={`${data.orders.pendingFulfillment} pending`} />
        <StatTile label="In Transit" value={data.orders.inTransit} caption={`${data.orders.delivered} delivered`} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Disputes" value={data.returns.disputes} caption={`${data.returns.refundsApproved} approved`} />
        <StatTile
          label="Sync Failures (24h)"
          value={data.sync.failuresLast24h}
          tone={data.sync.failuresLast24h > 0 ? undefined : 'brand'}
        />
        <StatTile
          label="CJ Balance"
          value={data.balance ? money(data.balance.balance, data.balance.currency) : '—'}
          caption={data.balance ? undefined : 'Unreachable — check connection'}
        />
      </div>

      <SectionCard title="Quick actions" description="Where each module lives">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link to={ADMIN_ROUTES.CJ_CATALOGUE} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            Browse CJ catalogue
          </Link>
          <Link to={ADMIN_ROUTES.CJ_PRODUCTS} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            Onboarded products
          </Link>
          <Link to={ADMIN_ROUTES.CJ_ORDERS} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            CJ orders
          </Link>
          <Link to={ADMIN_ROUTES.CJ_SHIPMENTS} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            Shipments & tracking
          </Link>
          <Link to={ADMIN_ROUTES.CJ_DISPUTES} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            Returns & disputes
          </Link>
          <Link to={ADMIN_ROUTES.CJ_SYNC_LOGS} className="rounded-md border border-border p-3 text-xs font-medium text-slate-900 hover:bg-surface-muted">
            Sync logs
          </Link>
        </div>
      </SectionCard>
    </PageBody>
  )
}
