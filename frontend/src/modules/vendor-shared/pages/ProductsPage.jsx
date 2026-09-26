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
import { ConfirmDialog } from '../../admin/components/overlay/ConfirmDialog'
import { toast } from '../../admin/stores/toastStore'
import { AdminImportModal } from '../../catalog-import/components/AdminImportModal'
import { IMPORT_BASE, useApprovePreviewProducts } from '../../catalog-import/controllers/useProductImportController'

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const STATUS_TONE = { PENDING: 'warning', REJECTED: 'danger' }

// What approving a seller's CSV preview does: submits it, exactly like adding
// the product by hand.
const APPROVE_NOTE =
  'Check each one (view, edit or delete), then press Approve to submit it — it goes live once the platform approves it, or straight away if auto-approval is on.'

function PreviewBadge({ floating = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-warning-300 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-800 ${
        floating ? 'shadow-xs backdrop-blur-md' : ''
      }`}
      title="Imported from CSV — Draft, not submitted yet. Approve it to send it for review."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
      Preview · Draft
    </span>
  )
}

function ApproveButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-2.5 py-1.5 text-2xs font-bold text-white shadow-xs hover:bg-success-700 disabled:opacity-50"
      title="Approve — submit this imported product"
    >
      <Icon name="check" className="h-3 w-3" />
      Approve
    </button>
  )
}

function DeletePreviewButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-danger-600 hover:bg-danger-50 border border-slate-200/50 hover:border-danger-200 transition-all shadow-2xs"
      title="Delete this imported preview"
    >
      <Icon name="delete" className="h-3.5 w-3.5" />
    </button>
  )
}

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
  const [importOpen, setImportOpen] = useState(false)
  const [approveAllOpen, setApproveAllOpen] = useState(false)
  const [deletingPreview, setDeletingPreview] = useState(null)

  const items = list.items || []
  const tabCounts = list.tabCounts || {}
  const searchValue = list.filters?.search || ''
  const previewCount = tabCounts.preview ?? 0

  const setSearch = (value) => list.changeFilters({ ...list.filters, search: value })

  // CSV-imported products arrive as hidden Draft "previews"; approving one
  // submits it (live at once only with auto-approval).
  const approvePreviews = useApprovePreviewProducts(IMPORT_BASE.VENDOR, {
    productQueryKeys: [['vendor', 'products'], ['vendor', 'inventory']],
  })

  async function approveImported(payload) {
    try {
      const res = await approvePreviews.mutateAsync(payload)
      toast.success(res.data?.live ? 'Approved' : 'Submitted for review', res.message)
    } catch (err) {
      toast.error('Could not approve', err.message)
    }
  }

  async function deletePreview(product) {
    try {
      await list.removeProduct(product.id)
      toast.success('Preview deleted', product.name)
    } catch (err) {
      toast.error('Could not delete', err.message)
    }
  }

  // The preview tab only appears while there is something in it (or it is
  // the tab being looked at), like the admin panel's.
  const FILTER_TABS = [
    ...VENDOR_PRODUCT_TABS,
    ...(previewCount > 0 || list.tab === 'preview' ? [{ id: 'preview', label: 'Import Preview' }] : []),
  ].map((tab) => ({ ...tab, count: tabCounts[tab.id] ?? 0 }))

  // Built inline (not in tableColumns/vendorColumns.jsx) so the render fn can
  // close over setEditingProduct/setSelectedProduct — the shared columns file
  // has no component state to reach.
  const tableColumnsWithActions = [
    ...VENDOR_PRODUCT_COLUMNS,
    {
      key: '__actions',
      header: 'Actions',
      width: '15rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.importPreview && (
            <>
              <ApproveButton
                disabled={approvePreviews.isPending}
                onClick={() => approveImported({ productIds: [row.id] })}
              />
              <DeletePreviewButton onClick={() => setDeletingPreview(row)} />
            </>
          )}
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
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => list.refetch()}
                disabled={list.isFetching}
                className="inline-flex h-8 sm:h-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh product list"
              >
                <Icon name="refresh" className={`h-3.5 w-3.5 ${list.isFetching ? 'animate-spin text-brand-600' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTableCsv('products.csv', VENDOR_PRODUCT_COLUMNS, items)}
                className="inline-flex h-8 sm:h-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Export visible rows to CSV"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex h-8 sm:h-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Scan a product's barcode"
              >
                <Icon name="search" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Scan barcode</span>
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-8 sm:h-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="Import products from a CSV file"
              >
                <Icon name="upload" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex h-8 sm:h-auto items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20"
              >
                <Icon name="add" className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          }
        />

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 lg:grid-cols-5">
          <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-slate-400">Total</span>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-transform group-hover:scale-105">
                <Icon name="products" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.all ?? 0}</span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">items</span>
            </div>
            <div className="mt-1 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-2xs text-slate-500 truncate">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
              <span className="truncate">Catalog listings</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:border-success-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-slate-400">Active</span>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/10 transition-transform group-hover:scale-105">
                <Icon name="check" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.active ?? 0}</span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">live</span>
            </div>
            <div className="mt-1 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-2xs text-slate-500 truncate">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
              <span className="truncate">Storefront visible</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-warning-200/80 bg-white p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:border-warning-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-warning-700">Pending</span>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-500/20 transition-transform group-hover:scale-105">
                <Icon name="pending" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.pending ?? 0}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-warning-700 bg-warning-50 px-1.5 py-0.5 rounded-full">Review</span>
            </div>
            <div className="mt-1 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-2xs text-slate-500 truncate">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tabCounts.pending > 0 ? 'bg-warning-500' : 'bg-slate-300'}`} />
              <span className="truncate">Awaiting admin</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:border-danger-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-slate-400">Rejected</span>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-danger-50 text-danger-600 ring-1 ring-danger-500/10 transition-transform group-hover:scale-105">
                <Icon name="warning" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.rejected ?? 0}</span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">issues</span>
            </div>
            <div className="mt-1 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-2xs text-slate-500 truncate">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tabCounts.rejected > 0 ? 'bg-danger-500' : 'bg-success-500'}`} />
              <span className="truncate">{tabCounts.rejected > 0 ? 'Needs changes' : 'None'}</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-md hover:border-danger-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-slate-400">Stock Alert</span>
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-danger-50 text-danger-600 ring-1 ring-danger-500/10 transition-transform group-hover:scale-105">
                <Icon name="inventory" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular">{tabCounts.out_of_stock ?? 0}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-danger-700 bg-danger-50 px-1.5 py-0.5 rounded-full">
                {tabCounts.out_of_stock > 0 ? 'Restock' : 'Healthy'}
              </span>
            </div>
            <div className="mt-1 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-2xs text-slate-500 truncate">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tabCounts.out_of_stock > 0 ? 'bg-danger-500' : 'bg-success-500'}`} />
              <span className="truncate">{tabCounts.out_of_stock > 0 ? 'Zero inventory' : 'All in stock'}</span>
            </div>
          </div>
        </div>

        {previewCount > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Icon name="pending" className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
              <div>
                <p className="text-sm font-semibold text-warning-900">
                  {previewCount} imported product{previewCount === 1 ? '' : 's'} waiting for your approval
                </p>
                <p className="text-xs text-warning-800">
                  They are Drafts and hidden from buyers. View, edit or delete any that are wrong, then approve to
                  submit them for platform review.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {list.tab !== 'preview' && (
                <button
                  type="button"
                  onClick={() => list.changeTab('preview')}
                  className="rounded-xl border border-warning-300 bg-white px-3 py-2 text-xs font-semibold text-warning-800 hover:bg-warning-100"
                >
                  Review previews
                </button>
              )}
              <button
                type="button"
                onClick={() => setApproveAllOpen(true)}
                disabled={approvePreviews.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-success-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-success-700 disabled:opacity-50"
              >
                <Icon name="check" className="h-3.5 w-3.5" />
                Approve all {previewCount}
              </button>
            </div>
          </div>
        )}

        {/* Smart Toolbar */}
        <div className="flex flex-col gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            {FILTER_TABS.map((tab) => {
              const isSelected = list.tab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => list.changeTab(tab.id)}
                  className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-2xs font-bold tabular ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU, title or category…"
                className="h-8.5 sm:h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-100/70 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid view"
              >
                <Icon name="categories" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table view"
              >
                <Icon name="list" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-danger-200 bg-white py-16 px-4 text-center shadow-xs">
            <p className="text-sm font-semibold text-danger-700">Could not load products</p>
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
          <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  className="group relative flex flex-col cursor-pointer rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-4 shadow-xs hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 hover:-translate-y-0.5"
                >
                  {/* Cover Image Showcase */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-100 p-1.5 sm:p-2.5 flex items-center justify-center">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={item.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          if (e.currentTarget.parentElement) {
                            e.currentTarget.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center font-bold text-sm sm:text-xl text-brand-600 bg-brand-50">${item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}</div>`
                          }
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-500/10 text-brand-600 font-bold text-sm sm:text-xl ring-1 ring-brand-500/20">
                        {item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'}
                      </div>
                    )}

                    {/* Top Floating Badges */}
                    <div className="absolute top-1.5 left-1.5 flex flex-wrap items-center gap-1 max-w-[70%] z-10 pointer-events-none">
                      {item.isFlashsale && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-500/95 backdrop-blur-md px-1.5 py-0.5 text-[8px] sm:text-[10px] font-extrabold text-white shadow-xs">
                          <span>🔥</span>
                          <span className="hidden sm:inline">Flash</span>
                        </span>
                      )}
                      {item.isTrending && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-600/95 backdrop-blur-md px-1.5 py-0.5 text-[8px] sm:text-[10px] font-extrabold text-white shadow-xs">
                          <span>📈</span>
                          <span className="hidden sm:inline">Trend</span>
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="inline-flex items-center rounded-full bg-success-600/95 backdrop-blur-md px-1.5 py-0.5 text-[8px] sm:text-[10px] font-extrabold text-white shadow-xs">
                          {discountPct}%
                        </span>
                      )}
                      {item.stock <= 0 && (
                        <span className="inline-flex items-center rounded-full bg-danger-600/95 backdrop-blur-md px-1.5 py-0.5 text-[8px] sm:text-[10px] font-extrabold text-white shadow-xs">
                          Out
                        </span>
                      )}
                    </div>

                    {/* Top Right Status Badge */}
                    <div className="absolute top-1.5 right-1.5 z-10">
                      {item.importPreview ? (
                        <PreviewBadge floating />
                      ) : isPendingOrRejected ? (
                        <Badge
                          tone={STATUS_TONE[item.approvalStatus] || 'neutral'}
                          dot
                          size="sm"
                          className="backdrop-blur-md bg-white/95 shadow-xs border border-white/80 font-bold text-[9px] sm:text-2xs"
                        >
                          {item.approvalStatus === 'PENDING' ? 'Pending' : 'Rejected'}
                        </Badge>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold backdrop-blur-md shadow-xs border ${
                            item.isActive
                              ? 'bg-white/95 border-success-200 text-success-700'
                              : 'bg-white/95 border-slate-200 text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.isActive ? 'bg-success-500 animate-pulse' : 'bg-slate-400'
                            }`}
                          />
                          {item.isActive ? 'Active' : 'Hidden'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-2 sm:mt-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[9px] sm:text-2xs truncate">
                      <span className="font-bold text-brand-700 bg-brand-50 px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] tracking-wide uppercase truncate max-w-[80px] sm:max-w-[120px]">
                        {item.category?.name || 'Catalog'}
                      </span>
                      {item.brand?.name && (
                        <span className="text-slate-500 font-medium text-[9px] sm:text-[11px] truncate">
                          · {item.brand.name}
                        </span>
                      )}
                    </div>

                    <h3
                      className="font-bold text-slate-900 text-xs sm:text-sm mt-1 sm:mt-1.5 line-clamp-2 min-h-[1.8rem] sm:min-h-[2.5rem] leading-snug group-hover:text-brand-600 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h3>

                    {/* Pricing */}
                    <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1 sm:gap-2">
                      <span className="text-sm sm:text-lg font-black text-slate-900 tracking-tight tabular">
                        {formatRupees(item.salePrice ?? item.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through tabular font-normal">
                          {formatRupees(item.price)}
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="hidden sm:inline-block ml-auto text-[10px] font-extrabold text-success-700 bg-success-50 border border-success-200/70 px-1.5 py-0.5 rounded-md">
                          Save {formatRupees(item.price - item.salePrice)}
                        </span>
                      )}
                    </div>

                    {/* Stock status indicator */}
                    <div className="mt-1.5 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-2xs pt-1.5 sm:pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            item.stock > 10
                              ? 'bg-success-500'
                              : item.stock > 0
                                ? 'bg-warning-500'
                                : 'bg-danger-500'
                          }`}
                        />
                        <span className="text-slate-500 font-medium hidden sm:inline">Stock:</span>
                        <span
                          className={`font-bold tabular ${
                            item.stock > 10
                              ? 'text-slate-800'
                              : item.stock > 0
                                ? 'text-warning-600'
                                : 'text-danger-600'
                          }`}
                        >
                          {item.stock > 0 ? item.stock : 'Out'}
                        </span>
                      </div>
                      {item.sku && (
                        <span
                          className="font-mono text-[9px] sm:text-[10px] text-slate-400 bg-slate-50 border border-slate-200/60 px-1 sm:px-1.5 py-0.5 rounded max-w-[70px] sm:max-w-[100px] truncate"
                          title={item.sku}
                        >
                          {item.sku}
                        </span>
                      )}
                    </div>

                    {item.approvalStatus === 'REJECTED' && item.rejectionReason && (
                      <p className="mt-1.5 text-[10px] sm:text-2xs text-danger-600 bg-danger-50/80 border border-danger-200/60 p-1 sm:p-1.5 rounded-lg line-clamp-2">
                        {item.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Footer */}
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5" title="Storefront visibility">
                      <span
                        className={`inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${
                          item.isActive ? 'bg-success-500 animate-pulse' : 'bg-slate-300'
                        }`}
                      />
                      <span
                        className={`text-[10px] sm:text-xs font-bold tracking-tight ${
                          item.isActive ? 'text-success-700' : 'text-slate-400'
                        }`}
                      >
                        {item.isActive ? 'Live' : 'Hidden'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.importPreview && (
                        <>
                          <ApproveButton
                            disabled={approvePreviews.isPending}
                            onClick={() => approveImported({ productIds: [item.id] })}
                          />
                          <DeletePreviewButton onClick={() => setDeletingPreview(item)} />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingProduct(item)
                        }}
                        className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="View details & barcode"
                      >
                        <Icon name="eye" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingProduct(item)
                        }}
                        className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="Edit product details"
                      >
                        <Icon name="edit" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProduct(item)
                        }}
                        className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-slate-200/50 hover:border-brand-200 transition-all shadow-2xs"
                        title="Update stock"
                      >
                        <Icon name="inventory" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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

      <AdminImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        base={IMPORT_BASE.VENDOR}
        approveNote={APPROVE_NOTE}
        onFinished={() => list.refetch()}
        onShowPreviews={() => {
          list.refetch()
          list.changeTab('preview')
        }}
      />

      <ConfirmDialog
        isOpen={approveAllOpen}
        onClose={() => setApproveAllOpen(false)}
        title={`Approve all ${previewCount} imported products?`}
        description="They are submitted for platform review, like products you add by hand — live straight away only if auto-approval is on."
        confirmLabel="Approve all"
        isSubmitting={approvePreviews.isPending}
        onConfirm={async () => {
          await approveImported({ all: true })
          setApproveAllOpen(false)
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingPreview)}
        onClose={() => setDeletingPreview(null)}
        title="Delete this imported preview?"
        description={deletingPreview ? `"${deletingPreview.name}" is removed from your catalog. It was never live.` : ''}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          await deletePreview(deletingPreview)
          setDeletingPreview(null)
        }}
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
