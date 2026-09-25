import { useMemo, useState } from 'react'
import { Avatar, Badge, Icon, Input, Pagination, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { BrandFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import {
  useApprovalSettingsController,
  useBrandsController,
  useBrandWriteController,
} from '../../controllers/useCatalogController'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE
const PAGE_SIZE = 10

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

export function BrandsPage() {
  const brands = useBrandsController()
  const { data: approvalSettings } = useApprovalSettingsController()
  const isSellerOnlyOn = Boolean(approvalSettings?.sellerOnlyMode)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'name-asc' | 'name-desc' | 'status'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  const [editingBrand, setEditingBrand] = useState(null)
  const [removingBrand, setRemovingBrand] = useState(null)
  const [page, setPage] = useState(1)

  const writer = useBrandWriteController({
    onSaved: () => setEditingBrand(null),
  })

  const brandItems = useMemo(() => brands.data?.items || [], [brands.data])

  const totalCount = brandItems.length
  const activeCount = useMemo(() => brandItems.filter((b) => b.isActive).length, [brandItems])
  const inactiveCount = totalCount - activeCount
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0

  const filteredBrands = useMemo(() => {
    const list = brandItems.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return Boolean(item.name?.toLowerCase().includes(q))
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'status') return Number(b.isActive) - Number(a.isActive)
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })
  }, [brandItems, statusFilter, searchQuery, sortBy])

  // Resets to page 1 whenever the filters change, following the React pattern
  // for adjusting state during render instead of a setState-in-effect.
  const filterKey = `${statusFilter}|${searchQuery}|${sortBy}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedBrands = useMemo(
    () => filteredBrands.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredBrands, currentPage],
  )

  if (brands.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (brands.error) {
    return (
      <PageBody>
        <ErrorState error={brands.error} onRetry={brands.refetch} />
      </PageBody>
    )
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Brands', count: totalCount },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
  ]

  const tableColumns = [
    {
      key: 'name',
      header: 'Brand Details',
      render: (item) => (
        <div className="flex items-center gap-3.5 py-1">
          {item.logo ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-700 font-bold text-sm ring-1 ring-amber-500/20">
              {item.name ? item.name.slice(0, 2).toUpperCase() : 'BR'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
            <p className="text-2xs text-slate-400 truncate">ID: {item.id ? String(item.id).slice(-8) : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Registered On',
      width: '12rem',
      render: (item) => (
        <span className="text-xs text-slate-500 font-medium">{formatDate(item.createdAt)}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Storefront Visibility',
      width: '13rem',
      render: (item) => (
        <div className="flex items-center gap-3">
          <Switch
            id={`brand-table-active-${item.id}`}
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
      key: '__actions',
      header: 'Actions',
      width: '8rem',
      align: 'right',
      render: (item) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditingBrand(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Edit brand"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRemovingBrand(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
              title="Delete brand"
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
              <span>Brands</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/70">
                {totalCount}
              </span>
            </div>
          }
          description="Manage brand partners, manufacturer logos, and storefront brand directories."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => brands.refetch()}
                disabled={brands.isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh brands"
              >
                <Icon name="refresh" className={`h-3.5 w-3.5 ${brands.isFetching ? 'animate-spin text-brand-600' : ''}`} />
                <span>Refresh</span>
              </button>
              <PermissionGate permission={MANAGE}>
                <button
                  type="button"
                  onClick={() => setEditingBrand('new')}
                  disabled={isSellerOnlyOn}
                  title={isSellerOnlyOn ? 'Own stock is off — turn it on from the sidebar to add brands' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>Add Brand</span>
                </button>
              </PermissionGate>
            </div>
          }
        />

        {/* Upgraded KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total Brands */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Brands</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10 transition-transform group-hover:scale-105">
                <Icon name="brands" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
              <span className="text-xs font-medium text-slate-500">partners</span>
            </div>
            <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Full catalog brand directory</span>
            </div>
          </div>

          {/* Active Brands */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Active in Catalog</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10 transition-transform group-hover:scale-105">
                <Icon name="check" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{activeCount}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {activeRatio}% live
              </span>
            </div>
            {/* Micro progress meter */}
            <div className="mt-3.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${activeRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Inactive Brands */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Inactive / Hidden</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-500/10 transition-transform group-hover:scale-105">
                <Icon name="warning" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{inactiveCount}</span>
              <span className="text-xs font-medium text-slate-500">hidden</span>
            </div>
            <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${inactiveCount > 0 ? 'bg-rose-500' : 'bg-slate-300'}`} />
              <span>{inactiveCount > 0 ? 'Not discoverable in filters' : 'All brands are visible'}</span>
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
            <div className="relative w-full sm:w-60">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brands..."
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

            {/* Sort Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
                <option value="status">Active First</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                <Icon name="chevronDown" className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* View Mode Switcher */}
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

        {/* Content Presentation */}
        {filteredBrands.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
              <Icon name="brands" className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery || statusFilter !== 'all' ? 'No matching brands' : 'No brands yet'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or switching the status filter tab.'
                : 'Register your first brand partner to associate products and provide brand filters.'}
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
                  onClick={() => setEditingBrand('new')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>Register Brand</span>
                </button>
              </PermissionGate>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Visual Brand Card Grid View */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pagedBrands.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-brand-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                {/* Logo Showcase Area */}
                <div className="relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/90 border border-slate-100 flex items-center justify-center p-5">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-xs transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-700 font-bold text-xl ring-1 ring-amber-500/20">
                        {item.name ? item.name.slice(0, 2).toUpperCase() : 'BR'}
                      </div>
                    </div>
                  )}

                  {/* Status Badge floating at top right */}
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
                  <h3
                    className="font-bold text-slate-900 text-base truncate group-hover:text-brand-600 transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-2xs text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon name="calendar" className="h-3 w-3 text-slate-400" />
                      {formatDate(item.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="truncate">ID: {item.id ? String(item.id).slice(-6) : '—'}</span>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`brand-grid-active-${item.id}`}
                      checked={item.isActive}
                      disabled={writer.setStatus.isSubmitting}
                      onChange={() => writer.setStatus.run({ id: item.id, isActive: !item.isActive })}
                    />
                    <span className="text-2xs font-semibold text-slate-600">
                      {item.isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </div>

                  <PermissionGate permission={MANAGE}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingBrand(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Edit brand"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingBrand(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        title="Delete brand"
                      >
                        <Icon name="delete" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* High-Density Modern Table View */
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <Table
              className="rounded-none border-0"
              columns={tableColumns}
              data={pagedBrands}
              getRowKey={(item) => item.id}
              density="comfortable"
            />
          </div>
        )}

        {filteredBrands.length > 0 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredBrands.length}
            rowsPerPage={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="brands"
          />
        )}
      </PageBody>

      {/* Brand Create/Edit Drawer */}
      {editingBrand && (
        <BrandFormDrawer
          key={editingBrand === 'new' ? 'new-brand' : editingBrand.id}
          isOpen
          onClose={() => setEditingBrand(null)}
          brand={editingBrand === 'new' ? null : editingBrand}
          writer={writer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingBrand)}
        onClose={() => setRemovingBrand(null)}
        title={`Delete brand: "${removingBrand?.name}"?`}
        description="This brand will be permanently deleted from the catalog directory. Existing products referencing this brand may need reassignment."
        confirmLabel="Delete brand"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removingBrand.id })
          setRemovingBrand(null)
        }}
      />
    </>
  )
}
