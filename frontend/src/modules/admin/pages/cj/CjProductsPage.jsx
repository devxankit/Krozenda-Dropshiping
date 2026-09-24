import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Icon,
} from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, NoData } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { USD_TO_INR_RATE } from '../../tableColumns/cjColumns'
import {
  useCjOnboardedProductsController,
  useCjProductCategorySummaryController,
  useCjBulkPricingController,
} from '../../controllers/useCjController'

const PAGE_SIZE = 20

const CJ_NAV_ITEMS = [
  { label: 'Dashboard', to: ADMIN_ROUTES.CJ_DASHBOARD, icon: 'dashboard' },
  { label: 'Category', to: ADMIN_ROUTES.CJ_CATEGORY, icon: 'catalog' },
  { label: 'Products', to: ADMIN_ROUTES.CJ_PRODUCTS, icon: 'products' },
  { label: 'Orders', to: ADMIN_ROUTES.CJ_ORDERS, icon: 'orders' },
  { label: 'Onboard Products', to: ADMIN_ROUTES.CJ_CATALOGUE, icon: 'add' },
  { label: 'Settings', to: ADMIN_ROUTES.CJ_SETTINGS, icon: 'settings' },
]

function applyClientRounding(rawPrice, rounding) {
  if (typeof rawPrice !== 'number' || !Number.isFinite(rawPrice) || rawPrice <= 0) return 0
  if (rounding === 'ROUND') return Math.round(rawPrice)
  if (rounding === '9_ENDING') {
    const rounded = Math.round(rawPrice)
    if (rounded < 10) return rounded
    return Math.floor(rounded / 10) * 10 + 9
  }
  return Math.round(rawPrice * 100) / 100
}

function calculatePreviewNewPrice({ cjCostInr, currentPrice, method, value, applyOn, rounding }) {
  const numVal = Number(value) || 0
  if (applyOn === 'CJ_COST') {
    const base = cjCostInr > 0 ? cjCostInr : currentPrice
    if (method === 'FIXED') {
      return applyClientRounding(base + numVal, rounding)
    }
    if (method === 'DECREASE_PERCENT') {
      return applyClientRounding(Math.max(1, base - (base * (numVal / 100))), rounding)
    }
    // INCREASE_PERCENT
    return applyClientRounding(base + (base * (numVal / 100)), rounding)
  }

  // CURRENT_PRICE
  const base = currentPrice || 0
  if (method === 'FIXED') {
    return applyClientRounding(base + numVal, rounding)
  }
  if (method === 'DECREASE_PERCENT') {
    return applyClientRounding(Math.max(1, base - (base * (numVal / 100))), rounding)
  }
  return applyClientRounding(base + (base * (numVal / 100)), rounding)
}

