import { useState } from 'react'
import { Badge, Icon, Pagination, Table } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { useVendorProductsController } from '../controllers/useVendorController'
import { VENDOR_PRODUCT_COLUMNS, VENDOR_PRODUCT_TABS } from '../tableColumns/vendorColumns'
import { AddVendorProductModal } from '../components/modals/AddVendorProductModal'
import { EditVendorProductModal } from '../components/modals/EditVendorProductModal'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'
import { VendorProductDetailModal } from '../components/modals/VendorProductDetailModal'
import { ScanBarcodeModal } from '../../../components/common/ScanBarcodeModal'
import { downloadTableCsv } from '../../admin/lib/exportCsv'

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const STATUS_TONE = { PENDING: 'warning', REJECTED: 'danger' }

// Mirrors the admin Products screen's visual language (KPI cards, status
// tabs, search, grid/table toggle, product cards) but the data underneath
// stays vendor-scoped: server-paged /vendor/products, and every product a
// seller creates carries an approval workflow admin products never see —
// "Pending review" / "Rejected" badges and the rejection reason, both kept
// here rather than folded away to look more like admin.
export function VendorProductsPage() {
  const list = useVendorProductsController()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [viewingProduct, setViewingProduct] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')

  const items = list.items || []
  const tabCounts = list.tabCounts || {}
  const searchValue = list.filters?.search || ''

  const setSearch = (value) => list.changeFilters({ ...list.filters, search: value })

  const FILTER_TABS = VENDOR_PRODUCT_TABS.map((tab) => ({ ...tab, count: tabCounts[tab.id] ?? 0 }))

  // Built inline (not in tableColumns/vendorColumns.jsx) so the render fn can
  // close over setEditingProduct/setSelectedProduct — the shared columns file
  // has no component state to reach.
  const tableColumnsWithActions = [
    ...VENDOR_PRODUCT_COLUMNS,
    {
      key: '__actions',
      header: 'Actions',
      width: '9rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewingProduct(row)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="View details & barcode"
          >
            <Icon name="eye" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditingProduct(row)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="Edit product details"
          >
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedProduct(row)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="Update stock"
          >
            <Icon name="inventory" className="h-4 w-4" />
          </button>
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
                {tabCounts.all ?? list.totalItems ?? 0}
              </span>
            </div>
          }
          description="Manage your product listings, pricing and stock. New products go live once an admin approves them."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => list.refetch()}
                disabled={list.isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh product list"
              >
                <Icon name="refresh" className={`h-3.5 w-3.5 ${list.isFetching ? 'animate-spin text-brand-600' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTableCsv('products.csv', VENDOR_PRODUCT_COLUMNS, items)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Export visible rows to CSV"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span>Export</span>
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
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20"
              >
                <Icon name="add" className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          }
        />

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Products</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-transform group-hover:scale-105">
                <Icon name="products" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.all ?? 0}</span>
              <span className="text-xs font-medium text-slate-500">items</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>Your catalog listings</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Active Live</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10 transition-transform group-hover:scale-105">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.active ?? 0}</span>
              <span className="text-xs font-medium text-slate-500">on storefront</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Approved and visible</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-amber-300">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-700">Pending Approval</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 transition-transform group-hover:scale-105">
                <Icon name="pending" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.pending ?? 0}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Awaiting admin</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${tabCounts.pending > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <span>Not visible to buyers yet</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Rejected</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/10 transition-transform group-hover:scale-105">
                <Icon name="warning" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.rejected ?? 0}</span>
              <span className="text-xs font-medium text-slate-500">need changes</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${tabCounts.rejected > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span>{tabCounts.rejected > 0 ? 'Check rejection reasons' : 'Nothing rejected'}</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Out of Stock</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/10 transition-transform group-hover:scale-105">
                <Icon name="inventory" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.out_of_stock ?? 0}</span>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                {tabCounts.out_of_stock > 0 ? 'Restock' : 'All Stocked'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${tabCounts.out_of_stock > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span>{tabCounts.out_of_stock > 0 ? 'Zero inventory' : 'Inventory healthy'}</span>
            </div>
          </div>
        </div>

        {/* Smart Toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((tab) => {
              const isSelected = list.tab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => list.changeTab(tab.id)}
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

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="relative w-full sm:w-64">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU, product title or category…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

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
        {list.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
            <p className="text-xs text-slate-500">Loading…</p>
          </div>
        ) : list.error ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-white py-16 px-4 text-center shadow-xs">
            <p className="text-sm font-semibold text-rose-700">Could not load products</p>
            <button
              type="button"
              onClick={() => list.refetch()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
              <Icon name="products" className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {searchValue || list.tab !== 'all' ? 'No matching products' : 'No products yet'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {searchValue || list.tab !== 'all'
                ? 'Try adjusting your search query or switching your status tab.'
                : 'Add your first product to start selling once admin approves it.'}
            </p>
            {searchValue || list.tab !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  list.changeTab('all')
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Icon name="close" className="h-3 w-3" />
                <span>Clear Filters</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
              >
                <Icon name="add" className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const primaryImage = item.images?.[0]
              const isPendingOrRejected = item.approvalStatus === 'PENDING' || item.approvalStatus === 'REJECTED'
              const hasDiscount = item.salePrice != null && item.salePrice < item.price
              const discountPct =
                item.discountPercent ||
                (hasDiscount ? Math.round(((item.price - item.salePrice) / item.price) * 100) : 0)

              return (
                <div
                  key={item.id}
                  onClick={() => setEditingProduct(item)}
                  className="group relative flex flex-col cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 hover:-translate-y-1"
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
                      {isPendingOrRejected ? (
                        <Badge
                          tone={STATUS_TONE[item.approvalStatus] || 'neutral'}
                          dot
                          size="sm"
                          className="backdrop-blur-md bg-white/95 shadow-xs border border-white/80 font-bold"
                        >
                          {item.approvalStatus === 'PENDING' ? 'Pending' : 'Rejected'}
                        </Badge>
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
                      {item.name}
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

                    {item.approvalStatus === 'REJECTED' && item.rejectionReason && (
                      <p className="mt-2 text-2xs text-rose-600 bg-rose-50/80 border border-rose-200/60 p-1.5 rounded-lg">
                        {item.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2" title="Storefront visibility">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          item.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold tracking-tight ${
                          item.isActive ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {item.isActive ? 'Live' : 'Hidden'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingProduct(item)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="View details & barcode"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingProduct(item)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="Edit product details"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProduct(item)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="Update stock"
                      >
                        <Icon name="inventory" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <Table
              className="rounded-none border-0"
              columns={tableColumnsWithActions}
              data={items}
              getRowKey={(item) => item.id}
              density="comfortable"
              onRowClick={(row) => setEditingProduct(row)}
            />
          </div>
        )}

        {items.length > 0 && (
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalItems={list.totalItems}
            rowsPerPage={list.rowsPerPage}
            onPageChange={list.setPage}
            itemLabel="products"
          />
        )}
      </PageBody>

      <AddVendorProductModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAddProduct={list.addProduct}
      />


      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={list.updateStock}
      />

      <VendorProductDetailModal
        product={viewingProduct}
        isOpen={Boolean(viewingProduct)}
        onClose={() => setViewingProduct(null)}
        onEdit={(product) => {
          setViewingProduct(null)
          setEditingProduct(product)
        }}
        onUpdateStock={(product) => {
          setViewingProduct(null)
          setSelectedProduct(product)
        }}
      />

      <EditVendorProductModal
        key={editingProduct?.id}
        product={editingProduct}
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        onEditProduct={list.editProduct}
      />

      {/* Scoped to this seller's own catalog server-side — see
          Controllers/vendorProductController.js — so a scan can never
          resolve to, or leak the existence of, another seller's product. */}
      <ScanBarcodeModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        lookupPath={(code) => `/vendor/products/barcode/${code}`}
        onFound={(product) => {
          setScanOpen(false)
          setViewingProduct(product)
        }}
      />
    </>
  )
}
