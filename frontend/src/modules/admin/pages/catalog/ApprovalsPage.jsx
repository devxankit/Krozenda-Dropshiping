import { useState, useMemo } from 'react'
import { Switch, Button, Badge, Icon, Textarea, Input } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ApprovalQueueList } from '../../components/catalog/ApprovalQueueList'
import { ApproveWithCommissionDialog } from '../../components/commission/CommissionField'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useApprovalQueueController,
  useApprovalSettingsController,
  useApprovalSettingsWriteController,
  useApprovalWriteController,
} from '../../controllers/useCatalogController'
import { useAuthStore } from '../../../../lib/authStore'

const TABS = [
  { id: 'all', label: 'Everything', icon: 'approvals' },
  { id: 'category', label: 'Categories', icon: 'categories' },
  { id: 'brand', label: 'Brands', icon: 'brands' },
  { id: 'product', label: 'Products', icon: 'products' },
]

export function ApprovalsPage() {
  const { data, isLoading, error, refetch, isFetching } = useApprovalQueueController()
  const { data: settings } = useApprovalSettingsController()
  const settingsWriter = useApprovalSettingsWriteController()
  const [tab, setTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [rejecting, setRejecting] = useState(null)
  // A seller's category or product asks for its commission (or Skip) on
  // approval; a brand has no commission and approves straight away.
  const [approving, setApproving] = useState(null)
  // Turning auto-approval on asks for one common commission (or Skip), since
  // auto-approved items never reach the per-item approve prompt.
  const [enablingAuto, setEnablingAuto] = useState(false)
  const [reason, setReason] = useState('')

  const writer = useApprovalWriteController({
    onDone: () => {
      setRejecting(null)
      setReason('')
    },
  })

  const canApprove = useAuthStore((state) =>
    state.permissions.includes(ADMIN_PERMISSIONS.CATALOG_APPROVE),
  )

  // Filter items by active tab and search query
  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    const tabFiltered =
      tab === 'all' ? data.items : data.items.filter((item) => item.kind === tab)

    if (!searchQuery.trim()) return tabFiltered

    const query = searchQuery.toLowerCase().trim()
    return tabFiltered.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.submittedBy.toLowerCase().includes(query) ||
        (item.context && item.context.toLowerCase().includes(query)),
    )
  }, [data?.items, tab, searchQuery])

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const tabCounts = data?.tabCounts || { all: 0, category: 0, brand: 0, product: 0 }
  const isAutoApprovalOn = Boolean(settings?.autoApprovalEnabled)
  const isSellerOnlyOn = Boolean(settings?.sellerOnlyMode)

  return (
    <>
      <PageBody className="space-y-6">
        {/* Header with Quick Actions */}
        <PageHeader
          title="Catalog Approvals"
          description="Category, then brand, then product — multi-tier moderation pipeline for seller submissions."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={() => refetch()}
                isLoading={isFetching}
                title="Sync with latest catalog submissions"
              >
                Refresh Queue
              </Button>
            </div>
          }
        />

        {/* 4 Interactive KPI Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {TABS.map((t) => {
            const isSelected = tab === t.id
            const count = tabCounts[t.id] ?? 0

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  isSelected
                    ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t.label}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-brand-50 text-brand-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon name={t.icon} className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black tracking-tight text-slate-900 font-num">
                    {count.toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      count > 0
                        ? 'text-warning-600 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {count === 0 ? 'Clear' : 'Pending'}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />
                )}
              </button>
            )
          })}
        </div>

        {/* Sequential Pipeline Explainer Card */}
        <div className="rounded-2xl border border-brand-100/90 bg-gradient-to-r from-brand-50/70 via-brand-50/40 to-slate-50/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow-2xs">
                  <Icon name="info" className="h-3 w-3" />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                  Sequential Approval Pipeline
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                A listing cannot go live until all tiers clear. If an item is marked{' '}
                <strong className="font-bold text-warning-700">Blocked</strong>, approving the
                prerequisite category or brand above it will automatically unblock everything
                downstream.
              </p>
            </div>

            {/* Stepper badges */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-accent-700 shadow-2xs">
                <Icon name="categories" className="h-3.5 w-3.5 text-accent-600" />
                <span>1. Category</span>
              </div>
              <span className="text-slate-400 font-bold text-xs">➔</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-2xs">
                <Icon name="brands" className="h-3.5 w-3.5 text-brand-600" />
                <span>2. Brand</span>
              </div>
              <span className="text-slate-400 font-bold text-xs">➔</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-success-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-success-700 shadow-2xs">
                <Icon name="products" className="h-3.5 w-3.5 text-success-600" />
                <span>3. Product</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Approval Engine Configuration Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
                  isAutoApprovalOn
                    ? 'border-success-200 bg-success-50 text-success-600'
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }`}
              >
                <Icon name="live" className="h-5 w-5" />
              </span>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Auto-Approval Engine
                  </h3>
                  <Badge tone={isAutoApprovalOn ? 'success' : 'neutral'} size="sm" dot>
                    {isAutoApprovalOn ? 'Auto-Publish Active' : 'Manual Moderation'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                  {isAutoApprovalOn
                    ? 'Submissions bypass this moderation queue and publish immediately to the live marketplace.'
                    : 'All seller-submitted categories, brands, and products are paused here until an admin approves them.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <Switch
                id="catalog-auto-approval"
                checked={isAutoApprovalOn}
                disabled={!canApprove || !settings || settingsWriter.update.isSubmitting}
                onChange={(event) =>
                  event.target.checked
                    ? setEnablingAuto(true)
                    : settingsWriter.update.run({ autoApprovalEnabled: false })
                }
                label={isAutoApprovalOn ? 'Enabled' : 'Disabled'}
              />
            </div>
          </div>
        </div>

        {/* Seller-Only Catalog Mode Configuration Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
                  isSellerOnlyOn
                    ? 'border-warning-200 bg-warning-50 text-warning-600'
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }`}
              >
                <Icon name="approvals" className="h-5 w-5" />
              </span>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Seller-Only Catalog Mode
                  </h3>
                  <Badge tone={isSellerOnlyOn ? 'warning' : 'neutral'} size="sm" dot>
                    {isSellerOnlyOn ? 'Sellers Only' : 'Admin + Sellers'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                  {isSellerOnlyOn
                    ? 'Own stock is off (sidebar switch): admin can no longer add products, categories, or brands, and admin’s own products are hidden from buyers — only seller and dropshipping products are sold.'
                    : 'Both admin and sellers can add new products, categories, and brands directly.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <Switch
                id="catalog-seller-only-mode"
                checked={isSellerOnlyOn}
                disabled={!canApprove || !settings || settingsWriter.update.isSubmitting}
                onChange={(event) =>
                  settingsWriter.update.run({ sellerOnlyMode: event.target.checked })
                }
                label={isSellerOnlyOn ? 'Enabled' : 'Disabled'}
              />
            </div>
          </div>
        </div>

        {/* Main Queue Card with Tabs & Search Toolbar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {/* Toolbar Header */}
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Pill Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {TABS.map((t) => {
                  const isActive = tab === t.id
                  const count = tabCounts[t.id] ?? 0

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-slate-700 shadow-2xs'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search Box */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    id="queue-search-input"
                    type="text"
                    size="sm"
                    placeholder="Search name or seller..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <span className="hidden sm:inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 font-num">
                  {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
          </div>

          {/* Queue List Content or Empty State */}
          <ApprovalQueueList
            items={filteredItems}
            canApprove={canApprove}
            isApproving={writer.approve.isSubmitting}
            onApprove={(item) =>
              item.kind === 'brand' ? writer.approve.run({ id: item.id }) : setApproving(item)
            }
            onReject={(item) => {
              setRejecting(item)
              // Food category held up by the seller's missing/unapproved
              // FSSAI licence — start from the message they need to see.
              if (item.blockedBy === 'FSSAI licence') {
                setReason(
                  'You have not added an approved FSSAI licence. Upload your FSSAI licence from Store Profile; once admin approves it, you can resubmit this food category.',
                )
              }
            }}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            tab={tab}
            onResetTab={() => setTab('all')}
          />
        </div>
      </PageBody>

      {enablingAuto && (
        <ApproveWithCommissionDialog
          isOpen
          onClose={() => setEnablingAuto(false)}
          title="Turn on auto-approval?"
          description="Seller categories, brands and products will go live without review, so there is no approve step to set commission on. Set one common commission for them, or skip."
          skipHint={`No common commission — the seller's or category's own rate applies, else the platform default of ${settings?.defaultCommissionPercent ?? 10}%.`}
          initial={settings?.commonCommission || null}
          skipLabel="Skip & turn on"
          confirmLabel={(label) => `Turn on with ${label}`}
          isSubmitting={settingsWriter.update.isSubmitting}
          onApprove={async (commission) => {
            try {
              await settingsWriter.update.runAsync({ autoApprovalEnabled: true, commission })
              setEnablingAuto(false)
            } catch {
              // useAdminMutation already shows the error toast; keep the dialog open.
            }
          }}
        />
      )}

      {approving && (
        <ApproveWithCommissionDialog
          isOpen
          onClose={() => setApproving(null)}
          title={`Approve ${approving.name}?`}
          description={
            approving.kind === 'product'
              ? 'Set a commission just for this product, or skip it.'
              : 'Set a commission for every product in this category, or skip it.'
          }
          skipHint={
            approving.kind === 'product'
              ? "No product commission — the seller's, the category's, or the platform default applies."
              : "No category commission — the seller's commission, or the platform default, applies."
          }
          isSubmitting={writer.approve.isSubmitting}
          onApprove={async (commission) => {
            try {
              await writer.approve.runAsync({ id: approving.id, commission })
              setApproving(null)
            } catch {
              // useAdminMutation already shows the error toast; keep the dialog open.
            }
          }}
        />
      )}

      {/* Reject Confirmation Dialog with Reason */}
      <ConfirmDialog
        isOpen={Boolean(rejecting)}
        onClose={() => {
          setRejecting(null)
          setReason('')
        }}
        title={`Reject ${rejecting?.name}?`}
        description="The submission will be rejected and removed from this queue. The seller will be notified with your feedback to make corrections and resubmit."
        confirmLabel="Reject Submission"
        tone="danger"
        isSubmitting={writer.reject.isSubmitting}
        onConfirm={() => writer.reject.run({ id: rejecting.id, reason })}
      >
        <Textarea
          id="approval-reject-reason"
          label="Reason for rejection"
          rows={3}
          required
          placeholder="e.g. Images do not meet resolution standard, product category incorrect, or description missing specifications..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </ConfirmDialog>
    </>
  )
}
