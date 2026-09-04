import { Link } from 'react-router-dom'
import { Badge, Button, Table } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { StatTile } from '../../components/StatTile'
import { MoneyCell } from '../../components/display'
import { useDropshipOverviewController } from '../../controllers/useDropshippingController'

export function DropshippingOverviewPage() {
  const { data, isLoading, error, refetch } = useDropshipOverviewController()

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

  const columns = [
    {
      key: 'subOrderId',
      header: 'Sub-Order ID',
      width: '9rem',
      render: (row) => (
        <Link
          to={`/admin/orders/sub-orders/${row.subOrderId}`}
          className="font-mono text-xs font-semibold text-brand-600 hover:underline"
        >
          {row.subOrderId}
        </Link>
      ),
    },
    {
      key: 'partnerName',
      header: 'Assigned Partner',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-900">{row.partnerName}</span>
          <span className="text-ink-subtle">{row.productName} (x{row.qty})</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Order amount',
      width: '7.5rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.amount} compact />,
    },
    {
      key: 'commission',
      header: 'Margin revenue',
      width: '8rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.commission} compact className="font-semibold text-emerald-600" />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '8.5rem',
      render: (row) => (
        <Badge
          tone={
            row.status === 'shipped'
              ? 'success'
              : row.status === 'vendor_accepted' || row.status === 'packed'
              ? 'brand'
              : 'warning'
          }
          size="sm"
        >
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'forwardedAt',
      header: 'Forwarded',
      width: '7.5rem',
      render: (row) => <span className="text-xs text-ink-muted">{row.forwardedAt}</span>,
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title="Dropshipping Hub"
        description="Model A Direct Dropshipping — supplier onboarding, catalog margin controls, auto-order forwarding & sync health."
        actions={
          <Link to={ADMIN_ROUTES.SUPPLIER_SYNC}>
            <Button variant="secondary" size="control" icon="refresh">
              Supplier sync status
            </Button>
          </Link>
        }
      />

      <InlineAlert tone="info" title="Model A — Direct Dropshipping Architecture">
        External suppliers (manufacturers, wholesalers, dealers) ship directly to buyers.
        Customer payment is collected by Krozenda, orders are auto-forwarded to suppliers, and platform commission is deducted upon settlement via Razorpay Route.
      </InlineAlert>

      {/* KPI Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active Suppliers"
          value={data.activePartners}
          caption={`${data.pendingPartners} pending KYC approval`}
          tone="brand"
        />
        <StatTile
          label="Live Dropship SKUs"
          value={data.liveSkus}
          caption="Synchronized across 2 adapters"
        />
        <StatTile
          label="Orders Forwarded Today"
          value={data.forwardedOrdersToday}
          delta={{ direction: 'up', label: '+14%' }}
        />
        <StatTile
          label="Platform Margin Today"
          value={`₹${(data.platformMarginToday / 100).toLocaleString('en-IN')}`}
          delta={{ direction: 'up', label: '15.0% avg' }}
          tone="brand"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to={ADMIN_ROUTES.DROPSHIPPING_PARTNERS}
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600">
              Dropship Partners
            </h3>
            <Badge tone="brand" size="sm">
              {data.activePartners} Active
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            Manage external supplier onboarding, KYC review, contact details, and linked payout accounts.
          </p>
        </Link>

        <Link
          to={ADMIN_ROUTES.DROPSHIPPING_PRODUCTS}
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600">
              Dropship Catalog & Margins
            </h3>
            <Badge tone="neutral" size="sm">
              {data.liveSkus} SKUs
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            View supplier cost price vs list price, calculated gross margin %, and stock availability.
          </p>
        </Link>

        <Link
          to={ADMIN_ROUTES.DROPSHIPPING_ORDERS}
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600">
              Auto-Forwarded Orders
            </h3>
            <Badge tone="success" size="sm">
              {data.autoForwardSuccessRate}% Success
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            Track auto-assigned sub-orders, supplier acceptance state, packing slips, and shipment AWB generation.
          </p>
        </Link>
      </div>

      {/* Stream of Recent Forwarded Orders */}
      <SectionCard
        title="Recent Auto-Forwarded Sub-Orders"
        description="Sub-orders routed to dropshipping suppliers for direct packing and fulfillment."
        actions={
          <Link to={ADMIN_ROUTES.DROPSHIPPING_ORDERS}>
            <Button variant="ghost" size="sm" icon="arrowRight">
              View all
            </Button>
          </Link>
        }
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={columns}
          data={data.recentOrders}
          getRowKey={(row) => row.subOrderId}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}
