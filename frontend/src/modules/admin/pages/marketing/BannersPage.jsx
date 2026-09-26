import { useMemo, useState } from 'react'
import { Badge, Button, Icon, Input, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { BannerFormDrawer } from '../../components/marketing/BannerFormDrawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { useBannersController, useBannerWriteController } from '../../controllers/useMarketingController'

const MANAGE = ADMIN_PERMISSIONS.MARKETING_MANAGE

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

const PLACEMENT_LABELS = {
  hero: 'Hero carousel',
  promo: 'Highlight card',
  strip: 'Trust strip',
}

export function BannersPage() {
  const banners = useBannersController()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingBanner, setEditingBanner] = useState(null)
  const [removingBanner, setRemovingBanner] = useState(null)

  const writer = useBannerWriteController({ onSaved: () => setEditingBanner(null) })

  const items = useMemo(() => banners.data?.items || [], [banners.data])
  const stats = banners.data?.stats || {}

  const filteredItems = useMemo(() => {
    return items.filter((banner) => {
      if (statusFilter !== 'all' && banner.status !== statusFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = banner.title?.toLowerCase().includes(q)
        const productMatch = banner.productName?.toLowerCase().includes(q)
        return Boolean(titleMatch || productMatch)
      }
      return true
    })
  }, [items, statusFilter, searchQuery])

  if (banners.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (banners.error) {
    return (
      <PageBody>
        <ErrorState error={banners.error} onRetry={banners.refetch} />
      </PageBody>
    )
  }

  const columns = [
    {
      key: 'title',
      header: 'Banner',
      render: (banner) => (
        <div className="flex items-center gap-3 py-1">
          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
            {banner.image ? (
              <img src={banner.image} alt={banner.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <Icon name="banners" className="h-5 w-5" />
              </div>
            )}
          </div>
          <span className="min-w-0 truncate font-semibold text-slate-900 text-sm">{banner.title}</span>
        </div>
      ),
    },
    {
      key: 'placement',
      header: 'Placement',
      width: '10rem',
      render: (banner) => (
        <Badge tone="neutral" size="sm">
          {PLACEMENT_LABELS[banner.placement] || 'Hero carousel'}
        </Badge>
      ),
    },
    {
      key: 'productName',
      header: 'Linked product',
      render: (banner) =>
        banner.productName ? (
          <span className="inline-flex max-w-xs items-center gap-1.5 truncate rounded-md bg-brand-50 px-2 py-1 text-2xs font-medium text-brand-700 ring-1 ring-brand-100">
            <Icon name="products" className="h-3 w-3 shrink-0" />
            <span className="truncate">{banner.productName}</span>
          </span>
        ) : (
          <span className="text-2xs text-ink-faint">No product linked</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '9rem',
      render: (banner) => {
        const isActive = banner.status === 'active'
        return (
          <button
            type="button"
            onClick={() =>
              writer.setStatus.run({ id: banner.id, status: isActive ? 'inactive' : 'active' })
            }
            className="group flex items-center gap-1.5 focus:outline-none"
            title="Click to toggle status"
          >
            <Badge
              tone={isActive ? 'success' : 'neutral'}
              dot
              size="sm"
              className="cursor-pointer capitalize transition-all group-hover:ring-1 group-hover:ring-offset-1"
            >
              {banner.status}
            </Badge>
          </button>
        )
      },
    },
    {
      key: '__actions',
      header: 'Actions',
      width: '7.5rem',
      align: 'right',
      render: (banner) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditingBanner(banner)}
              className="p-1 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
              title="Edit banner"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setRemovingBanner(banner)}
              className="p-1 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Delete banner"
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
          title="Banners"
          description="Storefront hero and promotional placements shown to buyers."
          actions={
            <PermissionGate permission={MANAGE}>
              <Button size="control" icon="add" onClick={() => setEditingBanner('new')}>
                New banner
              </Button>
            </PermissionGate>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total banners
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon name="banners" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {stats.totalBanners ?? items.length}
              </span>
              <span className="text-xs text-slate-500">on the storefront</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-50 text-success-600">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {stats.activeBanners ?? 0}
              </span>
              <span className="text-xs text-success-600 font-medium">visible now</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inactive
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon name="hide" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {stats.inactiveBanners ?? 0}
              </span>
              <span className="text-xs text-slate-500">hidden from buyers</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Product-linked
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                <Icon name="products" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {stats.linkedToProduct ?? 0}
              </span>
              <span className="text-xs text-slate-500">click through to a product</span>
            </div>
          </div>
        </div>

        {/* Toolbar & table */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setStatusFilter(status.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <Input
                id="banner-search"
                icon="search"
                placeholder="Search banners or products..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table
              className="w-full"
              columns={columns}
              data={filteredItems}
              getRowKey={(banner) => banner.id}
              density="normal"
              emptyState={
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Icon name="banners" className="h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No banners yet</p>
                  <p className="max-w-xs text-xs text-ink-faint">
                    Create your first storefront banner to promote a sale, product or category.
                  </p>
                </div>
              }
            />
          </div>
        </div>
      </PageBody>

      {editingBanner && (
        <BannerFormDrawer
          key={editingBanner === 'new' ? 'new-banner' : editingBanner.id}
          isOpen
          onClose={() => setEditingBanner(null)}
          banner={editingBanner === 'new' ? null : editingBanner}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(removingBanner)}
        onClose={() => setRemovingBanner(null)}
        title={`Delete banner: "${removingBanner?.title}"?`}
        description="This banner will stop showing on the storefront immediately. This action cannot be undone."
        confirmLabel="Delete banner"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: removingBanner.id })
          setRemovingBanner(null)
        }}
      />
    </>
  )
}
