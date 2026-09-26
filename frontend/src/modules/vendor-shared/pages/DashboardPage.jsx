import { Link, useLocation } from 'react-router-dom'
import { Badge, Button, Table } from '../../../components/ui'
import { Skeleton } from '../../../components/ui'
import { useVendorAnalyticsController, useVendorDashboardController, useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_ORDER_STATUS_TONE, VENDOR_STATUS_LABELS } from '../constants'
import { MoneyCell, StatusPill } from '../../admin/components/display/cells'
import { SectionCard } from '../../admin/components/display'
import { InlineAlert } from '../../admin/components/feedback'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { KpiGrid, OrderPipeline } from '../../admin/components/dashboard'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../../admin/components/charts'
import { formatMoney } from '../../admin/components/display'
import { MobileSellerDashboard } from '../components/dashboard/MobileSellerDashboard'

// Order lifecycle stages shown in the funnel, in the order they occur. Not
// every vendor status enum shows up here — CANCELLED is an exception branch,
// not a stage, same split the admin dashboard's pipeline uses.
const PIPELINE_STAGES = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
]

const REVENUE_SERIES = [{ key: 'revenue', label: 'Revenue' }]

function shortDate(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function VendorDashboardPage() {
  const location = useLocation()
  const basePath = location.pathname.startsWith('/partner') ? '/partner' : '/seller'
  const { data: summary, isLoading, isError, error } = useVendorDashboardController()
  const { data: analytics, isLoading: isAnalyticsLoading } = useVendorAnalyticsController()
  const orders = useVendorOrdersController()

  if (isLoading || isAnalyticsLoading) {
    return (
      <PageBody>
        <Skeleton className="h-40 w-full" />
      </PageBody>
    )
  }

  if (isError) {
    return (
      <PageBody>
        <div className="p-4 rounded-lg bg-danger-50 text-danger-700 text-xs">
          <p className="font-semibold">{error?.message || 'Failed to load vendor dashboard'}</p>
        </div>
      </PageBody>
    )
  }

  const salesTrend = analytics?.salesTrend ?? []
  const statusBreakdown = analytics?.orderStatusBreakdown ?? {}

  const revenueTrend = salesTrend.map((point) => ({ value: point.revenue }))
  const ordersTrend = salesTrend.map((point) => ({ value: point.orders }))

  const kpis = [
    {
      key: 'revenue',
      label: 'Delivered Revenue',
      value: summary.totalRevenue,
      format: 'money',
      tone: 'brand',
      caption: 'From delivered orders',
      trend: revenueTrend,
    },
    {
      key: 'pending',
      label: 'Pending Orders',
      value: summary.pendingOrdersCount,
      caption: 'Awaiting processing or shipping',
      trend: ordersTrend,
    },
    {
      key: 'products',
      label: 'Live Products',
      value: summary.liveSkusCount,
      caption: 'Active on buyer apps',
    },
    {
      key: 'payout',
      label: 'Due for Payout',
      value: summary.availablePayout,
      format: 'money',
      tone: 'brand',
      caption: 'In a settlement batch, not yet transferred',
      trend: revenueTrend,
    },
  ]

  const pipeline = PIPELINE_STAGES.map((stage) => ({
    status: stage.status,
    label: stage.label,
    count: statusBreakdown[stage.status] || 0,
  }))

  const exceptions = [
    { label: 'Cancelled', count: statusBreakdown.CANCELLED || 0, tone: 'danger' },
  ]

  const chartData = salesTrend.map((point) => ({ label: shortDate(point.date), revenue: point.revenue }))
  const hasRevenue = chartData.some((point) => point.revenue > 0)

  const columns = [
    {
      key: 'id',
      header: 'Order ID',
      width: '9rem',
      render: (row) => <span className="font-mono text-xs font-semibold text-brand-700">{row.id.slice(-8).toUpperCase()}</span>,
    },
    {
      key: 'items',
      header: 'Ordered Product',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-900">{row.items[0]?.name}</span>
          <span className="text-ink-subtle">Buyer: {row.customer.name}</span>
        </div>
      ),
    },
    {
      key: 'itemsValue',
      header: 'Order Value',
      width: '7.5rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.itemsValue} compact />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '9rem',
      render: (row) => <StatusPill status={row.status} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />,
    },
  ]

  return (
    <>
      {/* Mobile App View (Visible only on mobile/tablet < lg) */}
      <div className="block lg:hidden">
        <MobileSellerDashboard
          summary={summary}
          analytics={analytics}
          orders={orders}
          basePath={basePath}
        />
      </div>

      {/* Desktop Dashboard View (Visible only on desktop >= lg) */}
      <div className="hidden lg:block">
        <PageBody>
          <PageHeader
            title={summary.storeName}
            description="Seller Operations Dashboard"
            actions={
              <>
                <Link to="../kyc-documents">
                  <Button variant="secondary" size="sm">
                    KYC Documents
                  </Button>
                </Link>
                <Link to="../products">
                  <Button size="sm" icon="add">
                    Add Product
                  </Button>
                </Link>
              </>
            }
          >
            <Badge tone="brand" size="sm">
              {VENDOR_STATUS_LABELS[summary.status] ?? summary.status}
            </Badge>
          </PageHeader>

          {summary.kycStatus !== 'approved' && (
            <InlineAlert tone="warning" title="KYC Verification Required">
              Upload your PAN, GSTIN, and Bank Account proof under KYC Documents to get your seller account fully approved.
            </InlineAlert>
          )}

          <KpiGrid kpis={kpis} columns={4} />

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <ChartFrame
              title="Revenue trend"
              description="Daily gross revenue, last 30 days"
              series={REVENUE_SERIES}
              height={280}
            >
              {hasRevenue ? (
                <AreaTrend
                  data={chartData}
                  series={REVENUE_SERIES}
                  formatAxis={formatAxisRupees}
                  formatValue={(value) => formatMoney(value, { compact: true })}
                  stacked={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
                  No revenue in the last 30 days
                </div>
              )}
            </ChartFrame>

            <OrderPipeline pipeline={pipeline} exceptions={exceptions} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Link to="../products" className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
              <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Products</h3>
              <p className="mt-1 text-2xs text-ink-subtle">Manage your catalog, pricing, and stock availability.</p>
            </Link>
            <Link to="../orders" className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
              <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Orders</h3>
              <p className="mt-1 text-2xs text-ink-subtle">Process, pack and ship items from your orders.</p>
            </Link>
            <Link to="../earnings" className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
              <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Earnings & Settlements</h3>
              <p className="mt-1 text-2xs text-ink-subtle">View your sales, commission and net earnings.</p>
            </Link>
            <Link to="../kyc-documents" className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs">
              <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">KYC Documents</h3>
              <p className="mt-1 text-2xs text-ink-subtle">Upload GST certificate, PAN and bank proof.</p>
            </Link>
          </div>

          <SectionCard
            title="Recent Orders"
            description="Latest orders containing your products."
            actions={
              <Link to="../orders">
                <Button variant="ghost" size="sm" icon="arrowRight">
                  View all orders
                </Button>
              </Link>
            }
          >
            <Table className="rounded-none border-0 border-t" columns={columns} data={orders.items.slice(0, 5)} getRowKey={(row) => row.id} density="compact" />
          </SectionCard>
        </PageBody>
      </div>
    </>
  )
}
