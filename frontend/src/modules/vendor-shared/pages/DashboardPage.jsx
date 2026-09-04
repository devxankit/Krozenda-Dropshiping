import { Link } from 'react-router-dom'
import { Badge, Button, Table } from '../../../components/ui'
import { Skeleton } from '../../../components/ui'
import { useVendorDashboardController, useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_STATUS_LABELS } from '../constants'
import { MoneyCell, StatusPill } from '../../admin/components/display'
import { StatTile } from '../../admin/components/StatTile'
import { SectionCard } from '../../admin/components/display'
import { InlineAlert } from '../../admin/components/feedback'
import { VENDOR_ORDER_STATUS_TONE } from '../constants'

export function VendorDashboardPage() {
  const { summary, isLoading, isError, error } = useVendorDashboardController()
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
      header: 'Sub-Order ID',
      width: '9rem',
      render: (row) => <span className="font-mono text-xs font-semibold text-brand-700">{row.id}</span>,
    },
    {
      key: 'productName',
      header: 'Ordered Product',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-900">{row.productName}</span>
          <span className="text-ink-subtle">Qty: {row.quantity} · Buyer: {row.customerName}</span>
        </div>
      ),
    },
    {
      key: 'orderValue',
      header: 'Order Value',
      width: '7.5rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.orderValue} compact />,
    },
    {
      key: 'netPayable',
      header: 'Net Payout',
      width: '8rem',
      align: 'right',
      render: (row) => <MoneyCell amount={row.netPayable} compact className="font-semibold text-emerald-600" />,
    },
    {
      key: 'forwardingStatus',
      header: 'Status',
      width: '9rem',
      render: (row) => <StatusPill status={row.forwardingStatus} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-surface p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">{summary.storeName}</h1>
            <Badge tone="brand" size="sm">
              {VENDOR_STATUS_LABELS[summary.status] ?? summary.status}
            </Badge>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Vendor Operations Dashboard — Model A & Model B Seller Portal
          </p>
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
          Please upload your PAN, GSTIN, and Bank Account proof under KYC Documents to enable Razorpay Route settlement payouts.
        </InlineAlert>
      )}

      {/* KPI Stats Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Gross Revenue"
          value={`₹${(summary.totalRevenue / 100).toLocaleString('en-IN')}`}
          delta={{ direction: 'up', label: '+18.4%' }}
          tone="brand"
        />
        <StatTile
          label="Pending Dispatch Orders"
          value={summary.pendingOrdersCount}
          caption="Requires packing or AWB dispatch"
        />
        <StatTile
          label="Live Catalog SKUs"
          value={summary.liveSkusCount}
          caption="Active on buyer apps"
        />
        <StatTile
          label="Available Payout"
          value={`₹${(summary.availablePayout / 100).toLocaleString('en-IN')}`}
          caption="Eligible for Razorpay Route transfer"
          tone="brand"
        />
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link
          to="../products"
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs"
        >
          <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Catalog & Products</h3>
          <p className="mt-1 text-2xs text-ink-subtle">Manage SKU prices, B2B wholesale tiers, and stock availability.</p>
        </Link>
        <Link
          to="../orders"
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs"
        >
          <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Sub-Orders Fulfillment</h3>
          <p className="mt-1 text-2xs text-ink-subtle">Accept new orders, print packing slips, and generate Shiprocket AWBs.</p>
        </Link>
        <Link
          to="../settlements"
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs"
        >
          <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Settlements & Payouts</h3>
          <p className="mt-1 text-2xs text-ink-subtle">View Razorpay Route split transfers and download payout statements.</p>
        </Link>
        <Link
          to="../kyc-documents"
          className="group rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-xs"
        >
          <h3 className="text-xs font-semibold text-slate-900 group-hover:text-brand-700">Business KYC Docs</h3>
          <p className="mt-1 text-2xs text-ink-subtle">Upload GST certificate, PAN, cancelled cheque and Aadhaar verification.</p>
        </Link>
      </div>

      {/* Recent Sub-Orders Stream */}
      <SectionCard
        title="Assigned Sub-Orders Queue"
        description="Live stream of orders auto-assigned for warehouse packing and courier dispatch."
        actions={
          <Link to="../orders">
            <Button variant="ghost" size="sm" icon="arrowRight">
              View all orders
            </Button>
          </Link>
        }
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={columns}
          data={orders.items.slice(0, 5)}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>
    </div>
  )
}
