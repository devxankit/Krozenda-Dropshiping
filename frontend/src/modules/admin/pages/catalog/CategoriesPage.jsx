import { useMemo, useState } from 'react'
import { Avatar, Badge, Icon, Input, Pagination, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { CategoryFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import {
  useApprovalSettingsController,
  useCategoryTreeController,
  useCategoryWriteController,
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

export function CategoriesPage() {
  const categories = useCategoryTreeController()
  const { data: approvalSettings } = useApprovalSettingsController()
  const isSellerOnlyOn = Boolean(approvalSettings?.sellerOnlyMode)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'top' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'top-first' | 'name-asc' | 'name-desc' | 'status'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  const [editingCategory, setEditingCategory] = useState(null)
  const [removingCategory, setRemovingCategory] = useState(null)
  const [page, setPage] = useState(1)

  const writer = useCategoryWriteController({
    onSaved: () => setEditingCategory(null),
  })

  const categoryItems = useMemo(() => categories.data?.items || [], [categories.data])

  const totalCount = categoryItems.length
  const topCount = useMemo(() => categoryItems.filter((c) => c.isTopCategory).length, [categoryItems])
  const activeCount = useMemo(() => categoryItems.filter((c) => c.isActive).length, [categoryItems])
  const inactiveCount = totalCount - activeCount
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0
  const topRatio = totalCount > 0 ? Math.round((topCount / totalCount) * 100) : 0

  const filteredCategories = useMemo(() => {
    const list = categoryItems.filter((item) => {
      if (statusFilter === 'top' && !item.isTopCategory) return false
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return Boolean(item.name?.toLowerCase().includes(q))
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'top-first') return Number(b.isTopCategory || 0) - Number(a.isTopCategory || 0)
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'status') return Number(b.isActive) - Number(a.isActive)
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })
  }, [categoryItems, statusFilter, searchQuery, sortBy])

  // Resets to page 1 whenever the filters change
  const filterKey = `${statusFilter}|${searchQuery}|${sortBy}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedCategories = useMemo(
    () => filteredCategories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredCategories, currentPage],
  )

  if (categories.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (categories.error) {
    return (
      <PageBody>
        <ErrorState error={categories.error} onRetry={categories.refetch} />
      </PageBody>
    )
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Categories', count: totalCount },
    { id: 'top', label: '⭐ Top Featured', count: topCount },
    { id: 'active', label: 'Active in Store', count: activeCount },
    { id: 'inactive', label: 'Inactive / Hidden', count: inactiveCount },
  ]

  const tableColumns = [
    {
      key: 'name',
      header: 'Category Details',
      render: (item) => (
        <div className="flex items-center gap-3.5 py-1">
          {item.image ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-xs">
              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-sm ring-1 ring-brand-500/20">
              {item.name ? item.name.slice(0, 2).toUpperCase() : 'CT'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
              {item.isTopCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-400/40">
                  ⭐ Top Category
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-400 truncate">ID: {item.id ? String(item.id).slice(-8) : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'isTopCategory',
      header: 'Top Category',
      width: '11rem',
      render: (item) => (
        <PermissionGate
          permission={MANAGE}
          fallback={
            <Badge tone={item.isTopCategory ? 'accent' : 'neutral'} size="sm">
              {item.isTopCategory ? '⭐ Top Category' : 'Standard'}
            </Badge>
          }
        >
          <button
            type="button"
            disabled={writer.setTopStatus.isSubmitting}
            onClick={() =>
              writer.setTopStatus.run({ id: item.id, isTopCategory: !item.isTopCategory })
            }
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
              item.isTopCategory
                ? 'bg-amber-100/90 text-amber-800 ring-1 ring-amber-400/60 shadow-xs hover:bg-amber-200'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800'
            }`}
            title={item.isTopCategory ? 'Click to remove from Top Categories' : 'Click to mark as Top Category'}
          >
            <span>{item.isTopCategory ? '⭐ Featured' : '☆ Not Top'}</span>
          </button>
        </PermissionGate>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created On',
      width: '10rem',
      render: (item) => (
        <span className="text-xs text-slate-500 font-medium">{formatDate(item.createdAt)}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Storefront Visibility',
      width: '12rem',
      render: (item) => (
        <div className="flex items-center gap-3">
          <Switch
            id={`category-table-active-${item.id}`}
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
      width: '7.5rem',
      align: 'right',
      render: (item) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditingCategory(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Edit category"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRemovingCategory(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
              title="Delete category"
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
              <span>Categories</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/70">
                {totalCount}
              </span>
            </div>
          }
          description="Create, curate, and organize collections to drive product discovery across the store."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => categories.refetch()}
                disabled={categories.isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh categories"
              >
                <Icon name="refresh" className={`h-3.5 w-3.5 ${categories.isFetching ? 'animate-spin text-brand-600' : ''}`} />
                <span>Refresh</span>
              </button>
              <PermissionGate permission={MANAGE}>
                <button
                  type="button"
                  onClick={() => setEditingCategory('new')}
                  disabled={isSellerOnlyOn}
                  title={isSellerOnlyOn ? 'Seller-only catalog mode is on — sellers add categories, admin only approves them' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>New Category</span>
                </button>
              </PermissionGate>
            </div>
          }
        />

        {/* Upgraded KPI Metric Cards (4 Grid) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Categories */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Categories</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10 transition-transform group-hover:scale-105">
                <Icon name="categories" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
              <span className="text-xs font-medium text-slate-500">collections</span>
            </div>
            <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span>Catalog grouping taxonomy</span>
            </div>
          </div>

          {/* Top Featured Categories */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-amber-300">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Top Categories</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/10 transition-transform group-hover:scale-105">
                <span className="text-base font-bold">⭐</span>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{topCount}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {topRatio}% of catalog
              </span>
            </div>
            <div className="mt-3.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${topRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Categories */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Active in Store</span>
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
            <div className="mt-3.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${activeRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Inactive Categories */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Inactive / Hidden</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 transition-transform group-hover:scale-105">
                <Icon name="warning" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{inactiveCount}</span>
              <span className="text-xs font-medium text-slate-500">drafts</span>
            </div>
            <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${inactiveCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span>{inactiveCount > 0 ? 'Unpublished from storefront' : 'All categories are active'}</span>
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
                placeholder="Search categories..."
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
                <option value="top-first">⭐ Top Featured First</option>
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
        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
              <Icon name="categories" className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery || statusFilter !== 'all' ? 'No matching categories' : 'No categories yet'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or switching the filter tab.'
                : 'Get started by creating your first category to organize products in the catalog.'}
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
                  onClick={() => setEditingCategory('new')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
                >
                  <Icon name="add" className="h-3.5 w-3.5" />
                  <span>Create Category</span>
                </button>
              </PermissionGate>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Visual Card Grid View */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pagedCategories.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-brand-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                {/* Image Banner Showcase */}
                <div className="relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 border border-slate-100 flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-xl ring-1 ring-brand-500/20">
                        {item.name ? item.name.slice(0, 2).toUpperCase() : 'CT'}
                      </div>
                    </div>
                  )}

                  {/* Top Category floating badge at top-left */}
                  {item.isTopCategory && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-2xs font-extrabold text-white shadow-sm backdrop-blur-md">
                        ⭐ Top Category
                      </span>
                    </div>
                  )}

                  {/* Status Badge floating at top right */}
                  <div className="absolute top-2.5 right-2.5 z-10">
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
                  <div className="flex items-center gap-2">
                    <h3
                      className="font-bold text-slate-900 text-base truncate group-hover:text-brand-600 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h3>
                  </div>
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
                  {/* Left Controls: Visibility & Top Toggle */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5" title="Storefront Visibility">
                      <Switch
                        id={`category-grid-active-${item.id}`}
                        checked={item.isActive}
                        disabled={writer.setStatus.isSubmitting}
                        onChange={() => writer.setStatus.run({ id: item.id, isActive: !item.isActive })}
                      />
                      <span className="text-2xs font-semibold text-slate-600">
                        {item.isActive ? 'Live' : 'Hidden'}
                      </span>
                    </div>

                    <PermissionGate permission={MANAGE}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          writer.setTopStatus.run({ id: item.id, isTopCategory: !item.isTopCategory })
                        }}
                        disabled={writer.setTopStatus.isSubmitting}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-bold transition-all ${
                          item.isTopCategory
                            ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400/50 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                        }`}
                        title={item.isTopCategory ? 'Click to remove from Top Categories' : 'Click to mark as Top Category'}
                      >
                        <span>{item.isTopCategory ? '★ Top' : '☆ Top'}</span>
                      </button>
                    </PermissionGate>
                  </div>

                  <PermissionGate permission={MANAGE}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCategory(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Edit category"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingCategory(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        title="Delete category"
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
              data={pagedCategories}
              getRowKey={(item) => item.id}
              density="comfortable"
            />
          </div>
        )}

        {filteredCategories.length > 0 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredCategories.length}
            rowsPerPage={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="categories"
          />
        )}
      </PageBody>

      {/* Category Create/Edit Drawer */}
      {editingCategory && (
        <CategoryFormDrawer
          key={editingCategory === 'new' ? 'new-category' : editingCategory.id}
          isOpen
          onClose={() => setEditingCategory(null)}
          category={editingCategory === 'new' ? null : editingCategory}
          writer={writer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingCategory)}
        onClose={() => setRemovingCategory(null)}
        title={`Delete category: "${removingCategory?.name}"?`}
        description="This category will be permanently removed from the catalog. Existing products assigned to this category may need re-categorization."
        confirmLabel="Delete category"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removingCategory.id })
          setRemovingCategory(null)
        }}
      />
    </>
  )
}
