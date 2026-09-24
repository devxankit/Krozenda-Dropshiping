import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Icon, Skeleton, Table } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath, userPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, NoData } from '../../components/feedback'
import { DateCell, KeyValueList, SectionCard, StatusPill } from '../../components/display'
import { CJ_ORDER_STATUS_TONE, CJ_SYNC_STATUS_TONE } from '../../constants'
import { USD_TO_INR_RATE, money } from '../../tableColumns/cjColumns'
import { useCjOnboardedProductDetailController } from '../../controllers/useCjController'

const SYNC_TONE = { IDLE: 'success', SYNCING: 'brand', FAILED: 'danger' }

function inr(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function dateOrDash(value) {
  return value ? <DateCell value={value} /> : '—'
}

function marginLabel(rule) {
  if (!rule) return '—'
  return rule.type === 'FLAT' ? `₹${rule.value} flat` : `${rule.value}%`
}

// Joins each Product variant (what the buyer picks and pays) with its CJ
// mapping row (what CJ charges and holds), so the table answers "what is my
// margin on this option, and does CJ still have it?" in one row.
function buildVariantRows(product, mapping) {
  const cjByKrozendaId = new Map(
    (mapping.variants || []).map((v) => [String(v.krozendaVariantId ?? ''), v]),
  )
  const productVariants = product.variants || []

  if (productVariants.length === 0) {
    const cj = mapping.variants?.[0] || {}
    return [
      {
        key: 'single',
        name: product.name,
        image: product.images?.[0] || null,
        sellingPrice: product.salePrice ?? product.price,
        stock: product.stock,
        cj,
      },
    ]
  }

  return productVariants.map((v) => ({
    key: String(v._id),
    name: v.name,
    image: v.image || product.images?.[0] || null,
    sellingPrice: v.salePrice ?? v.price ?? product.salePrice ?? product.price,
    stock: v.stock,
    cj: cjByKrozendaId.get(String(v._id)) || {},
  }))
}

const VARIANT_COLUMNS = (currency) => [
  {
    key: 'variant',
    header: 'Variant',
    render: (row) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
          {row.image && <img src={row.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900" title={row.name}>{row.name}</p>
          <p className="truncate text-2xs text-ink-faint">
            {row.cj.cjSku || row.cj.cjVariantId || 'No CJ variant linked'}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'cost',
    header: 'CJ cost',
    align: 'right',
    render: (row) =>
      row.cj.providerCost != null ? (
        <span className="tabular">
          {money(row.cj.providerCost, currency)}
          <span className="block text-2xs text-ink-faint">≈ {inr(Math.round(row.cj.providerCost * USD_TO_INR_RATE))}</span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'price',
    header: 'Selling price',
    align: 'right',
    render: (row) => <span className="tabular font-semibold text-slate-900">{inr(row.sellingPrice)}</span>,
  },
  {
    key: 'margin',
    header: 'Margin',
    align: 'right',
    render: (row) => {
      if (row.cj.providerCost == null || !row.sellingPrice) return '—'
      const costInr = row.cj.providerCost * USD_TO_INR_RATE
      const margin = row.sellingPrice - costInr
      const pct = costInr > 0 ? Math.round((margin / costInr) * 100) : null
      return (
        <span className={`tabular font-semibold ${margin < 0 ? 'text-danger-700' : 'text-success-700'}`}>
          {inr(Math.round(margin))}
          {pct != null && <span className="block text-2xs font-medium text-ink-faint">{pct}% on cost</span>}
        </span>
      )
    },
  },
  {
    key: 'stock',
    header: 'Stock (store / CJ)',
    align: 'right',
    render: (row) => (
      <span className={`tabular ${row.stock > 0 ? 'text-slate-900' : 'text-danger-700'}`}>
        {row.stock ?? 0} / {row.cj.providerStock ?? 0}
      </span>
    ),
  },
]

const SYNC_LOG_COLUMNS = [
  { key: 'createdAt', header: 'When', render: (row) => <DateCell value={row.createdAt} /> },
  { key: 'operation', header: 'Operation', render: (row) => row.operation.replace('_', ' ').toLowerCase() },
  { key: 'trigger', header: 'Trigger', render: (row) => row.trigger.toLowerCase() },
  {
    key: 'status',
    header: 'Result',
    render: (row) => <StatusPill status={row.status} tones={CJ_SYNC_STATUS_TONE} size="sm" />,
  },
  {
    key: 'error',
    header: 'Error',
    render: (row) =>
      row.error ? (
        <span className="block max-w-xs truncate text-danger-700" title={row.error}>{row.error}</span>
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
]

const ORDER_COLUMNS = [
  { key: 'createdAt', header: 'Placed', render: (row) => <DateCell value={row.createdAt} /> },
  {
    key: 'order',
    header: 'Krozenda order',
    render: (row) => (
      <Link to={adminPath.orderDetail(row.krozendaOrderId)} className="tabular font-semibold text-brand-700 hover:text-brand-600">
        {row.krozendaSubOrderId}
      </Link>
    ),
  },
  { key: 'cj', header: 'CJ order', render: (row) => row.cjOrderNumber || row.cjOrderId || '—' },
  { key: 'qty', header: 'Qty', align: 'right', render: (row) => <span className="tabular">{row.quantity}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusPill status={row.status} tones={CJ_ORDER_STATUS_TONE} size="sm" />,
  },
]

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function CjProductDetailPage() {
  const { productId } = useParams()
  const { data, isLoading, error, refetch, syncNow, isSyncing } = useCjOnboardedProductDetailController(productId)
  const [activeImage, setActiveImage] = useState(0)
  const [syncResult, setSyncResult] = useState(null)

  const trail = [{ label: data?.mapping?.product?.name || 'Product' }]

  if (isLoading) {
    return (
      <PageBody>
        <PageHeader title="CJ product" trail={trail} />
        <DetailSkeleton />
      </PageBody>
    )
  }

  if (error) {
    return (
      <PageBody>
        <PageHeader title="CJ product" trail={trail} />
        {error?.response?.status === 404 ? (
          <NoData
            message="This product is not linked to CJ"
            hint="It may have been removed, or it was never onboarded from the CJ catalogue."
          />
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </PageBody>
    )
  }

  const { mapping, syncLogs = [], orders = [], orderStats = {} } = data
  const product = mapping.product
  const images = product.images || []
  const variantRows = buildVariantRows(product, mapping)
  const totalCjStock = (mapping.variants || []).reduce((sum, v) => sum + (v.providerStock || 0), 0)

  const handleSync = async () => {
    setSyncResult(null)
    try {
      const res = await syncNow(mapping.cjProductId)
      setSyncResult(res?.success ? { tone: 'success', text: 'Stock and cost synced from CJ.' } : { tone: 'danger', text: res?.message || 'Sync failed.' })
    } catch (err) {
      setSyncResult({ tone: 'danger', text: err?.response?.data?.message || err.message || 'Sync failed.' })
    }
    refetch()
  }

  return (
    <PageBody>
      <PageHeader
        title={product.name}
        description={`CJ #${mapping.cjProductId}${mapping.cjProductName && mapping.cjProductName !== product.name ? ` · ${mapping.cjProductName}` : ''}`}
        trail={trail}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to={ADMIN_ROUTES.CJ_PRODUCTS}>
              <Button variant="quiet" size="control" icon="arrowLeft">
                All CJ products
              </Button>
            </Link>
            <a href={userPath.product(product._id)} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="control" icon="externalLink">
                View on store
              </Button>
            </a>
            <Link to={adminPath.productDetail(product._id)}>
              <Button variant="secondary" size="control" icon="edit">
                Edit product
              </Button>
            </Link>
            <Button size="control" icon="refresh" isLoading={isSyncing} onClick={handleSync}>
              Sync from CJ
            </Button>
          </div>
        }
      />

      {syncResult && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            syncResult.tone === 'success'
              ? 'border-success-200 bg-success-50 text-success-700'
              : 'border-danger-200 bg-danger-50 text-danger-700'
          }`}
        >
          {syncResult.text}
        </div>
      )}

      {mapping.syncStatus === 'FAILED' && mapping.lastSyncError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Last sync failed:</strong> {mapping.lastSyncError}
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Gallery */}
        <SectionCard title="Images">
          <div className="space-y-3 p-3">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-muted">
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-faint">
                  <Icon name="catalog" className="h-10 w-10" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    aria-label={`Show image ${idx + 1}`}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border ${
                      idx === activeImage ? 'border-brand-500 ring-1 ring-brand-500' : 'border-border'
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-4">
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Selling price', value: inr(product.salePrice ?? product.price) },
              { label: 'Store stock', value: (product.stock ?? 0).toLocaleString('en-IN') },
              { label: 'CJ stock', value: totalCjStock.toLocaleString('en-IN') },
              { label: 'Units sold', value: (orderStats.unitsSold ?? 0).toLocaleString('en-IN') },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-2xs font-medium text-ink-subtle">{tile.label}</p>
                <p className="tabular mt-1 text-lg font-bold text-slate-900">{tile.value}</p>
              </div>
            ))}
          </div>

          <SectionCard
            title="Listing"
            actions={
              <div className="flex gap-1.5">
                <Badge tone={product.isActive ? 'success' : 'neutral'} size="sm" dot>
                  {product.isActive ? 'Live' : 'Hidden'}
                </Badge>
                <Badge tone={SYNC_TONE[mapping.syncStatus] || 'neutral'} size="sm">
                  {mapping.syncStatus}
                </Badge>
              </div>
            }
          >
            <div className="px-4 py-1">
              <KeyValueList
                columns={2}
                items={[
                  { label: 'Category', value: product.category?.name || '—' },
                  { label: 'Brand', value: product.brand?.name || '—' },
                  { label: 'SKU', value: product.sku || '—' },
                  { label: 'Variants', value: (product.variants?.length || 0) || 'Single' },
                  { label: 'Pricing mode', value: mapping.pricingMode },
                  { label: 'Margin rule', value: marginLabel(mapping.marginRule) },
                  { label: 'Ships from', value: mapping.warehouseCountryCode || '—' },
                  { label: 'CJ currency', value: mapping.currency },
                  { label: 'CJ category id', value: mapping.cjCategoryId || '—' },
                  { label: 'CJ orders', value: orderStats.orderCount ?? 0 },
                  { label: 'Last synced', value: dateOrDash(mapping.lastSyncedAt) },
                  { label: 'Onboarded', value: dateOrDash(mapping.createdAt) },
                  { label: 'Onboarded by', value: mapping.onboardedBy?.name || mapping.onboardedBy?.email || '—' },
                  { label: 'Approval', value: product.approvalStatus || '—' },
                ]}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Variants"
        description={`What the buyer pays vs. what CJ charges, per option. ₹ figures use the display rate of ${USD_TO_INR_RATE} ${mapping.currency}/INR.`}
      >
        <Table
          columns={VARIANT_COLUMNS(mapping.currency)}
          data={variantRows}
          getRowKey={(row) => row.key}
          density="compact"
          emptyState={<NoData message="No variants mapped" />}
        />
      </SectionCard>

      <SectionCard title="Description">
        <p className="whitespace-pre-line px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {product.description || 'No description.'}
        </p>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Recent CJ orders" description={`${orderStats.orderCount ?? 0} order(s) in total`}>
          <Table
            columns={ORDER_COLUMNS}
            data={orders}
            getRowKey={(row) => row._id}
            density="compact"
            emptyState={<NoData message="No CJ orders for this product yet" />}
          />
        </SectionCard>

        <SectionCard
          title="Sync history"
          description="Last 20 stock/price syncs for this product."
          actions={
            <Link to={ADMIN_ROUTES.CJ_SYNC_LOGS} className="text-2xs font-semibold text-brand-700 hover:text-brand-600">
              All sync logs
            </Link>
          }
        >
          <Table
            columns={SYNC_LOG_COLUMNS}
            data={syncLogs}
            getRowKey={(row) => row._id}
            density="compact"
            emptyState={<NoData message="Not synced yet" hint="The hourly sync or “Sync from CJ” will log here." />}
          />
        </SectionCard>
      </div>
    </PageBody>
  )
}

export default CjProductDetailPage
