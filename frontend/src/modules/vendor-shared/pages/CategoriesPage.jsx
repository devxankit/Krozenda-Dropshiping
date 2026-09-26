import { useMemo, useState } from 'react'
import { Badge, Icon, Pagination, Table } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { toast } from '../../admin/stores/toastStore'
import { useVendorCatalogCategoriesController } from '../controllers/useVendorController'
import { VendorCategoryFormDrawer } from '../components/catalog/VendorCatalogForms'

const STATUS_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const PAGE_SIZE = 10

function formatDate(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

// Mirrors the admin Categories screen's layout (KPI cards, search, sort,
// grid/table toggle) but read-only — a seller can't edit/delete/feature the
// shared taxonomy, only propose additions (see VendorCategoryFormDrawer),
// which stay PENDING until admin approves them in the Approval Queue.
export function CategoriesPage() {
  const categories = useVendorCatalogCategoriesController()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'approved' | 'mine'
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(1)

  const categoryItems = useMemo(() => categories.items || [], [categories.items])

  const totalCount = categoryItems.length
  const approvedCount = useMemo(() => categoryItems.filter((c) => c.approvalStatus === 'APPROVED').length, [categoryItems])
  const mineCount = useMemo(() => categoryItems.filter((c) => c.mine).length, [categoryItems])
  const pendingCount = useMemo(() => categoryItems.filter((c) => c.mine && c.approvalStatus === 'PENDING').length, [categoryItems])

  const filteredCategories = useMemo(() => {
    const list = categoryItems.filter((item) => {
      if (statusFilter === 'approved' && item.approvalStatus !== 'APPROVED') return false
      if (statusFilter === 'mine' && !item.mine) return false
      if (searchQuery.trim()) {
        return Boolean(item.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [categoryItems, statusFilter, searchQuery, sortBy])

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

  async function handleSubmit({ name, image, isFood }) {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('isFood', String(Boolean(isFood)))
    if (image) formData.append('image', image)

    setIsSubmitting(true)
    try {
      const created = await categories.createCategory(formData)
      // Food category without an approved FSSAI licence: saved, but blocked
      // in admin's queue until the licence is approved.
      if (created?.fssaiRequired) {
        toast.warning(
          'FSSAI licence required',
          created.fssaiStatus === 'PENDING'
            ? `"${name}" will be reviewed once admin approves your FSSAI licence.`
            : `"${name}" is saved, but admin can approve it only after you upload an FSSAI licence from Store Profile and it is approved.`,
        )
      } else {
        toast.success('Submitted for review', `"${name}" was sent to admin for approval.`)
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Categories', count: totalCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'mine', label: 'Added by Me', count: mineCount },
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 to-brand-500/10 text-brand-600 font-bold text-sm ring-1 ring-brand-500/20">
              {item.name ? item.name.slice(0, 2).toUpperCase() : 'CT'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
            {item.mine && item.approvalStatus === 'REJECTED' && item.rejectionReason && (
              <p className="text-2xs text-danger-600 truncate">{item.rejectionReason}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created On',
      width: '10rem',
      render: (item) => <span className="text-xs text-slate-500 font-medium">{formatDate(item.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '12rem',
      render: (item) => (
        <Badge tone={item.mine ? STATUS_TONE[item.approvalStatus] || 'neutral' : 'success'} dot size="sm">
          {item.mine ? item.approvalStatus : 'Approved'}
        </Badge>
      ),
    },
  ]

  return (
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
        description="Pick an approved category when adding a product. Need something new? Add it here — it goes live once admin approves it."
        actions={
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20"
          >
            <Icon name="add" className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </button>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Categories</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10 transition-transform group-hover:scale-105">
              <Icon name="categories" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
            <span className="text-xs font-medium text-slate-500">usable for products</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-success-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Approved</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/10 transition-transform group-hover:scale-105">
              <Icon name="check" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{approvedCount}</span>
            <span className="text-xs font-medium text-slate-500">live on storefront</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-warning-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Your Pending</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-500/10 transition-transform group-hover:scale-105">
              <Icon name="pending" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{pendingCount}</span>
            <span className="text-xs font-medium text-slate-500">awaiting admin review</span>
          </div>
        </div>
      </div>

      {/* Smart Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const isSelected = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isSelected ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-2xs font-bold tabular ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="relative w-full sm:w-60">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Icon name="search" className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-all"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600">
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/20 cursor-pointer transition-all"
            >
              <option value="newest">Newest First</option>
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
              <Icon name="chevronDown" className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Icon name="categories" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Icon name="list" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {categories.isLoading ? (
        <p className="text-xs text-ink-subtle">Loading…</p>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
            <Icon name="categories" className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {searchQuery || statusFilter !== 'all' ? 'No matching categories' : 'No categories yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filter tab.' : 'Add your first category to get started.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pagedCategories.map((item) => (
            <div key={item.id} className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-brand-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 border border-slate-100 flex items-center justify-center">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-500/10 text-brand-600 font-bold text-xl ring-1 ring-brand-500/20">
                    {item.name ? item.name.slice(0, 2).toUpperCase() : 'CT'}
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <Badge tone={item.mine ? STATUS_TONE[item.approvalStatus] || 'neutral' : 'success'} dot size="sm" className="backdrop-blur-md bg-white/95 shadow-xs border border-white/80 font-semibold">
                    {item.mine ? item.approvalStatus : 'Approved'}
                  </Badge>
                </div>
              </div>

              <div className="mt-3.5 flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-brand-600 transition-colors" title={item.name}>
                  {item.name}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-2xs text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Icon name="calendar" className="h-3 w-3 text-slate-400" />
                    {formatDate(item.createdAt)}
                  </span>
                  {item.mine && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">Added by you</span>}
                  {item.isFood && <span className="rounded-full bg-warning-50 px-1.5 py-0.5 font-semibold text-warning-700">Food · FSSAI</span>}
                </div>
                {item.mine && item.isFood && item.approvalStatus === 'PENDING' && (
                  <p className="mt-1.5 text-2xs text-warning-700">Approved only after your FSSAI licence is approved (Store Profile).</p>
                )}
                {item.mine && item.approvalStatus === 'REJECTED' && item.rejectionReason && (
                  <p className="mt-1.5 text-2xs text-danger-600">{item.rejectionReason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <Table className="rounded-none border-0" columns={tableColumns} data={pagedCategories} getRowKey={(item) => item.id} density="comfortable" />
        </div>
      )}

      {filteredCategories.length > 0 && (
        <Pagination page={currentPage} totalPages={totalPages} totalItems={filteredCategories.length} rowsPerPage={PAGE_SIZE} onPageChange={setPage} itemLabel="categories" />
      )}

      <VendorCategoryFormDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </PageBody>
  )
}
