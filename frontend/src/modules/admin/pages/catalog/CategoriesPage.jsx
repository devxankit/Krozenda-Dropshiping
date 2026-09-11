import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Icon, Input, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { BrandFormDrawer, CategoryFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import {
  useBrandsController,
  useBrandWriteController,
  useCategoryTreeController,
  useCategoryWriteController,
} from '../../controllers/useCatalogController'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE

export function CategoriesPage() {
  const categories = useCategoryTreeController()
  const brands = useBrandsController()

  // State
  const [activeTab, setActiveTab] = useState('categories') // 'categories' | 'brands'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all') // 'all' | 'root' | 'sub'
  const [ownerFilter, setOwnerFilter] = useState('all') // 'all' | 'in-house' | 'partner'

  // Drawers & Dialogs
  const [editingCategory, setEditingCategory] = useState(null)
  const [quickSubCategory, setQuickSubCategory] = useState(null)
  const [removingCategory, setRemovingCategory] = useState(null)

  const [editingBrand, setEditingBrand] = useState(null)
  const [removingBrand, setRemovingBrand] = useState(null)

  // Writers
  const categoryWriter = useCategoryWriteController({
    onSaved: () => {
      setEditingCategory(null)
      setQuickSubCategory(null)
    },
  })

  const brandWriter = useBrandWriteController({
    onSaved: () => setEditingBrand(null),
  })

  // Extract raw lists
  const categoryNodes = useMemo(() => categories.data?.nodes || [], [categories.data])
  const brandItems = useMemo(() => brands.data?.items || [], [brands.data])

  // Root categories lookup (for parent selection and commission calculation)
  const rootCategories = useMemo(
    () => categoryNodes.filter((c) => c.depth === 0),
    [categoryNodes]
  )

  const rootCategoryMap = useMemo(() => {
    const map = new Map()
    rootCategories.forEach((rc) => map.set(rc.id, rc))
    return map
  }, [rootCategories])

  // Metrics Calculations
  const totalCategories = categoryNodes.length
  const rootCount = rootCategories.length
  const subCount = totalCategories - rootCount
  const liveCategoriesCount = useMemo(
    () => categoryNodes.filter((c) => c.status === 'live').length,
    [categoryNodes]
  )

  const totalBrands = brandItems.length
  const liveBrandsCount = useMemo(
    () => brandItems.filter((b) => b.status === 'live').length,
    [brandItems]
  )
  const inHouseBrandsCount = useMemo(
    () => brandItems.filter((b) => (b.owner || '').toLowerCase().includes('in-house')).length,
    [brandItems]
  )
  const partnerBrandsCount = totalBrands - inHouseBrandsCount

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categoryNodes.filter((node) => {
      if (statusFilter !== 'all' && node.status !== statusFilter) return false
      if (levelFilter === 'root' && node.depth !== 0) return false
      if (levelFilter === 'sub' && node.depth === 0) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = node.name?.toLowerCase().includes(q)
        const slugMatch = node.slug?.toLowerCase().includes(q)
        const parentMatch = node.parentName?.toLowerCase().includes(q)
        return Boolean(nameMatch || slugMatch || parentMatch)
      }
      return true
    })
  }, [categoryNodes, statusFilter, levelFilter, searchQuery])

  // Filtered Brands
  const filteredBrands = useMemo(() => {
    return brandItems.filter((brand) => {
      if (statusFilter !== 'all' && brand.status !== statusFilter) return false
      if (ownerFilter === 'in-house' && !(brand.owner || '').toLowerCase().includes('in-house'))
        return false
      if (ownerFilter === 'partner' && (brand.owner || '').toLowerCase().includes('in-house'))
        return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = brand.name?.toLowerCase().includes(q)
        const ownerMatch = brand.owner?.toLowerCase().includes(q)
        const websiteMatch = brand.website?.toLowerCase().includes(q)
        return Boolean(nameMatch || ownerMatch || websiteMatch)
      }
      return true
    })
  }, [brandItems, statusFilter, ownerFilter, searchQuery])

  if (categories.isLoading || brands.isLoading) {
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

  // Category Columns
  const categoryColumns = [
    {
      key: 'name',
      header: 'Category & Hierarchy',
      render: (node) => {
        const isRoot = node.depth === 0
        const parent = node.parentId ? rootCategoryMap.get(node.parentId) : null

        return (
          <div
            className="flex items-center gap-3 py-1"
            style={{ paddingLeft: `${node.depth * 1.75}rem` }}
          >
            {/* Indent Branch Indicator */}
            {!isRoot && (
              <span className="flex items-center text-slate-400 font-mono text-xs select-none">
                └──
              </span>
            )}

            {/* Thumbnail / Avatar */}
            <div className="relative shrink-0">
              <Avatar
                name={node.name}
                src={node.image}
                size="md"
                className={isRoot ? 'ring-2 ring-indigo-500/20 shadow-sm' : 'opacity-90'}
              />
              {isRoot && (
                <span
                  className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-indigo-600 ring-2 ring-white flex items-center justify-center text-[8px] text-white font-bold"
                  title="Root category"
                >
                  R
                </span>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`truncate ${
                    isRoot ? 'font-bold text-slate-900 text-sm' : 'font-medium text-slate-700 text-xs'
                  }`}
                >
                  {node.name}
                </span>

                <Badge
                  tone={isRoot ? 'brand' : 'neutral'}
                  size="sm"
                  className="text-[10px] tracking-wide uppercase px-1.5 py-0.5"
                >
                  {isRoot ? 'Root' : 'Sub-category'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-2xs text-ink-faint mt-0.5">
                <span className="font-mono">/{node.slug || node.name.toLowerCase().replace(/\s+/g, '-')}</span>
                {!isRoot && parent && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-600 font-medium">Child of {parent.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'commissionRate',
      header: 'Commission %',
      width: '10rem',
      align: 'right',
      render: (node) => {
        if (node.commissionRate !== null && node.commissionRate !== undefined) {
          return (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs ring-1 ring-emerald-600/20 tabular">
                <Icon name="check" className="h-3 w-3 text-emerald-600" />
                {node.commissionRate}%
              </span>
              <span className="text-[10px] text-ink-faint mt-0.5">Custom rate</span>
            </div>
          )
        }

        // Inherits
        const parent = node.parentId ? rootCategoryMap.get(node.parentId) : null
        const parentRate = parent?.commissionRate != null ? `${parent.commissionRate}%` : 'Standard'

        return (
          <div className="flex flex-col items-end">
            <span className="inline-flex items-center text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-2xs font-medium tabular">
              Inherits ({parentRate})
            </span>
            <span className="text-[10px] text-ink-faint mt-0.5">From parent</span>
          </div>
        )
      },
    },
    {
      key: 'productCount',
      header: 'Products',
      width: '7rem',
      align: 'right',
      render: (node) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200 tabular">
          {node.productCount.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '8.5rem',
      render: (node) => {
        const isLive = node.status === 'live'
        return (
          <button
            type="button"
            onClick={() =>
              categoryWriter.setStatus.run({
                id: node.id,
                status: isLive ? 'pending' : 'live',
              })
            }
            className="group flex items-center gap-1.5 focus:outline-none"
            title="Click to toggle status"
          >
            <Badge
              tone={isLive ? 'success' : 'neutral'}
              dot
              size="sm"
              className="cursor-pointer group-hover:ring-1 group-hover:ring-offset-1 transition-all"
            >
              {isLive ? 'Live' : 'Pending'}
            </Badge>
          </button>
        )
      },
    },
    {
      key: '__actions',
      header: 'Actions',
      width: '9rem',
      align: 'right',
      render: (node) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1">
            {/* Quick add sub-category shortcut on root categories */}
            {node.depth === 0 && (
              <button
                type="button"
                onClick={() => setQuickSubCategory(node)}
                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                title={`Add sub-category under ${node.name}`}
              >
                <Icon name="add" className="h-4 w-4" />
              </button>
            )}

            {/* Edit */}
            <button
              type="button"
              onClick={() => setEditingCategory(node)}
              className="p-1 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
              title="Edit category"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => setRemovingCategory(node)}
              className="p-1 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              title="Delete category"
            >
              <Icon name="delete" className="h-4 w-4" />
            </button>
          </div>
        </PermissionGate>
      ),
    },
  ]

  // Brand Columns
  const brandColumns = [
    {
      key: 'name',
      header: 'Brand Name',
      render: (brand) => (
        <div className="flex items-center gap-3 py-1">
          <Avatar name={brand.name} src={brand.logo} size="md" className="rounded-lg shadow-sm" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-900 text-sm truncate">{brand.name}</span>
            {brand.website ? (
              <a
                href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-brand-600 hover:underline mt-0.5 truncate"
              >
                <span>{brand.website.replace(/^https?:\/\//, '')}</span>
                <Icon name="chevronRight" className="h-2.5 w-2.5" />
              </a>
            ) : (
              <span className="text-2xs text-ink-faint mt-0.5">No website registered</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Ownership',
      width: '12rem',
      render: (brand) => {
        const isInHouse = (brand.owner || '').toLowerCase().includes('in-house')
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800">{brand.owner || 'In-house'}</span>
            <span className="text-[10px] text-ink-faint">
              {isInHouse ? 'Verified flagship' : 'Partner supplier'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'productCount',
      header: 'Products',
      width: '7.5rem',
      align: 'right',
      render: (brand) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200 tabular">
          {brand.productCount.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '9rem',
      render: (brand) => {
        const isLive = brand.status === 'live'
        return (
          <button
            type="button"
            onClick={() =>
              brandWriter.setStatus.run({
                id: brand.id,
                status: isLive ? 'pending' : 'live',
              })
            }
            className="group flex items-center gap-1.5 focus:outline-none"
            title="Click to toggle status"
          >
            <Badge
              tone={isLive ? 'success' : brand.status === 'pending' ? 'warning' : 'neutral'}
              dot
              size="sm"
              className="cursor-pointer group-hover:ring-1 group-hover:ring-offset-1 transition-all capitalize"
            >
              {brand.status}
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
      render: (brand) => (
        <PermissionGate permission={MANAGE}>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditingBrand(brand)}
              className="p-1 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
              title="Edit brand"
            >
              <Icon name="edit" className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setRemovingBrand(brand)}
              className="p-1 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
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
        {/* Executive Header */}
        <PageHeader
          title="Categories & Brands"
          description="Manage taxonomy tree, nested commission rate inheritance, and approved brand directory."
          actions={
            <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="control"
                  icon="add"
                  onClick={() => setEditingBrand('new')}
                >
                  New brand
                </Button>
                <Button
                  size="control"
                  icon="add"
                  onClick={() => setEditingCategory('new')}
                >
                  New category
                </Button>
              </div>
            </PermissionGate>
          }
        />

        {/* Executive KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Categories */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Categories Tree
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {totalCategories}
              </span>
              <span className="text-xs text-slate-500">total categories</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-2xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                {rootCount} Root
              </span>
              <span>•</span>
              <span className="text-slate-500">{subCount} Sub-categories</span>
            </div>
          </div>

          {/* Card 2: Active Categories */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live Storefront
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {liveCategoriesCount}
              </span>
              <span className="text-xs text-emerald-600 font-medium">active categories</span>
            </div>
            <div className="mt-2 text-2xs text-slate-500">
              {totalCategories > 0
                ? `${Math.round((liveCategoriesCount / totalCategories) * 100)}% published in catalog`
                : 'No categories active'}
            </div>
          </div>

          {/* Card 3: Registered Brands */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Brand Directory
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Icon name="filter" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {totalBrands}
              </span>
              <span className="text-xs text-slate-500">verified brands</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-2xs text-slate-600">
              <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                {inHouseBrandsCount} In-house
              </span>
              <span>•</span>
              <span className="text-slate-500">{partnerBrandsCount} Partners</span>
            </div>
          </div>

          {/* Card 4: Live Approved Brands */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Brand Approvals
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon name="check" className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 tabular">
                {liveBrandsCount}
              </span>
              <span className="text-xs text-blue-600 font-medium">approved live</span>
            </div>
            <div className="mt-2 text-2xs text-slate-500">
              Ready for vendor & dropshipper listing
            </div>
          </div>
        </div>

        {/* Modern Tab Bar & Action Toolbar Container */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          {/* Top Bar: Tabs & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            {/* Segmented Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('categories')
                  setStatusFilter('all')
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'categories'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📁 Categories Hierarchy</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === 'categories'
                      ? 'bg-indigo-50 text-indigo-600 font-bold'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {totalCategories}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('brands')
                  setStatusFilter('all')
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'brands'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏷️ Brand Directory</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === 'brands'
                      ? 'bg-amber-50 text-amber-700 font-bold'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {totalBrands}
                </span>
              </button>
            </div>

            {/* Real-time Search Input */}
            <div className="w-full sm:w-72">
              <Input
                id="catalog-search"
                icon="search"
                placeholder={
                  activeTab === 'categories'
                    ? 'Search categories or slug...'
                    : 'Search brands, owners, sites...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Sub-toolbar: Filter Pills & Category Level Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Status:</span>
              {['all', 'live', 'pending', 'draft'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'all' ? 'All statuses' : status}
                </button>
              ))}

              {/* Category Level Filter Pills */}
              {activeTab === 'categories' && (
                <>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="text-xs font-medium text-slate-500 mr-1">Level:</span>
                  {[
                    { id: 'all', label: 'All levels' },
                    { id: 'root', label: 'Root only' },
                    { id: 'sub', label: 'Sub-categories only' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setLevelFilter(level.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        levelFilter === level.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </>
              )}

              {/* Brand Ownership Filter Pills */}
              {activeTab === 'brands' && (
                <>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="text-xs font-medium text-slate-500 mr-1">Origin:</span>
                  {[
                    { id: 'all', label: 'All origins' },
                    { id: 'in-house', label: 'In-house' },
                    { id: 'partner', label: 'Vendor partner' },
                  ].map((owner) => (
                    <button
                      key={owner.id}
                      type="button"
                      onClick={() => setOwnerFilter(owner.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        ownerFilter === owner.id
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      {owner.label}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Summary Count Indicator */}
            <div className="text-2xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {activeTab === 'categories' ? filteredCategories.length : filteredBrands.length}
              </span>{' '}
              items
            </div>
          </div>

          {/* Table Render */}
          <div className="overflow-hidden rounded-lg border border-slate-200 mt-2">
            {activeTab === 'categories' ? (
              <Table
                className="w-full"
                columns={categoryColumns}
                data={filteredCategories}
                getRowKey={(node) => node.id}
                density="normal"
              />
            ) : (
              <Table
                className="w-full"
                columns={brandColumns}
                data={filteredBrands}
                getRowKey={(brand) => brand.id}
                density="normal"
              />
            )}
          </div>
        </div>
      </PageBody>

      {/* Category Create/Edit Drawer */}
      {(editingCategory || quickSubCategory) && (
        <CategoryFormDrawer
          key={
            editingCategory === 'new'
              ? 'new-category'
              : editingCategory?.id || `quick-sub-${quickSubCategory?.id}`
          }
          isOpen
          onClose={() => {
            setEditingCategory(null)
            setQuickSubCategory(null)
          }}
          category={editingCategory === 'new' ? null : editingCategory}
          parentCategories={rootCategories}
          defaultParentId={quickSubCategory?.id || null}
          writer={categoryWriter}
        />
      )}

      {/* Brand Create/Edit Drawer */}
      {editingBrand && (
        <BrandFormDrawer
          key={editingBrand === 'new' ? 'new-brand' : editingBrand.id}
          isOpen
          onClose={() => setEditingBrand(null)}
          brand={editingBrand === 'new' ? null : editingBrand}
          writer={brandWriter}
        />
      )}

      {/* Category Remove Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingCategory)}
        onClose={() => setRemovingCategory(null)}
        title={`Delete category: "${removingCategory?.name}"?`}
        description={
          removingCategory?.depth === 0
            ? 'Root category removal is blocked if sub-categories or active products exist under it. Move or delete sub-categories first.'
            : 'Sub-category removal will delete its assignment from the catalog taxonomy. This action cannot be undone.'
        }
        confirmLabel="Delete category"
        tone="danger"
        isSubmitting={categoryWriter.remove.isSubmitting}
        onConfirm={() => {
          categoryWriter.remove.run({ id: removingCategory.id })
          setRemovingCategory(null)
        }}
      />

      {/* Brand Remove Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingBrand)}
        onClose={() => setRemovingBrand(null)}
        title={`Delete brand: "${removingBrand?.name}"?`}
        description="A brand linked to active listings cannot be deleted until its products are reassigned to another brand."
        confirmLabel="Delete brand"
        tone="danger"
        isSubmitting={brandWriter.remove.isSubmitting}
        onConfirm={() => {
          brandWriter.remove.run({ id: removingBrand.id })
          setRemovingBrand(null)
        }}
      />
    </>
  )
}