function BulkPricingModal({
  isOpen,
  onClose,
  selectedRows = [],
  onSuccess,
}) {
  const { bulkAdjust, isAdjusting, error } = useCjBulkPricingController()

  const [method, setMethod] = useState('INCREASE_PERCENT')
  const [value, setValue] = useState('30')
  const [applyOn, setApplyOn] = useState('CJ_COST')
  const [rounding, setRounding] = useState('ROUND')

  if (!isOpen) return null

  const selectedCount = selectedRows.length

  const handleApply = async () => {
    const productIds = selectedRows.map((r) => r.product?._id).filter(Boolean)
    if (productIds.length === 0) return

    try {
      const res = await bulkAdjust({
        productIds,
        percentage: Number(value) || 0,
        method,
        applyOn,
        rounding,
      })
      onSuccess?.(res?.message || `Updated pricing for ${res?.data?.updatedCount || productIds.length} products.`)
      onClose()
    } catch {
      // Handled by controller error state
    }
  }

  // Generate preview items from selected rows
  const previewItems = selectedRows.slice(0, 6).map((row) => {
    const product = row.product
    const firstMappingVariant = row.variants?.[0]
    const cjCostInr = firstMappingVariant?.providerCost != null
      ? Math.round(firstMappingVariant.providerCost * USD_TO_INR_RATE)
      : 0

    const currentPrice = product?.price || 0
    const newPrice = calculatePreviewNewPrice({
      cjCostInr,
      currentPrice,
      method,
      value,
      applyOn,
      rounding,
    })

    const marginInr = newPrice - cjCostInr
    const marginPct = cjCostInr > 0 ? Math.round((marginInr / cjCostInr) * 100) : null

    return {
      id: product?._id || row._id,
      name: product?.name || row.cjProductName || row.cjProductId,
      cjCostInr,
      currentPrice,
      newPrice,
      marginInr,
      marginPct,
    }
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Price Adjustment"
      description={`Adjust selling prices across ${selectedCount} selected CJ product(s)`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-2xs text-ink-muted">
            {selectedCount > 6 ? `Showing 6 of ${selectedCount} in preview` : `Previewing all ${selectedCount} product(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="control" onClick={onClose} disabled={isAdjusting}>
              Cancel
            </Button>
            <Button
              size="control"
              icon="check"
              isLoading={isAdjusting}
              disabled={!value || Number(value) <= 0 || selectedCount === 0}
              onClick={handleApply}
            >
              Apply to {selectedCount} Product{selectedCount > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {error && (
          <InlineAlert tone="danger" title="Could not apply price adjustment">
            {error?.response?.data?.message || error.message}
          </InlineAlert>
        )}

        {/* Pricing Strategy Form */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Method */}
          <div>
            <Select
              id="bulkMethod"
              label="Adjustment Method"
              size="control"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={[
                { value: 'INCREASE_PERCENT', label: 'Increase by % (Markup)' },
                { value: 'DECREASE_PERCENT', label: 'Decrease by % (Discount)' },
                { value: 'FIXED', label: 'Fixed Amount (₹ Margin)' },
              ]}
            />
          </div>

          {/* Value */}
          <div>
            <Input
              id="bulkValue"
              label={method === 'FIXED' ? 'Amount (₹)' : 'Percentage (%)'}
              type="number"
              min="0"
              size="control"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="30"
            />
          </div>

          {/* Rounding */}
          <div>
            <Select
              id="bulkRounding"
              label="Price Rounding"
              size="control"
              value={rounding}
              onChange={(e) => setRounding(e.target.value)}
              options={[
                { value: 'ROUND', label: 'Whole Rupee (₹649)' },
                { value: '9_ENDING', label: '9-Ending Charm (₹649)' },
                { value: 'NONE', label: 'Exact Cents (₹648.70)' },
              ]}
            />
          </div>
        </div>

        {/* Apply On Target */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">Apply Adjustment On:</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                applyOn === 'CJ_COST'
                  ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="applyOn"
                value="CJ_COST"
                checked={applyOn === 'CJ_COST'}
                onChange={() => setApplyOn('CJ_COST')}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">CJ Product Cost (Recommended)</p>
                <p className="text-2xs text-ink-subtle mt-0.5 leading-snug">
                  Computes selling price directly on wholesale cost: <code>CJ Cost × (1 + Markup%)</code>. Protects margins per variant.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                applyOn === 'CURRENT_PRICE'
                  ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="applyOn"
                value="CURRENT_PRICE"
                checked={applyOn === 'CURRENT_PRICE'}
                onChange={() => setApplyOn('CURRENT_PRICE')}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold text-slate-900">Current Selling Price</p>
                <p className="text-2xs text-ink-subtle mt-0.5 leading-snug">
                  Adjusts existing retail price directly: <code>Current Price × (1 ± %)</code>.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Live Calculation Preview Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-surface-muted px-3 py-2 border-b border-border flex items-center justify-between text-2xs font-semibold text-slate-900">
            <span>Sample Calculation Preview</span>
            <span className="text-ink-muted">Calculated using {USD_TO_INR_RATE} USD/INR</span>
          </div>

          <div className="overflow-x-auto max-h-56">
            <table className="min-w-full text-left text-xs border-collapse">
              <thead className="bg-surface border-b border-border-subtle text-ink-subtle text-2xs uppercase">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">CJ Cost</th>
                  <th className="px-3 py-2 text-right">Current Price</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-900">New Selling Price</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface">
                {previewItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/50">
                    <td className="px-3 py-2 max-w-xs truncate font-medium text-slate-900" title={item.name}>
                      {item.name}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-muted">
                      {item.cjCostInr > 0 ? `₹${item.cjCostInr.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-subtle line-through">
                      ₹{item.currentPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-brand-700">
                      ₹{item.newPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.marginPct != null ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-2xs font-semibold text-emerald-700">
                          +{item.marginPct}%
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const SYNC_TONE = { IDLE: 'success', SYNCING: 'brand', FAILED: 'danger' }
const PRICING_TONE = { MANUAL: 'neutral', AUTOMATIC: 'brand' }

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

// Every field an admin needs to judge one onboarded CJ product at a glance —
// image, category, price, stock, pricing mode and sync health — in one card,
// so this screen no longer requires a dense-table read to answer "is this
// product okay?".
function CjProductCard({ row, isSelected, onToggleSelect }) {
  const product = row.product || {}
  const image = product.images?.[0] || null
  const productId = product._id || row._id

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-surface transition-all hover:shadow-sm ${
        isSelected ? 'border-brand-400 ring-1 ring-brand-400' : 'border-border hover:border-brand-200'
      }`}
    >
      <label className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border border-border bg-surface/90 shadow-xs backdrop-blur">
        <input
          type="checkbox"
          className="h-3.5 w-3.5"
          checked={isSelected}
          onChange={() => onToggleSelect(productId)}
          aria-label={`Select ${product.name || row.cjProductName || 'product'}`}
        />
      </label>

      <Link to={adminPath.cjProductDetail(product._id || productId)} className="block">
      <div className="aspect-square w-full overflow-hidden bg-surface-muted">
        {image ? (
          <img src={image} alt={product.name || ''} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <Icon name="catalog" className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="truncate text-xs font-semibold text-slate-900" title={product.name || row.cjProductName}>
          {product.name || row.cjProductName || row.cjProductId}
        </p>
        <p className="text-2xs text-ink-muted">CJ #{row.cjProductId}</p>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {product.category?.name && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-2xs font-medium text-ink-subtle">
              {product.category.name}
            </span>
          )}
          <Badge tone={PRICING_TONE[row.pricingMode] || 'neutral'} size="sm">
            {row.pricingMode}
          </Badge>
          <Badge tone={SYNC_TONE[row.syncStatus] || 'neutral'} size="sm">
            {row.syncStatus}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-slate-900">
            {product.price != null ? `₹${product.price.toLocaleString('en-IN')}` : '—'}
          </span>
          <span className={`text-2xs font-semibold ${product.stock > 0 ? 'text-ink-muted' : 'text-danger-600'}`}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>
      </div>
      </Link>
    </div>
  )
}

export function CjProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('categoryId') || ''
  const [pageNum, setPageNum] = useState(1)
  const { categories } = useCjProductCategorySummaryController()
  const { data, isLoading, error, refetch } = useCjOnboardedProductsController({
    pageNum,
    pageSize: PAGE_SIZE,
    ...(categoryId ? { categoryId } : {}),
  })

  const handleCategoryChange = (value) => {
    setPageNum(1)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('categoryId', value)
        else next.delete('categoryId')
        return next
      },
      { replace: true },
    )
  }

  const [selectedKeys, setSelectedKeys] = useState([])
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [successToast, setSuccessToast] = useState('')

  const list = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Find the selected full row objects from the current page
  const selectedRows = list.filter((row) =>
    selectedKeys.includes(row.product?._id || row._id)
  )

  const handleBulkSuccess = (message) => {
    setSelectedKeys([])
    setSuccessToast(message)
    refetch()
    setTimeout(() => setSuccessToast(''), 4000)
  }

  return (
    <PageBody>
      {/* ── CJ MODULE NAVIGATION BAR ── */}
      <nav aria-label="CJ Navigation" className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
        {CJ_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-ink-subtle hover:text-slate-900 hover:bg-surface-muted'
              }`}
            >
              <Icon name={item.icon} className={`h-3.5 w-3.5 ${isActive ? 'text-brand-600' : 'text-ink-faint'}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <PageHeader
        title="CJ Products"
        description="Products onboarded from CJ's live catalogue into Krozenda's own catalog. Customers only ever see this data, never CJ directly."
        actions={
          <div className="flex items-center gap-2">
            {selectedKeys.length > 0 && (
              <Button
                variant="primary"
                size="control"
                icon="sliders"
                onClick={() => setIsBulkModalOpen(true)}
              >
                Bulk Price Adjustment ({selectedKeys.length})
              </Button>
            )}
            <Link to={ADMIN_ROUTES.CJ_CATALOGUE}>
              <Button size="control" icon="add" variant={selectedKeys.length > 0 ? 'secondary' : 'primary'}>
                Onboard from catalogue
              </Button>
            </Link>
          </div>
        }
      />

      {successToast && (
        <InlineAlert tone="success" title="Pricing Updated">
          {successToast}
        </InlineAlert>
      )}

      {/* Floating Action Bar for Selection */}
      {selectedKeys.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-2xs">
              {selectedKeys.length}
            </span>
            <span className="text-xs font-semibold text-brand-900">
              {selectedKeys.length} product{selectedKeys.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="quiet"
              size="xs"
              onClick={() => setSelectedKeys([])}
            >
              Deselect All
            </Button>
            <Button
              variant="primary"
              size="xs"
              icon="sliders"
              onClick={() => setIsBulkModalOpen(true)}
            >
              Adjust Pricing
            </Button>
          </div>
        </div>
      )}

      <SectionCard
        title="Onboarded Products"
        description={`${total} total product(s) linked to CJ fulfillment.`}
        actions={
          <div className="flex items-center gap-3">
            <Select
              id="cjProductCategoryFilter"
              aria-label="Filter by category"
              size="control"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((cat) => ({
                  value: cat.categoryId || '',
                  label: `${cat.name} (${cat.productCount})`,
                })),
              ]}
            />
            {total > 0 && (
              <span className="text-2xs text-ink-muted whitespace-nowrap">
                Select products to adjust profit margins in bulk
              </span>
            )}
          </div>
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <NoData
            message="No CJ products onboarded yet"
            hint="Browse the live CJ catalogue and onboard a product to see it here."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {list.map((row) => {
                const key = row.product?._id || row._id
                return (
                  <CjProductCard
                    key={key}
                    row={row}
                    isSelected={selectedKeys.includes(key)}
                    onToggleSelect={(id) =>
                      setSelectedKeys((prev) =>
                        prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
                      )
                    }
                  />
                )
              })}
            </div>
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="products"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Bulk Pricing Adjustment Modal */}
      <BulkPricingModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedRows={selectedRows}
        onSuccess={handleBulkSuccess}
      />
    </PageBody>
  )
}

export default CjProductsPage
