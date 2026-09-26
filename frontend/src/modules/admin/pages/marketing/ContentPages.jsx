import { useState, useMemo } from 'react'
import {
  HiDocumentText,
  HiPencilSquare,
  HiTrash,
  HiEye,
  HiPlus,
  HiShieldCheck,
  HiCheck,
  HiMagnifyingGlass,
  HiClipboard,
  HiCheckCircle,
  HiArrowTopRightOnSquare,
  HiSquares2X2,
  HiListBullet,
  HiArrowPath,
  HiXMark,
  HiGlobeAlt,
  HiClock,
  HiQuestionMarkCircle,
} from 'react-icons/hi2'
import { Badge, Button, Modal, Switch, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useCmsPagesController,
  useCmsPageWriteController,
  useFaqsController,
  useFaqWriteController,
  useOffersController,
  useTemplatesController,
} from '../../controllers/useMarketingController'
import { CmsFormDrawer } from '../../components/marketing/CmsFormDrawer'
import { FaqFormDrawer } from '../../components/marketing/FaqFormDrawer'

const DLT_TONE = { approved: 'success', pending: 'warning', rejected: 'danger', not_required: 'neutral' }
const DLT_LABEL = {
  approved: 'DLT approved',
  pending: 'DLT pending',
  rejected: 'DLT rejected',
  not_required: 'Not applicable',
}

function Guard({ controller, children }) {
  if (controller.isLoading) return <PageSkeleton rows={3} />
  if (controller.error) return <ErrorState error={controller.error} onRetry={controller.refetch} />
  return children(controller.data)
}

export function OffersPage() {
  const controller = useOffersController()

  return (
    <PageBody>
      <PageHeader
        title="Offers"
        description="Automatic discounts applied at checkout. Unlike a coupon, the buyer types nothing."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
              New offer
            </Button>
          </PermissionGate>
        }
      />
      <Guard controller={controller}>
        {(data) => (
          <SectionCard title="Offer rules" description="Applied after the buyer's price tier resolves">
            <ul className="divide-y divide-border-subtle">
              {data.items.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{offer.name}</span>
                    <span className="mt-0.5 block text-2xs text-ink-subtle">
                      {offer.scope} · when {offer.condition} → {offer.effect}
                    </span>
                  </span>
                  <span className="text-2xs text-ink-faint">
                    {offer.startsOn} → {offer.endsOn}
                  </span>
                  <span className="tabular text-2xs text-ink-muted">
                    {offer.redemptions.toLocaleString('en-IN')} used
                  </span>
                  <Switch id={offer.id} checked={offer.active} onChange={() => { }} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </Guard>
    </PageBody>
  )
}

const CMS_STATUS_TONE = Object.freeze({
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
})

const CONTENT_SECTIONS = [
  { id: 'pages', label: 'CMS Pages', icon: HiDocumentText },
  { id: 'faqs', label: 'FAQs', icon: HiQuestionMarkCircle },
]

export function CmsPagesPage() {
  const [section, setSection] = useState('pages')

  return (
    <PageBody>
      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs w-fit">
        {CONTENT_SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = section === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isActive ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{s.label}</span>
            </button>
          )
        })}
      </div>

      {section === 'pages' ? <LegalPagesSection /> : <FaqsSection />}
    </PageBody>
  )
}

