import { useMemo, useState } from 'react'
import { Badge, Icon, Table } from '../../../../components/ui'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import {
  ADMIN_PERMISSIONS,
  VENDOR_TYPE_TONE,
  VENDOR_VERIFICATION_LABELS,
  VENDOR_VERIFICATION_TONE,
} from '../../constants'
import { useVendorListController, useVendorWriteController } from '../../controllers/usePeopleController'
import { MoneyCell, StatusPill } from '../../components/display'
import { PageBody } from '../../components/shell'
import { VendorFormDrawer } from '../../components/people/VendorFormDrawer'
import { PartnerDetailDrawer } from '../../components/dropshipping/PartnerDetailDrawer'

export function VendorsPage() {
  const list = useVendorListController()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'B2B' | 'B2C' | 'pending' | 'suspended'

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)

  const { create, setActive } = useVendorWriteController({ onSaved: () => setIsFormOpen(false) })

  const rawItems = list.items || []
  const totalCount = rawItems.length

  const b2bCount = useMemo(() => rawItems.filter((r) => r.vendorType === 'B2B').length, [rawItems])
  const b2cCount = useMemo(() => rawItems.filter((r) => r.vendorType === 'B2C').length, [rawItems])
  const pendingKycCount = useMemo(
    () => rawItems.filter((r) => ['PENDING', 'UNDER_REVIEW'].includes(r.verificationStatus)).length,
    [rawItems],
  )
  const activeCount = useMemo(() => rawItems.filter((r) => r.isActive).length, [rawItems])
  const unlinkedCount = useMemo(() => rawItems.filter((r) => !r.bankLinked).length, [rawItems])
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0

  const filteredItems = useMemo(() => {
    return rawItems.filter((vendor) => {
      if (activeTab === 'B2B' && vendor.vendorType !== 'B2B') return false
      if (activeTab === 'B2C' && vendor.vendorType !== 'B2C') return false
      if (activeTab === 'pending' && !['PENDING', 'UNDER_REVIEW'].includes(vendor.verificationStatus)) {
        return false
      }
      if (activeTab === 'suspended' && vendor.status !== 'suspended') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return (
          vendor.name?.toLowerCase().includes(q) ||
          vendor.businessName?.toLowerCase().includes(q) ||
          vendor.email?.toLowerCase().includes(q) ||
          vendor.mobile?.includes(q) ||
          vendor.city?.toLowerCase().includes(q) ||
          vendor.gstin?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawItems, activeTab, searchQuery])

  if (list.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={5} />
      </PageBody>
    )
  }

  if (list.error) {
    return (
      <PageBody>
        <ErrorState error={list.error} onRetry={list.refetch} />
      </PageBody>
    )
  }

  function openCreate() {
    setIsFormOpen(true)
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Partners', count: totalCount },
    { id: 'B2B', label: 'B2B', count: b2bCount },
    { id: 'B2C', label: 'B2C', count: b2cCount },
    { id: 'pending', label: 'Pending Verification', count: pendingKycCount },
    { id: 'suspended', label: 'Suspended', count: rawItems.filter((r) => r.status === 'suspended').length },
  ]

  const tableColumns = [
    {
      key: 'name',
      header: 'Vendor / Partner',
      render: (row) => {
        const initials = (row.name || 'Vendor')
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('')
        return (
          <div
            className="flex items-center gap-3.5 py-1 cursor-pointer group"
            onClick={() => setSelectedVendor(row)}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 font-black text-white text-xs ring-1 ring-slate-800/20 shadow-xs group-hover:scale-105 transition-transform">
              {initials || 'V'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-brand-600 transition-colors">
                  {row.businessName || row.name}
                </p>
                <Badge tone={VENDOR_TYPE_TONE[row.vendorType] || 'neutral'} size="sm">
                  {row.vendorType}
                </Badge>
              </div>
              <p className="text-2xs text-slate-400 truncate">
                {row.role} · {row.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'location',
      header: 'Hub & GSTIN',
      width: '13rem',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800 text-xs">{row.city || '—'}</span>
          <span className="font-mono text-2xs text-slate-400">
            {row.gstin || <span className="italic text-slate-300">No GSTIN</span>}
          </span>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Live SKUs',
      width: '6.5rem',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900 text-xs tabular">
          {row.products ?? 0}
        </span>
      ),
    },
    {
      key: 'revenue',
      header: 'Gross Revenue',
      width: '9.5rem',
      align: 'right',
      render: (row) => (
        <div className="flex flex-col items-end">
          <MoneyCell amount={row.revenue ?? 0} compact />
          <span className="text-2xs text-slate-400 tabular">
            {row.orders ?? row.ordersCount ?? 0} orders
          </span>
        </div>
      ),
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      width: '10.5rem',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill
            status={row.verificationStatus}
            labels={VENDOR_VERIFICATION_LABELS}
            tones={VENDOR_VERIFICATION_TONE}
            size="sm"
          />
          {!row.isActive && row.verificationStatus === 'APPROVED' && (
            <span className="text-2xs text-slate-400">Suspended</span>
          )}
        </div>
      ),
    },
    {
      key: 'bankLinked',
      header: 'Payout Bank',
      width: '9.5rem',
      render: (row) => (
        <Badge tone={row.bankLinked ? 'success' : 'warning'} dot size="sm">
          {row.bankLinked ? 'On file' : 'Missing'}
        </Badge>
      ),
    },
    {
      key: '__actions',
      header: 'Actions',
      width: '6rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="View partner details"
            onClick={() => setSelectedVendor(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Icon name="eye" className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    // PageBody is the panel's one page container — it owns the gutter and the
    // vertical rhythm, so this screen lines up with every other one.
    <PageBody className="gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
            <span>People & Organization</span>
            <span className="text-slate-300">/</span>
            <span className="text-brand-600 font-semibold">Sellers & Partners</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Sellers & Dropship Partners
            </h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {totalCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Unified directory for marketplace sellers, dropshipping supply partners, and platform-managed inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            title="Refresh vendor directory"
          >
            <Icon name="refresh" className={`h-3.5 w-3.5 ${list.isFetching ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <PermissionGate permission={ADMIN_PERMISSIONS.PEOPLE_MANAGE}>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20"
            >
              <Icon name="add" className="h-3.5 w-3.5" />
              <span>Onboard Partner</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Analytics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Directory */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Total Partners</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10 transition-transform group-hover:scale-105">
              <Icon name="sellers" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
            <span className="text-xs font-medium text-slate-500">registered entities</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span>Multi-vendor supply ecosystem</span>
          </div>
        </div>

        {/* B2B Partners */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-brand-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">B2B Partners</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10 transition-transform group-hover:scale-105">
              <Icon name="catalog" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{b2bCount}</span>
            <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
              Businesses
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>Registered entities with GST & contact person</span>
          </div>
        </div>

        {/* B2C Partners */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-violet-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">B2C Partners</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-500/10 transition-transform group-hover:scale-105">
              <Icon name="customers" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{b2cCount}</span>
            <span className="text-xs font-medium text-slate-500">individual sellers</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span>Direct-to-shopper sellers</span>
          </div>
        </div>

        {/* Active partners */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Live & Selling</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10 transition-transform group-hover:scale-105">
              <Icon name="check" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">
              {activeRatio}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {activeCount} active
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
      </div>

      {/* Missing payout details banner */}
      {unlinkedCount > 0 && (
        <InlineAlert tone="warning" title={`${unlinkedCount} partners cannot receive settlements yet`}>
          Partners without bank account and IFSC details on file are excluded from settlement
          disbursements until they complete their payout profile.
        </InlineAlert>
      )}

      {/* Smart Live Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Icon name="search" className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor, city, GSTIN or role…"
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
      </div>

      {/* Directory Table / Empty State */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
            <Icon name="sellers" className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {searchQuery || activeTab !== 'all' ? 'No matching partners' : 'No vendors onboarded yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {searchQuery || activeTab !== 'all'
              ? 'Try modifying your search terms or clearing the filter tab.'
              : 'Register B2B businesses and B2C sellers to build your platform catalog.'}
          </p>
          {searchQuery || activeTab !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveTab('all')
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Icon name="close" className="h-3 w-3" />
              <span>Clear Filters</span>
            </button>
          ) : (
            <PermissionGate permission={ADMIN_PERMISSIONS.PEOPLE_MANAGE}>
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
              >
                <Icon name="add" className="h-3.5 w-3.5" />
                <span>Onboard Partner</span>
              </button>
            </PermissionGate>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <Table
            className="rounded-none border-0"
            columns={tableColumns}
            data={filteredItems}
            getRowKey={(row) => row.id}
            density="comfortable"
          />
        </div>
      )}

      {/* One-step partner registration */}
      <VendorFormDrawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={create.run}
        isSubmitting={create.isSubmitting}
        error={create.error}
      />

      {/* Right-Side Partner Detail Drawer */}
      <PartnerDetailDrawer
        partner={selectedVendor}
        isOpen={Boolean(selectedVendor)}
        onClose={() => setSelectedVendor(null)}
        onToggleStatus={(partnerId, nextStatus) => {
          setActive.run({ id: partnerId, isActive: nextStatus === 'active' })
          setSelectedVendor((prev) => (prev ? { ...prev, status: nextStatus } : prev))
        }}
      />
    </PageBody>
  )
}
