import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Icon, Input, Pagination, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { adminPath } from '../../../../config/routes'
import { toast } from '../../stores/toastStore'
import { AdminImportModal } from '../../../catalog-import/components/AdminImportModal'
import { useApprovePreviewProducts } from '../../../catalog-import/controllers/useProductImportController'
import { ProductFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ScanBarcodeModal } from '../../../../components/common/ScanBarcodeModal'
import {
  useApprovalSettingsController,
  useBrandsController,
  useCategoryTreeController,
  useProductListController,
  useProductWriteController,
} from '../../controllers/useCatalogController'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE
const PAGE_SIZE = 10

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function PreviewBadge({ floating = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ${
        floating ? 'shadow-xs backdrop-blur-md' : ''
      }`}
      title="Imported from CSV — Draft, hidden from buyers until approved"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Preview · Draft
    </span>
  )
}

function ApproveButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-2xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
      title="Approve — make this imported product live"
    >
      <Icon name="check" className="h-3 w-3" />
      Approve
    </button>
  )
}

export function ProductsPage() {
  const products = useProductListController()
  const categories = useCategoryTreeController()
  const brands = useBrandsController()
  const { data: approvalSettings } = useApprovalSettingsController()
  const isSellerOnlyOn = Boolean(approvalSettings?.sellerOnlyMode)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive' | 'out_of_stock'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'price-asc' | 'price-desc' | 'name-asc' | 'stock-low'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  const [editingProduct, setEditingProduct] = useState(null)
  const [removingProduct, setRemovingProduct] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [approveAllOpen, setApproveAllOpen] = useState(false)
  const navigate = useNavigate()

  // CSV-imported products arrive as hidden Draft "previews"; this is the only
  // way they go live (the visibility switch refuses them server-side).
  const approvePreviews = useApprovePreviewProducts('/admin/catalog/import', {
    productQueryKeys: [['admin', 'catalog']],
  })
  async function approveImported(payload) {
    try {
      const res = await approvePreviews.mutateAsync(payload)
      toast.success('Approved', res.message)
    } catch (err) {
      toast.error('Could not approve', err.message)
    }
  }
  const [page, setPage] = useState(1)

  const writer = useProductWriteController({
    onSaved: () => setEditingProduct(null),
  })

  const productItems = useMemo(() => products.data?.items || [], [products.data])
  const categoryItems = useMemo(
    () => (categories.data?.items || []).filter((c) => c.isActive),
    [categories.data],
  )
  const brandItems = useMemo(
    () => (brands.data?.items || []).filter((b) => b.isActive),
    [brands.data],
  )

  const totalCount = productItems.length
  const activeCount = useMemo(() => productItems.filter((p) => p.isActive).length, [productItems])
  const inactiveCount = totalCount - activeCount
  const outOfStockCount = useMemo(() => productItems.filter((p) => p.stock <= 0).length, [productItems])
  const flashSaleCount = useMemo(() => productItems.filter((p) => p.isFlashsale).length, [productItems])
  const trendingCount = useMemo(() => productItems.filter((p) => p.isTrending).length, [productItems])
  const previewCount = useMemo(() => productItems.filter((p) => p.importPreview).length, [productItems])
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0

  const filteredProducts = useMemo(() => {
    const list = productItems.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false
      if (statusFilter === 'out_of_stock' && item.stock > 0) return false
      if (statusFilter === 'flash_sale' && !item.isFlashsale) return false
      if (statusFilter === 'trending' && !item.isTrending) return false
      if (statusFilter === 'preview' && !item.importPreview) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return Boolean(
          item.name?.toLowerCase().includes(q) ||
            item.sku?.toLowerCase().includes(q) ||
            item.category?.name?.toLowerCase().includes(q) ||
            item.brand?.name?.toLowerCase().includes(q),
        )
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return (a.salePrice ?? a.price ?? 0) - (b.salePrice ?? b.price ?? 0)
      if (sortBy === 'price-desc') return (b.salePrice ?? b.price ?? 0) - (a.salePrice ?? a.price ?? 0)
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'stock-low') return (a.stock || 0) - (b.stock || 0)
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })
  }, [productItems, statusFilter, searchQuery, sortBy])

  // Resets to page 1 whenever the filters change, following the React pattern
  // for adjusting state during render instead of a setState-in-effect.
  const filterKey = `${statusFilter}|${searchQuery}|${sortBy}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredProducts, currentPage],
  )

  if (products.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (products.error) {
    return (
      <PageBody>
        <ErrorState error={products.error} onRetry={products.refetch} />
      </PageBody>
    )
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Products', count: totalCount },
    { id: 'flash_sale', label: '🔥 Flash Sale', count: flashSaleCount },
    { id: 'trending', label: '📈 Trending', count: trendingCount },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
    { id: 'out_of_stock', label: 'Out of Stock', count: outOfStockCount },
    ...(previewCount > 0 || statusFilter === 'preview'
      ? [{ id: 'preview', label: 'Import Preview', count: previewCount }]
      : []),
  ]

  const tableColumns = [
    {
      key: 'name',
      header: 'Product Details',
      render: (item) => {
        const primaryImage = item.images?.[0]
        return (
          <div className="flex items-center gap-3.5 py-1">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-xs">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center font-bold text-xs text-brand-600 bg-brand-50">${item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}</div>`
                    }
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-xs text-brand-600 bg-brand-50">
                  {item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Link
                to={adminPath.productDetail(item.id)}
                className="block font-semibold text-slate-900 text-sm truncate hover:text-brand-600 transition-colors"
              >
                {item.name}
              </Link>
              <div className="flex items-center gap-2 text-2xs text-slate-400">
                {item.importPreview && <PreviewBadge />}
                {item.sku && <span>SKU: {item.sku}</span>}
                {item.brand?.name && <span>• {item.brand.name}</span>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'category',
      header: 'Category',
      width: '11rem',
      render: (item) => (
        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {item.category?.name || 'Uncategorized'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      width: '10rem',
      align: 'right',
      render: (item) => (
        <div className="flex flex-col items-end leading-tight">
          <span className="tabular font-bold text-slate-900 text-sm">
            {formatRupees(item.salePrice ?? item.price)}
          </span>
          {item.salePrice != null && item.salePrice < item.price && (
            <span className="tabular text-2xs text-slate-400 line-through">
              {formatRupees(item.price)}
            </span>
          )}
          {Boolean(item.discountPercent) && (
            <span className="text-2xs font-bold text-emerald-600">
              {item.discountPercent}% OFF
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock Inventory',
      width: '9rem',
      align: 'right',
      render: (item) =>
        item.stock <= 0 ? (
          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-2xs font-bold text-rose-700">
            Out of Stock
          </span>
        ) : (
          <div className="flex flex-col items-end">
            <span
              className={`tabular font-bold text-sm ${
                item.stock < 10 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {item.stock.toLocaleString('en-IN')} units
            </span>
            {item.stock < 10 && (
              <span className="text-[10px] font-semibold text-amber-600">Low inventory</span>
            )}
          </div>
        ),
    },
    {
      key: 'isActive',
      header: 'Storefront Visibility',
      width: '12rem',
      render: (item) =>
        item.importPreview ? (
          <PermissionGate permission={MANAGE} fallback={<PreviewBadge />}>
            <ApproveButton
              disabled={approvePreviews.isPending}
              onClick={() => approveImported({ productIds: [item.id] })}
            />
          </PermissionGate>
        ) : (
        <div className="flex items-center gap-2.5">
          <Switch
            id={`product-table-active-${item.id}`}
            checked={item.isActive}
            disabled={writer.setStatus.isSubmitting}
            onChange={() => writer.setStatus.run({ id: item.id, isActive: !item.isActive })}
          />
          <Badge tone={item.isActive ? 'success' : 'neutral'} dot size="sm">
            {item.isActive ? 'Active' : 'Hidden'}
          </Badge>
        </div>
        ),
    },
    {
      key: 'isFlashsale',
      header: 'Flash Sale',
      width: '10rem',
      render: (item) => (
        <PermissionGate
          permission={MANAGE}
          fallback={
            item.isFlashsale ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-2xs font-bold text-amber-600 ring-1 ring-amber-500/20">
                🔥 Flash Deal
              </span>
            ) : (
              <span className="text-2xs text-slate-400">Regular</span>
            )
          }
        >
          <div className="flex items-center gap-2">
            <Switch
              id={`product-table-flash-${item.id}`}
              checked={Boolean(item.isFlashsale)}
              disabled={writer.setFlashSaleStatus.isSubmitting}
              onChange={() =>
                writer.setFlashSaleStatus.run({ id: item.id, isFlashsale: !item.isFlashsale })
              }
            />
            {item.isFlashsale ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-2xs font-bold text-amber-700 ring-1 ring-amber-300">
                🔥 Live
              </span>
            ) : (
              <span className="text-2xs font-medium text-slate-400">Off</span>
            )}
          </div>
        </PermissionGate>
      ),
    },
    {
      key: 'isTrending',
      header: 'Trending',
      width: '10rem',
      render: (item) => (
        <PermissionGate
          permission={MANAGE}
          fallback={
            item.isTrending ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-2xs font-bold text-indigo-600 ring-1 ring-indigo-500/20">
                📈 Trending
              </span>
            ) : (
              <span className="text-2xs text-slate-400">Regular</span>
            )
          }
        >
          <div className="flex items-center gap-2">
            <Switch
              id={`product-table-trending-${item.id}`}
              checked={Boolean(item.isTrending)}
              disabled={writer.setTrendingStatus.isSubmitting}
              onChange={() =>
                writer.setTrendingStatus.run({ id: item.id, isTrending: !item.isTrending })
              }
            />
            {item.isTrending ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-2xs font-bold text-indigo-700 ring-1 ring-indigo-300">
                📈 Live
              </span>
            ) : (
              <span className="text-2xs font-medium text-slate-400">Off</span>
            )}
          </div>
        </PermissionGate>
      ),
    },
    {
      key: '__actions',
      header: 'Actions',
      width: '9.5rem',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            to={adminPath.productDetail(item.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="View details"
          >
            <Icon name="eye" className="h-4 w-4" />
          </Link>
          <PermissionGate permission={MANAGE}>
            <button
              type="button"
              onClick={() => setEditingProduct(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Edit product"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRemovingProduct(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
              title="Delete product"
            >
              <Icon name="delete" className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageBody>
        <PageHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>Products</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/70">
                {totalCount}
              </span>
            </div>
          }
          description="Manage inventory listings, pricing, brand associations, and storefront visibility."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => products.refetch()}
                disabled={products.isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh product list"
              >
                <Icon
                  name="refresh"
                  className={`h-3.5 w-3.5 ${products.isFetching ? 'animate-spin text-brand-600' : ''}`}
                />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Scan a product's barcode"
              >
                <Icon name="search" className="h-3.5 w-3.5" />
                <span>Scan barcode</span>
              </button>
              <PermissionGate permission={MANAGE}>
                {!isSellerOnlyOn && (
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    title="Import products from a CSV file — they stay hidden until you approve them"
                  >
                    <Icon name="upload" className="h-3.5 w-3.5" />
                    <span>Import CSV</span>
                  </button>
                )}
              </PermissionGate>
              <PermissionGate permission={MANAGE}>
                <button
                  type="button"
                  onClick={() => setEditingProduct('new')}
                  disabled={isSellerOnlyOn}
                  title={isSellerOnlyOn ? 'Own stock is off — turn it on from the sidebar to add products' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>New Product</span>
                </button>
              </PermissionGate>
            </div>
          }
        />

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Products */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Products</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-transform group-hover:scale-105">
                <Icon name="products" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
              <span className="text-xs font-medium text-slate-500">items</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>Full inventory listings</span>
            </div>
          </div>

          {/* Active in Store */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Active Live</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10 transition-transform group-hover:scale-105">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{activeCount}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {activeRatio}% live
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${activeRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Flash Sale Deals */}
          <div className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-amber-300">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-700">Flash Deals</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 transition-transform group-hover:scale-105 text-sm">
                🔥
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{flashSaleCount}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {flashSaleCount > 0 ? 'Active' : '0 Live'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${flashSaleCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <span>Urgent promotion items</span>
            </div>
          </div>

          {/* Trending Picks */}
          <div className="group relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-indigo-300">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-indigo-700">Trending Picks</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20 transition-transform group-hover:scale-105 text-sm">
                📈
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{trendingCount}</span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                {trendingCount > 0 ? 'Hot Picks' : '0 Set'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${trendingCount > 0 ? 'bg-indigo-500' : 'bg-slate-300'}`} />
              <span>High reseller demand</span>
            </div>
          </div>

          {/* Out of Stock */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Out of Stock</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/10 transition-transform group-hover:scale-105">
                <Icon name="inventory" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{outOfStockCount}</span>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                {outOfStockCount > 0 ? 'Restock' : 'All Stocked'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${outOfStockCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span>{outOfStockCount > 0 ? 'Zero inventory' : 'Inventory healthy'}</span>
            </div>
          </div>
        </div>

        {previewCount > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Icon name="pending" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {previewCount} imported product{previewCount === 1 ? '' : 's'} waiting for approval
                </p>
                <p className="text-xs text-amber-800">
                  They are Drafts and hidden from buyers. View, edit or delete any that are wrong, then approve to make
                  them live.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {statusFilter !== 'preview' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('preview')}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Review previews
                </button>
              )}
              <PermissionGate permission={MANAGE}>
                <button
                  type="button"
                  onClick={() => setApproveAllOpen(true)}
                  disabled={approvePreviews.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Approve all {previewCount}
                </button>
              </PermissionGate>
            </div>
          </div>
        )}

        {/* Smart Toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((tab) => {
              const isSelected = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-2xs font-bold tabular ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Controls: Search, Sort & View Mode */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Product name, SKU, brand…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name (A–Z)</option>
                <option value="stock-low">Stock: Low to High</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                <Icon name="chevronDown" className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid view"
              >
                <Icon name="categories" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table view"
              >
                <Icon name="list" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Display */}
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
              <Icon name="products" className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery || statusFilter !== 'all' ? 'No matching products' : 'No products yet'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or switching your status filter.'
                : 'Add your first product to establish your catalog inventory and begin selling.'}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Icon name="close" className="h-3 w-3" />
                <span>Clear Filters</span>
              </button>
            ) : (
              <PermissionGate permission={MANAGE}>
                <button
                  type="button"
                  onClick={() => setEditingProduct('new')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>Create Product</span>
                </button>
              </PermissionGate>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Visual Product Card Grid View */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pagedProducts.map((item) => {
              const primaryImage = item.images?.[0]
              const hasDiscount = item.salePrice != null && item.salePrice < item.price
              const discountPct =
                item.discountPercent ||
                (hasDiscount ? Math.round(((item.price - item.salePrice) / item.price) * 100) : 0)

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Cover Image Showcase */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-100 p-2.5 flex items-center justify-center">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={item.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          if (e.currentTarget.parentElement) {
                            e.currentTarget.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center font-bold text-xl text-brand-600 bg-brand-50">${item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}</div>`
                          }
                        }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-xl ring-1 ring-brand-500/20">
                        {item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}
                      </div>
                    )}

                    {/* Top Floating Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[70%] z-10 pointer-events-none">
                      {item.isFlashsale && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                          <span>🔥</span>
                          <span>Flash</span>
                        </span>
                      )}
                      {item.isTrending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                          <span>📈</span>
                          <span>Trending</span>
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-600/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                          {discountPct}% OFF
                        </span>
                      )}
                      {item.stock <= 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-600/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                          Out of Stock
                        </span>
                      )}
                    </div>

                    {/* Top Right Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      {item.importPreview ? (
                        <PreviewBadge floating />
                      ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md shadow-xs border ${
                          item.isActive
                            ? 'bg-white/95 border-emerald-200 text-emerald-700'
                            : 'bg-white/95 border-slate-200 text-slate-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        {item.isActive ? 'Active' : 'Hidden'}
                      </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-2xs truncate">
                      <span className="font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-[10px] tracking-wide uppercase truncate max-w-[120px]">
                        {item.category?.name || 'Catalog'}
                      </span>
                      {item.brand?.name && (
                        <span className="text-slate-500 font-medium text-[11px] truncate">
                          · {item.brand.name}
                        </span>
                      )}
                    </div>

                    <h3
                      className="font-bold text-slate-900 text-sm mt-1.5 line-clamp-2 min-h-[2.5rem] leading-snug group-hover:text-brand-600 transition-colors"
                      title={item.name}
                    >
                      <Link to={adminPath.productDetail(item.id)}>{item.name}</Link>
                    </h3>

                    {/* Pricing */}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight tabular">
                        {formatRupees(item.salePrice ?? item.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-slate-400 line-through tabular font-normal">
                          {formatRupees(item.price)}
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="ml-auto text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-md">
                          Save {formatRupees(item.price - item.salePrice)}
                        </span>
                      )}
                    </div>

                    {/* Stock status indicator */}
                    <div className="mt-2.5 flex items-center justify-between text-2xs pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            item.stock > 10
                              ? 'bg-emerald-500'
                              : item.stock > 0
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-slate-500 font-medium">Stock:</span>
                        <span
                          className={`font-bold tabular ${
                            item.stock > 10
                              ? 'text-slate-800'
                              : item.stock > 0
                                ? 'text-amber-600'
                                : 'text-rose-600'
                          }`}
                        >
                          {item.stock > 0 ? item.stock : 'Out of Stock'}
                        </span>
                      </div>
                      {item.sku && (
                        <span
                          className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded max-w-[100px] truncate"
                          title={item.sku}
                        >
                          SKU: {item.sku}
                        </span>
                      )}
                    </div>

                    {/* Quick Promo Tags: Flash Sale & Trending Toggles */}
                    <PermissionGate permission={MANAGE}>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={writer.setFlashSaleStatus.isSubmitting}
                          onClick={(e) => {
                            e.preventDefault()
                            writer.setFlashSaleStatus.run({ id: item.id, isFlashsale: !item.isFlashsale })
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                            item.isFlashsale
                              ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20 ring-1 ring-amber-400'
                              : 'bg-slate-100/90 text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200/60'
                          }`}
                          title={item.isFlashsale ? 'Turn off Flash Sale' : 'Turn on Flash Sale'}
                        >
                          <span>🔥</span>
                          <span>Flash {item.isFlashsale ? 'ON' : ''}</span>
                        </button>

                        <button
                          type="button"
                          disabled={writer.setTrendingStatus.isSubmitting}
                          onClick={(e) => {
                            e.preventDefault()
                            writer.setTrendingStatus.run({ id: item.id, isTrending: !item.isTrending })
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                            item.isTrending
                              ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20 ring-1 ring-indigo-500'
                              : 'bg-slate-100/90 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200/60'
                          }`}
                          title={item.isTrending ? 'Turn off Trending' : 'Turn on Trending'}
                        >
                          <span>📈</span>
                          <span>Trending {item.isTrending ? 'ON' : ''}</span>
                        </button>
                      </div>
                    </PermissionGate>
                  </div>

                  {/* Card Bottom Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {item.importPreview ? (
                      <PermissionGate permission={MANAGE} fallback={<PreviewBadge />}>
                        <ApproveButton
                          disabled={approvePreviews.isPending}
                          onClick={() => approveImported({ productIds: [item.id] })}
                        />
                      </PermissionGate>
                    ) : (
                    <div className="flex items-center gap-2" title="Storefront Visibility">
                      <Switch
                        id={`product-grid-active-${item.id}`}
                        checked={item.isActive}
                        disabled={writer.setStatus.isSubmitting}
                        onChange={() => writer.setStatus.run({ id: item.id, isActive: !item.isActive })}
                      />
                      <span
                        className={`text-xs font-bold tracking-tight ${
                          item.isActive ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {item.isActive ? 'Live' : 'Hidden'}
                      </span>
                    </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Link
                        to={adminPath.productDetail(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="View details"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" />
                      </Link>
                      <PermissionGate permission={MANAGE}>
                        <button
                          type="button"
                          onClick={() => setEditingProduct(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                          title="Edit product"
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingProduct(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 border border-slate-200/50 hover:border-danger-200 transition-all shadow-2xs"
                          title="Delete product"
                        >
                          <Icon name="delete" className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <Table
              className="rounded-none border-0"
              columns={tableColumns}
              data={pagedProducts}
              getRowKey={(item) => item.id}
              density="comfortable"
            />
          </div>
        )}

        {filteredProducts.length > 0 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            rowsPerPage={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="products"
          />
        )}
      </PageBody>

      {/* Product Form Drawer (opens from right side) */}
      {editingProduct && (
        <ProductFormDrawer
          key={editingProduct === 'new' ? 'new-product' : editingProduct.id}
          isOpen
          onClose={() => setEditingProduct(null)}
          product={editingProduct === 'new' ? null : editingProduct}
          categories={categoryItems}
          brands={brandItems}
          writer={writer}
        />
      )}

      {/* Scan a barcode to open that product's full details page. */}
      <ScanBarcodeModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        lookupPath={(code) => `/admin/catalog/products/barcode/${code}`}
        onFound={(product) => {
          setScanOpen(false)
          navigate(adminPath.productDetail(product.id))
        }}
      />

      <AdminImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onFinished={() => products.refetch()}
        onShowPreviews={() => {
          products.refetch()
          setStatusFilter('preview')
        }}
      />

      <ConfirmDialog
        isOpen={approveAllOpen}
        onClose={() => setApproveAllOpen(false)}
        title={`Approve all ${previewCount} imported products?`}
        description="They become Active and visible to buyers straight away."
        confirmLabel="Approve all"
        isSubmitting={approvePreviews.isPending}
        onConfirm={async () => {
          await approveImported({ all: true })
          setApproveAllOpen(false)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingProduct)}
        onClose={() => setRemovingProduct(null)}
        title={`Delete product: "${removingProduct?.name}"?`}
        description="This product will be permanently deleted from catalog and store listings."
        confirmLabel="Delete product"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removingProduct.id })
          setRemovingProduct(null)
        }}
      />
    </>
  )
}