function LegalPagesSection() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [previewPage, setPreviewPage] = useState(null)
  const [pageToDelete, setPageToDelete] = useState(null)
  const [copiedSlug, setCopiedSlug] = useState(null)

  const cms = useCmsPagesController({ tab, search })
  const write = useCmsPageWriteController({
    onSaved: () => setIsDrawerOpen(false),
  })

  const handleCreate = () => {
    setEditingPage(null)
    setIsDrawerOpen(true)
  }

  const handleEdit = (page) => {
    setEditingPage(page)
    setIsDrawerOpen(true)
  }

  const handleDrawerSubmit = (values) => {
    if (editingPage) {
      write.update.run({ id: editingPage.id || editingPage._id, ...values })
    } else {
      write.create.run(values)
    }
  }

  const handleStatusChange = (row, newStatus) => {
    write.setStatus.run({ id: row.id || row._id, status: newStatus })
  }

  const handleDeleteConfirm = () => {
    if (pageToDelete) {
      write.remove.run({ id: pageToDelete.id || pageToDelete._id })
      setPageToDelete(null)
    }
  }

  const getPublicPath = (slug) => {
    if (['terms', 'privacy-policy', 'vendor-agreement', 'return-policy', 'shipping-policy', 'about', 'seller-faq', 'cod-policy'].includes(slug)) {
      return `/${slug}`
    }
    return `/p/${slug}`
  }

  const getPublicUrl = (slug) => `${window.location.origin}${getPublicPath(slug)}`

  const handleCopyUrl = (slug) => {
    navigator.clipboard.writeText(getPublicUrl(slug))
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2500)
  }

  const stats = cms.data?.stats || {}
  const rawItems = cms.data?.items || []

  // Client-side sorting
  const sortedItems = useMemo(() => {
    const list = [...rawItems]
    if (sortBy === 'title-asc') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    if (sortBy === 'title-desc') {
      return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
    }
    if (sortBy === 'version') {
      return list.sort((a, b) => (b.version || '').localeCompare(a.version || ''))
    }
    // Default newest
    return list
  }, [rawItems, sortBy])

  const FILTER_TABS = [
    { id: 'all', label: 'All Documents', count: stats.totalPages ?? rawItems.length },
    { id: 'published', label: 'Published', count: stats.publishedPages ?? 0 },
    { id: 'draft', label: 'Drafts', count: stats.draftPages ?? 0 },
    { id: 'legal', label: 'Mandatory Policy', count: stats.requiresAcceptance ?? 0 },
    { id: 'archived', label: 'Archived', count: stats.archivedPages ?? 0 },
  ]

  const dynamicColumns = [
    {
      key: 'title',
      header: 'Document & Route',
      render: (row) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="text-left text-xs font-bold text-slate-900 truncate hover:text-brand-600 transition-colors cursor-pointer"
          >
            {row.title}
          </button>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-mono text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              {getPublicPath(row.slug)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCopyUrl(row.slug)
              }}
              title="Copy public URL"
              className="text-slate-400 hover:text-brand-600 transition-colors p-1 rounded-md hover:bg-brand-50"
            >
              {copiedSlug === row.slug ? (
                <span className="text-2xs text-success-600 font-bold flex items-center gap-0.5">
                  <HiCheckCircle className="w-3.5 h-3.5" /> copied
                </span>
              ) : (
                <HiClipboard className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => window.open(getPublicPath(row.slug), '_blank')}
              title="Open storefront page"
              className="text-slate-400 hover:text-brand-600 transition-colors p-1 rounded-md hover:bg-brand-50"
            >
              <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '7.5rem',
      render: (row) => (
        <span className="font-mono text-2xs font-bold bg-slate-100/90 text-slate-700 px-2 py-1 rounded-lg border border-slate-200/70 shadow-2xs">
          {row.version || 'v1.0'}
        </span>
      ),
    },
    {
      key: 'requiresAcceptance',
      header: 'Enforcement',
      width: '12.5rem',
      render: (row) =>
        row.requiresAcceptance ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold bg-brand-50 text-brand-700 border border-brand-200/80 shadow-2xs">
            <HiShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            Re-acceptance required
          </span>
        ) : (
          <span className="text-2xs font-semibold text-slate-400">Informational</span>
        ),
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      width: '12rem',
      render: (row) => (
        <div className="text-2xs text-slate-500 leading-tight">
          <span className="font-semibold text-slate-800 block">{row.updatedAt || 'Recently'}</span>
          <span className="text-slate-400">by {row.updatedBy || 'Admin'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '9.5rem',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          className={`text-2xs font-bold rounded-xl px-2.5 py-1.5 border shadow-2xs focus:outline-none cursor-pointer transition-all ${
            row.status === 'published'
              ? 'bg-success-50 text-success-800 border-success-300/80 hover:bg-success-100/70'
              : row.status === 'draft'
              ? 'bg-warning-50 text-warning-800 border-warning-300/80 hover:bg-warning-100/70'
              : 'bg-slate-100 text-slate-700 border-slate-300/80 hover:bg-slate-200/60'
          }`}
        >
          <option value="published">● Published</option>
          <option value="draft">● Draft</option>
          <option value="archived">● Archived</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '8.5rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setPreviewPage(row)}
            title="Preview content"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <HiEye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleEdit(row)}
            title="Edit page"
            className="p-1.5 rounded-lg text-slate-400 hover:text-warning-600 hover:bg-warning-50 transition-colors"
          >
            <HiPencilSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPageToDelete(row)}
            title="Delete page"
            className="p-1.5 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
          >
            <HiTrash className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <span>CMS Pages & Legal Policies</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">
              {stats.totalPages ?? rawItems.length}
            </span>
          </div>
        }
        description="Manage the terms, agreements, privacy standards, and policies buyers and sellers review and accept."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cms.refetch()}
              disabled={cms.isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh CMS pages"
            >
              <HiArrowPath
                className={`h-3.5 w-3.5 ${cms.isLoading ? 'animate-spin text-brand-600' : 'text-slate-500'}`}
              />
              <span>Refresh</span>
            </button>
            <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20 cursor-pointer"
              >
                <HiPlus className="h-4 w-4" />
                <span>New Page</span>
              </button>
            </PermissionGate>
          </div>
        }
      />

      {/* Modern Notice Banner */}
      <div className="rounded-2xl border border-warning-200/80 bg-gradient-to-r from-warning-50/90 via-warning-50/50 to-warning-50/60 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning-500/10 text-warning-600 ring-1 ring-warning-500/20">
            <HiShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-warning-950">
              Policy Versioning & Mandatory Acceptance
            </h4>
            <p className="mt-0.5 text-xs text-warning-800/90 leading-relaxed">
              When publishing an updated version of a mandatory policy (e.g. Terms or Privacy), active buyers and sellers will be prompted to re-accept on their next sign-in. Previous timestamps and acceptance logs remain permanently audited.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Pages */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Documents</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10 transition-transform group-hover:scale-105">
              <HiDocumentText className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">
              {stats.totalPages ?? rawItems.length}
            </span>
            <span className="text-xs font-medium text-slate-500">pages</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>Compliance & store guides</span>
          </div>
        </div>

        {/* Published Live */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-success-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Published Live</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/10 transition-transform group-hover:scale-105">
              <HiCheckCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-success-600 tabular">
              {stats.publishedPages ?? 0}
            </span>
            <span className="text-xs font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
            <span>Public storefront routes active</span>
          </div>
        </div>

        {/* Drafts */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-warning-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drafts & Revisions</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-500/10 transition-transform group-hover:scale-105">
              <HiPencilSquare className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-warning-600 tabular">
              {stats.draftPages ?? 0}
            </span>
            <span className="text-xs font-semibold text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full">
              In Review
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning-500" />
            <span>Unpublished revisions</span>
          </div>
        </div>

        {/* Enforced Acceptance */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Enforced Policies</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-accent-500/10 transition-transform group-hover:scale-105">
              <HiShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-accent-700 tabular">
              {stats.requiresAcceptance ?? 0}
            </span>
            <span className="text-xs font-semibold text-accent-700 bg-accent-50 px-2 py-0.5 rounded-full">
              Mandatory
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
            <span>Consent required on sign-in</span>
          </div>
        </div>
      </div>

      {/* Smart Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((t) => {
            const isSelected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-2xs font-bold tabular ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.count}
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
              <HiMagnifyingGlass className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug, content…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <HiXMark className="h-4 w-4" />
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
              <option value="newest">Recently Modified</option>
              <option value="title-asc">Title (A–Z)</option>
              <option value="title-desc">Title (Z–A)</option>
              <option value="version">Version (High to Low)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Card Grid view"
            >
              <HiSquares2X2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-brand-600 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
            >
              <HiListBullet className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Guard & Views */}
      <Guard controller={cms}>
        {() => (
          <>
            {sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-3 shadow-inner">
                  <HiDocumentText className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No CMS pages found</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  {search
                    ? `No documents matching "${search}". Try adjusting your keywords or clearing the search bar.`
                    : 'No documents match the selected filter tab.'}
                </p>
                <div className="mt-4 flex gap-2">
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs cursor-pointer"
                  >
                    + Create New Page
                  </button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* Visual Grid Cards View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {sortedItems.map((page) => {
                  const isPublished = page.status === 'published'
                  const isDraft = page.status === 'draft'

                  return (
                    <div
                      key={page.id || page._id}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/90"
                    >
                      <div>
                        {/* Card Top: Icon, Version, Status */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
                                isPublished
                                  ? 'bg-success-50 text-success-600 ring-1 ring-success-500/20'
                                  : isDraft
                                  ? 'bg-warning-50 text-warning-600 ring-1 ring-warning-500/20'
                                  : 'bg-slate-100 text-slate-600 ring-1 ring-slate-300/40'
                              }`}
                            >
                              <HiDocumentText className="h-4.5 w-4.5" />
                            </span>
                            <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70">
                              {page.version || 'v1.0'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold ${
                                isPublished
                                  ? 'bg-success-50 text-success-700 ring-1 ring-success-500/20'
                                  : isDraft
                                  ? 'bg-warning-50 text-warning-700 ring-1 ring-warning-500/20'
                                  : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isPublished
                                    ? 'bg-success-500 animate-pulse'
                                    : isDraft
                                    ? 'bg-warning-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {page.status?.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Title & Enforcement Badge */}
                        <div className="mt-3.5 space-y-1.5">
                          <h3
                            onClick={() => handleEdit(page)}
                            className="text-sm font-extrabold text-slate-900 line-clamp-1 hover:text-brand-600 transition-colors cursor-pointer"
                          >
                            {page.title}
                          </h3>

                          {page.requiresAcceptance ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200">
                              <HiShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                              Mandatory Re-acceptance
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400">
                              Informational Policy
                            </span>
                          )}
                        </div>

                        {/* Route Slug & Quick Actions */}
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 border border-slate-200/70">
                          <span className="font-mono text-2xs font-semibold text-slate-600 truncate">
                            {getPublicPath(page.slug)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyUrl(page.slug)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 transition-all border border-transparent hover:border-slate-200 shadow-2xs cursor-pointer"
                              title="Copy public URL"
                            >
                              {copiedSlug === page.slug ? (
                                <span className="text-success-600 flex items-center gap-0.5">
                                  <HiCheckCircle className="w-3.5 h-3.5" /> Copied
                                </span>
                              ) : (
                                <>
                                  <HiClipboard className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => window.open(getPublicPath(page.slug), '_blank')}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-bold text-brand-700 hover:bg-brand-100/80 transition-all cursor-pointer"
                              title="Open live storefront page"
                            >
                              <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                              <span>Live</span>
                            </button>
                          </div>
                        </div>

                        {/* Content Preview Snippet */}
                        <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {page.content
                            ? page.content.replace(/[#*`_]/g, '').trim()
                            : 'No content written for this document yet.'}
                        </p>
                      </div>

                      {/* Card Bottom: Metadata & Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-2xs text-slate-400">
                        <div className="truncate">
                          <span className="font-medium text-slate-700">{page.updatedAt || 'Recently'}</span>
                          <span className="text-slate-400"> · {page.updatedBy || 'Admin'}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewPage(page)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                            title="Preview document"
                          >
                            <HiEye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(page)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-warning-600 hover:bg-warning-50 transition-colors cursor-pointer"
                            title="Edit page"
                          >
                            <HiPencilSquare className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPageToDelete(page)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors cursor-pointer"
                            title="Delete page"
                          >
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Enhanced Table View */
              <SectionCard
                title={`Documents (${sortedItems.length})`}
                description="Persisted in MongoDB with revision tracking and dynamic acceptance rules."
              >
                <Table
                  className="rounded-none border-0 border-t"
                  columns={dynamicColumns}
                  data={sortedItems}
                  getRowKey={(row) => row.id || row._id}
                  density="normal"
                />
              </SectionCard>
            )}
          </>
        )}
      </Guard>

      {/* Form Drawer */}
      <CmsFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        page={editingPage}
        onSubmit={handleDrawerSubmit}
        isSubmitting={write.create.isSubmitting || write.update.isSubmitting}
        error={write.create.error?.message || write.update.error?.message}
      />

      {/* Modern Live Document Preview Modal */}
      {previewPage && (
        <Modal
          isOpen
          onClose={() => setPreviewPage(null)}
          title={previewPage.title}
          size="lg"
        >
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Badge tone={CMS_STATUS_TONE[previewPage.status] || 'neutral'} size="sm" dot>
                  {previewPage.status?.toUpperCase()}
                </Badge>
                <span className="font-mono text-2xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  {previewPage.version || 'v1.0'}
                </span>
                {previewPage.requiresAcceptance && (
                  <Badge tone="accent" size="sm">
                    ⚖️ Mandatory Re-acceptance
                  </Badge>
                )}
              </div>

              <div className="text-2xs text-slate-500">
                Last modified: <strong className="text-slate-800">{previewPage.updatedAt || 'Recently'}</strong> by{' '}
                {previewPage.updatedBy || 'Admin'}
              </div>
            </div>

            {/* Live Storefront Route Banner */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Public Route:</span>
                <span className="font-mono text-xs text-brand-700 font-semibold truncate">
                  {getPublicUrl(previewPage.slug)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(previewPage.slug)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  {copiedSlug === previewPage.slug ? '✓ Copied' : 'Copy URL'}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(getPublicPath(previewPage.slug), '_blank')}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Storefront</span>
                  <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-line bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs font-sans max-h-[400px] overflow-y-auto">
              {previewPage.content || (
                <span className="text-slate-400 italic">No content body written for this page yet.</span>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setPreviewPage(null)}>
                Close Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const p = previewPage
                  setPreviewPage(null)
                  handleEdit(p)
                }}
              >
                Edit Document
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {pageToDelete && (
        <Modal
          isOpen
          onClose={() => setPageToDelete(null)}
          title={`Delete "${pageToDelete.title}"?`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{pageToDelete.title}</strong> (/
              {pageToDelete.slug})? This will unpublish the document from the storefront and archive it.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setPageToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={write.remove.isSubmitting}
              >
                {write.remove.isSubmitting ? 'Deleting...' : 'Delete Page'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function FaqsSection() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState(null)
  const [faqToDelete, setFaqToDelete] = useState(null)

  const faqs = useFaqsController({ tab, search })
  const write = useFaqWriteController({
    onSaved: () => setIsDrawerOpen(false),
  })

  const handleCreate = () => {
    setEditingFaq(null)
    setIsDrawerOpen(true)
  }

  const handleEdit = (faq) => {
    setEditingFaq(faq)
    setIsDrawerOpen(true)
  }

  const handleDrawerSubmit = (values) => {
    if (editingFaq) {
      write.update.run({ id: editingFaq.id || editingFaq._id, ...values })
    } else {
      write.create.run(values)
    }
  }

  const handleStatusChange = (row, newStatus) => {
    write.setStatus.run({ id: row.id || row._id, status: newStatus })
  }

  const handleDeleteConfirm = () => {
    if (faqToDelete) {
      write.remove.run({ id: faqToDelete.id || faqToDelete._id })
      setFaqToDelete(null)
    }
  }

  const stats = faqs.data?.stats || {}
  const items = faqs.data?.items || []

  const FILTER_TABS = [
    { id: 'all', label: 'All FAQs', count: stats.total ?? items.length },
    { id: 'published', label: 'Published', count: stats.published ?? 0 },
    { id: 'draft', label: 'Drafts', count: stats.draft ?? 0 },
  ]

  const columns = [
    {
      key: 'question',
      header: 'Question & Answer',
      render: (row) => (
        <div className="flex flex-col min-w-0 py-0.5 max-w-xl">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="text-left text-xs font-bold text-slate-900 truncate hover:text-brand-600 transition-colors cursor-pointer"
          >
            {row.question}
          </button>
          <p className="mt-1 text-2xs text-slate-500 line-clamp-2 leading-relaxed">{row.answer}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '9rem',
      render: (row) => (
        <span className="font-mono text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
          {row.category || 'General'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      width: '11rem',
      render: (row) => (
        <div className="text-2xs text-slate-500 leading-tight">
          <span className="font-semibold text-slate-800 block">{row.updatedAt || 'Recently'}</span>
          <span className="text-slate-400">by {row.updatedBy || 'Admin'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '9.5rem',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          className={`text-2xs font-bold rounded-xl px-2.5 py-1.5 border shadow-2xs focus:outline-none cursor-pointer transition-all ${
            row.status === 'published'
              ? 'bg-success-50 text-success-800 border-success-300/80 hover:bg-success-100/70'
              : 'bg-warning-50 text-warning-800 border-warning-300/80 hover:bg-warning-100/70'
          }`}
        >
          <option value="published">● Published</option>
          <option value="draft">● Draft</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '6.5rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            title="Edit FAQ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-warning-600 hover:bg-warning-50 transition-colors"
          >
            <HiPencilSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setFaqToDelete(row)}
            title="Delete FAQ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
          >
            <HiTrash className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <span>Frequently Asked Questions</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">
              {stats.total ?? items.length}
            </span>
          </div>
        }
        description="Add question & answer pairs shown to buyers on the storefront help center. Published FAQs update there instantly."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => faqs.refetch()}
              disabled={faqs.isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh FAQs"
            >
              <HiArrowPath className={`h-3.5 w-3.5 ${faqs.isLoading ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>
            <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20 cursor-pointer"
              >
                <HiPlus className="h-4 w-4" />
                <span>New FAQ</span>
              </button>
            </PermissionGate>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total FAQs</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10">
              <HiQuestionMarkCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 tabular">
            {stats.total ?? items.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Published Live</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/10">
              <HiCheckCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-success-600 tabular">
            {stats.published ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drafts</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-500/10">
              <HiPencilSquare className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-warning-600 tabular">
            {stats.draft ?? 0}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((t) => {
            const isSelected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  isSelected ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-2xs font-bold tabular ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-60">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <HiMagnifyingGlass className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question, answer, category…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <HiXMark className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Guard controller={faqs}>
        {() =>
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-3 shadow-inner">
                <HiQuestionMarkCircle className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No FAQs found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                {search
                  ? `No FAQs matching "${search}". Try adjusting your keywords or clearing the search bar.`
                  : 'Add your first question & answer to show it on the storefront help center.'}
              </p>
              <div className="mt-4 flex gap-2">
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs cursor-pointer"
                >
                  + Add FAQ
                </button>
              </div>
            </div>
          ) : (
            <SectionCard
              title={`FAQs (${items.length})`}
              description="Published FAQs show on the buyer Help Center, ordered by display order."
            >
              <Table
                className="rounded-none border-0 border-t"
                columns={columns}
                data={items}
                getRowKey={(row) => row.id || row._id}
                density="normal"
              />
            </SectionCard>
          )
        }
      </Guard>

      <FaqFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        faq={editingFaq}
        onSubmit={handleDrawerSubmit}
        isSubmitting={write.create.isSubmitting || write.update.isSubmitting}
        error={write.create.error?.message || write.update.error?.message}
      />

      {faqToDelete && (
        <Modal isOpen onClose={() => setFaqToDelete(null)} title="Delete this FAQ?" size="sm">
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">&ldquo;{faqToDelete.question}&rdquo;</strong>?
              This will remove it from the storefront help center immediately.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setFaqToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={write.remove.isSubmitting}
              >
                {write.remove.isSubmitting ? 'Deleting...' : 'Delete FAQ'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// Templates are data, not code. DLT-approved SMS text cannot be edited freely
// once registered with TRAI — so the panel shows the registration state rather
// than pretending the text is freely editable.
export function TemplatesPage() {
  const controller = useTemplatesController()
  const blocked =
    controller.data?.items.filter(
      (row) => row.channels.includes('sms') && ['pending', 'rejected'].includes(row.dltStatus),
    ) || []

  return (
    <PageBody>
      <PageHeader
        title="Notification templates"
        description="One template per event, per channel. SMS text must be registered with TRAI before it can send."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.MARKETING_MANAGE}>
            <Button size="control" icon="add">
              New template
            </Button>
          </PermissionGate>
        }
      />

      {blocked.length > 0 && (
        <InlineAlert tone="danger" title={`${blocked.length} SMS templates cannot send`}>
          {blocked.map((row) => row.name).join(', ')} — DLT registration is pending or was
          rejected. Registration is client-owned and takes 3 to 10 working days.
        </InlineAlert>
      )}

      <Guard controller={controller}>
        {(data) => (
          <SectionCard title="Templates" description="Editing approved SMS text requires re-registration">
            <ul className="divide-y divide-border-subtle">
              {data.items.map((template) => (
                <li key={template.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      {template.name}
                    </span>
                    <span className="tabular block text-2xs text-ink-faint">
                      {template.trigger}
                    </span>
                  </span>

                  <span className="flex gap-1">
                    {template.channels.map((channel) => (
                      <Badge key={channel} tone="neutral" size="sm">
                        {channel.toUpperCase()}
                      </Badge>
                    ))}
                  </span>

                  <span className="flex w-52 items-center gap-2">
                    <Badge tone={DLT_TONE[template.dltStatus]} size="sm" dot>
                      {DLT_LABEL[template.dltStatus]}
                    </Badge>
                    {template.dltTemplateId && (
                      <span className="tabular truncate text-2xs text-ink-faint">
                        {template.dltTemplateId}
                      </span>
                    )}
                  </span>

                  <Switch id={template.id} checked={template.active} onChange={() => { }} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </Guard>
    </PageBody>
  )
}
