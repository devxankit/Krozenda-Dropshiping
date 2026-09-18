import { Link } from 'react-router-dom'
import { Badge, Button, Table } from '../../../components/ui'
import { Skeleton } from '../../../components/ui'
import { useVendorDashboardController, useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_ORDER_STATUS_TONE, VENDOR_STATUS_LABELS } from '../constants'
import { MoneyCell, StatusPill } from '../../admin/components/display/cells'
import { StatTile } from '../../admin/components/StatTile'
import { SectionCard } from '../../admin/components/display'
import { InlineAlert } from '../../admin/components/feedback'

export function VendorDashboardPage() {
  const { data: summary, isLoading, isError, error } = useVendorDashboardController()
  const orders = useVendorOrdersController()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 rounded-lg bg-danger-50 text-danger-700 text-xs">
        <p className="font-semibold">{error?.message || 'Failed to load vendor dashboard'}</p>
      </div>
    )
  }

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{summary.storeName}</h1>
            <Badge tone="brand" size="sm">
              {VENDOR_STATUS_LABELS[summary.status] ?? summary.status}
            </Badge>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">Seller Operations Dashboard</p>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {summary.kycStatus !== 'approved' && (
        <InlineAlert tone="warning" title="KYC Verification Required">
          Upload your PAN, GSTIN, and Bank Account proof under KYC Documents to get your seller account fully approved.
        </InlineAlert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Delivered Revenue" value={`₹${(summary.totalRevenue / 100).toLocaleString('en-IN')}`} tone="brand" />
        <StatTile label="Pending Orders" value={summary.pendingOrdersCount} caption="Awaiting processing or shipping" />
        <StatTile label="Live Products" value={summary.liveSkusCount} caption="Active on buyer apps" />
        <StatTile
          label="Due for Payout"
          value={`₹${(summary.availablePayout / 100).toLocaleString('en-IN')}`}
          caption="In a settlement batch, not yet transferred"
          tone="brand"
        />
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
    </div>
  )
}
