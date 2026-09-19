import { useMemo, useState } from 'react'
import { Badge, Icon, Input, Pagination, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
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
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0

  const filteredProducts = useMemo(() => {
    const list = productItems.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false
      if (statusFilter === 'out_of_stock' && item.stock > 0) return false
      if (statusFilter === 'flash_sale' && !item.isFlashsale) return false
      if (statusFilter === 'trending' && !item.isTrending) return false

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
              <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
              <div className="flex items-center gap-2 text-2xs text-slate-400">
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
      render: (item) => (
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
      width: '7.5rem',
      align: 'right',
      render: (item) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1">
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
          </div>
        </PermissionGate>
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
                <button
                  type="button"
                  onClick={() => setEditingProduct('new')}
                  disabled={isSellerOnlyOn}
                  title={isSellerOnlyOn ? 'Seller-only catalog mode is on — sellers add products, admin only approves them' : undefined}
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
              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-brand-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Cover Image Showcase */}
                  <div className="relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 border border-slate-100 flex items-center justify-center">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                      {item.isFlashsale && (
                        <span className="rounded-lg bg-amber-500/95 px-2 py-0.5 text-2xs font-extrabold text-white shadow-xs backdrop-blur-md">
                          🔥 Flash Sale
                        </span>
                      )}
                      {item.isTrending && (
                        <span className="rounded-lg bg-indigo-600/95 px-2 py-0.5 text-2xs font-extrabold text-white shadow-xs backdrop-blur-md">
                          📈 Trending
                        </span>
                      )}
                      {Boolean(item.discountPercent) && (
                        <span className="rounded-lg bg-emerald-600/90 px-2 py-0.5 text-2xs font-extrabold text-white shadow-xs backdrop-blur-md">
                          {item.discountPercent}% OFF
                        </span>
                      )}
                      {item.stock <= 0 && (
                        <span className="rounded-lg bg-rose-600/90 px-2 py-0.5 text-2xs font-extrabold text-white shadow-xs backdrop-blur-md">
                          Out of Stock
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <Badge
                        tone={item.isActive ? 'success' : 'neutral'}
                        dot
                        size="sm"
                        className="backdrop-blur-md bg-white/95 shadow-xs border border-white/80 font-semibold"
                      >
                        {item.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-2xs text-slate-400 truncate">
                      <span className="font-semibold text-slate-600">{item.category?.name || 'Catalog'}</span>
                      {item.brand?.name && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{item.brand.name}</span>
                        </>
                      )}
                    </div>

                    <h3
                      className="font-bold text-slate-900 text-sm mt-1 truncate group-hover:text-brand-600 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h3>

                    {/* Pricing */}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-slate-900 tabular">
                        {formatRupees(item.salePrice ?? item.price)}
                      </span>
                      {item.salePrice != null && item.salePrice < item.price && (
                        <span className="text-2xs text-slate-400 line-through tabular">
                          {formatRupees(item.price)}
                        </span>
                      )}
                    </div>

                    {/* Stock status indicator */}
                    <div className="mt-2 flex items-center justify-between text-2xs">
                      <span className="text-slate-500 font-medium">
                        Stock: <span className="font-bold text-slate-800">{item.stock}</span>
                      </span>
                      {item.sku && <span className="text-slate-400 truncate">SKU: {item.sku}</span>}
                    </div>
                  </div>

                  {/* Card Bottom Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5" title="Storefront Visibility">
                        <Switch
                          id={`product-grid-active-${item.id}`}
                          checked={item.isActive}
                          disabled={writer.setStatus.isSubmitting}
                          onChange={() => writer.setStatus.run({ id: item.id, isActive: !item.isActive })}
                        />
                        <span className="text-2xs font-semibold text-slate-600">
                          {item.isActive ? 'Live' : 'Hidden'}
                        </span>
                      </div>

                      <PermissionGate permission={MANAGE}>
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200" title="Flash Sale Status">
                          <Switch
                            id={`product-grid-flash-${item.id}`}
                            checked={Boolean(item.isFlashsale)}
                            disabled={writer.setFlashSaleStatus.isSubmitting}
                            onChange={() =>
                              writer.setFlashSaleStatus.run({ id: item.id, isFlashsale: !item.isFlashsale })
                            }
                          />
                          <span
                            className={`text-2xs font-bold ${
                              item.isFlashsale ? 'text-amber-600' : 'text-slate-400'
                            }`}
                          >
                            🔥
                          </span>
                        </div>
                      </PermissionGate>

                      <PermissionGate permission={MANAGE}>
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200" title="Trending Status">
                          <Switch
                            id={`product-grid-trending-${item.id}`}
                            checked={Boolean(item.isTrending)}
                            disabled={writer.setTrendingStatus.isSubmitting}
                            onChange={() =>
                              writer.setTrendingStatus.run({ id: item.id, isTrending: !item.isTrending })
                            }
                          />
                          <span
                            className={`text-2xs font-bold ${
                              item.isTrending ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          >
                            📈
                          </span>
                        </div>
                      </PermissionGate>
                    </div>

                    <PermissionGate permission={MANAGE}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Edit product"
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingProduct(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                          title="Delete product"
                        >
                          <Icon name="delete" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </PermissionGate>
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

      {/* Scan a barcode to jump straight to that product's edit drawer —
          the lookup response is already shaped exactly like a row from the
          product list, so it opens the same drawer with no translation. */}
      <ScanBarcodeModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        lookupPath={(code) => `/admin/catalog/products/barcode/${code}`}
        onFound={(product) => {
          setScanOpen(false)
          setEditingProduct(product)
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
