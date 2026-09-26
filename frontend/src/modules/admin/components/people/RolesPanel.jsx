import { useMemo, useState } from 'react'
import { Badge, Icon, Table } from '../../../../components/ui'
import { ErrorState, PageSkeleton, PermissionGate } from '../feedback'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import { RoleFormDrawer } from './RoleFormDrawer'
import { NAV_TREE, ADMIN_PERMISSIONS } from '../../constants'
import {
  useCreateRoleController,
  useDeleteRoleController,
  useRoleListController,
  useUpdateRoleController,
} from '../../controllers/useRoleManagementController'

const MANAGE = ADMIN_PERMISSIONS.ROLES_MANAGE

// Build permission meta lookup from NAV_TREE
const PERMISSION_META = {}
NAV_TREE.forEach((group) => {
  group.items.forEach((item) => {
    if (item.permission) {
      PERMISSION_META[item.permission] = {
        label: item.label,
        group: group.label,
        icon: item.icon,
      }
    }
    if (item.legacyPermission) {
      PERMISSION_META[item.legacyPermission] = {
        label: item.label,
        group: group.label,
        icon: item.icon,
      }
    }
  })
})

const ALL_ASSIGNABLE_COUNT =
  NAV_TREE.flatMap((group) => group.items.filter((item) => item.permission && !item.adminOnly)).length || 32

function getDomainFromKey(permKey) {
  if (!permKey || typeof permKey !== 'string') return null
  const k = permKey.toLowerCase()
  if (k.includes('catalog')) return 'Catalog'
  if (k.includes('order') || k.includes('return') || k.includes('shipment') || k.includes('invoice')) return 'Sales'
  if (k.includes('finance') || k.includes('account') || k.includes('payout') || k.includes('tax') || k.includes('settlement')) return 'Finance'
  if (k.includes('people') || k.includes('kyc') || k.includes('role') || k.includes('user') || k.includes('staff')) return 'Network'
  if (k.includes('market') || k.includes('banner') || k.includes('coupon') || k.includes('review')) return 'Marketing'
  if (k.includes('dropship')) return 'Dropshipping'
  if (k.includes('dashboard') || k.includes('analytic') || k.includes('report')) return 'Insight'
  if (k.includes('setting') || k.includes('audit') || k.includes('system') || k.includes('access')) return 'System'
  return null
}

function getRoleDomainTags(permissions = []) {
  const groups = new Set()
  permissions.forEach((p) => {
    const meta = PERMISSION_META[p]
    if (meta?.group) {
      groups.add(meta.group)
    } else {
      const fallback = getDomainFromKey(p)
      if (fallback) groups.add(fallback)
    }
  })
  return Array.from(groups)
}

export function RolesPanel() {
  const roles = useRoleListController()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'

  const [formRole, setFormRole] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const createRole = useCreateRoleController(() => setIsFormOpen(false))
  const updateRole = useUpdateRoleController(() => setIsFormOpen(false))
  const deleteRoleMutation = useDeleteRoleController(() => setDeleteTarget(null))

  const roleItems = roles.items || []
  const totalCount = roleItems.length
  const activeCount = useMemo(() => roleItems.filter((r) => r.isActive !== false).length, [roleItems])
  const inactiveCount = totalCount - activeCount
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0

  const avgPermissions = useMemo(() => {
    if (totalCount === 0) return 0
    const totalPerms = roleItems.reduce((acc, r) => acc + (r.permissions?.length || 0), 0)
    return Math.round(totalPerms / totalCount)
  }, [roleItems, totalCount])

  const filteredRoles = useMemo(() => {
    return roleItems.filter((role) => {
      const isActive = role.isActive !== false
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'inactive' && isActive) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const domainTags = getRoleDomainTags(role.permissions || []).join(' ').toLowerCase()
        return (
          role.name?.toLowerCase().includes(q) ||
          domainTags.includes(q)
        )
      }
      return true
    })
  }, [roleItems, statusFilter, searchQuery])

  if (roles.isLoading) return <PageSkeleton rows={4} />
  if (roles.error) return <ErrorState error={roles.error} onRetry={roles.refetch} />

  function openCreate() {
    setFormRole(null)
    setIsFormOpen(true)
  }

  function openEdit(role) {
    setFormRole(role)
    setIsFormOpen(true)
  }

  function submitForm(values) {
    if (values.id) {
      updateRole.run(values)
    } else {
      createRole.run(values)
    }
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Roles', count: totalCount },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
  ]

  const tableColumns = [
    {
      key: 'name',
      header: 'Role Profile',
      render: (row) => {
        const isSuperAdmin = row.permissions?.length >= ALL_ASSIGNABLE_COUNT
        return (
          <div className="flex items-center gap-3.5 py-1.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm ring-1 ${
                isSuperAdmin
                  ? 'bg-gradient-to-br from-brand-600 to-brand-600 text-white ring-brand-500/30 shadow-xs'
                  : 'bg-brand-50 text-brand-700 ring-brand-500/20'
              }`}
            >
              <Icon name="roles" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900 text-sm truncate">{row.name}</p>
                {isSuperAdmin && (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-200">
                    Full Access
                  </span>
                )}
              </div>
              <p className="text-2xs text-slate-400 truncate">ID: {row.id ? String(row.id).slice(-8) : '—'}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'domains',
      header: 'Granted Domains',
      render: (row) => {
        const domains = getRoleDomainTags(row.permissions || [])
        if (row.permissions?.length >= ALL_ASSIGNABLE_COUNT) {
          return (
            <Badge tone="brand" size="sm" className="font-semibold">
              All Modules Granted
            </Badge>
          )
        }
        if (domains.length === 0) {
          return (
            <span className="text-xs text-slate-400 italic">
              Dashboard Only
            </span>
          )
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
            {domains.slice(0, 3).map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-2xs font-semibold text-slate-700"
              >
                {domain}
              </span>
            ))}
            {domains.length > 3 && (
              <span className="rounded-lg bg-slate-200/70 px-2 py-1 text-[10px] font-bold text-slate-600">
                +{domains.length - 3} more
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'coverage',
      header: 'Access Scope',
      width: '13rem',
      render: (row) => {
        const count = row.permissions?.length || 0
        const pct = Math.min(100, Math.round((count / ALL_ASSIGNABLE_COUNT) * 100))
        return (
          <div className="flex flex-col gap-1.5 w-36">
            <div className="flex items-center justify-between text-2xs">
              <span className="font-bold text-slate-800 tabular">{count} modules</span>
              <span className="font-semibold text-slate-400 tabular">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 90 ? 'bg-brand-600' : pct >= 40 ? 'bg-brand-500' : 'bg-success-500'
                }`}
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '9rem',
      render: (row) => (
        <Badge tone={row.isActive !== false ? 'success' : 'neutral'} dot size="sm">
          {row.isActive !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: '__actions',
      header: 'Actions',
      width: '7.5rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Edit role permissions"
            onClick={() => openEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete role"
            onClick={() => setDeleteTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
          >
            <Icon name="delete" className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
            <span>People & Organization</span>
            <span className="text-slate-300">/</span>
            <span className="text-brand-600 font-semibold">Roles & RBAC</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Security Roles & Permissions</h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/70">
              {totalCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Configure role-based access control (RBAC), govern functional privileges across catalog, sales, finance, and system operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => roles.refetch()}
            disabled={roles.isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            title="Refresh roles"
          >
            <Icon name="refresh" className={`h-3.5 w-3.5 ${roles.isFetching ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <PermissionGate permission={MANAGE}>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-all ring-1 ring-brand-500/20"
            >
              <Icon name="add" className="h-3.5 w-3.5" />
              <span>New Role</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Security KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Roles */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-300/80">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Security Roles</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10 transition-transform group-hover:scale-105">
              <Icon name="roles" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{totalCount}</span>
            <span className="text-xs font-medium text-slate-500">defined profiles</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>Assigned to staff across departments</span>
          </div>
        </div>

        {/* Active Policies */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-success-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Active Roles</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/10 transition-transform group-hover:scale-105">
              <Icon name="check" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{activeCount}</span>
            <span className="text-xs font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
              {activeRatio}% active
            </span>
          </div>
          <div className="mt-3.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-success-500 transition-all duration-500"
                style={{ width: `${activeRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* Avg Permissions */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-accent-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Avg Permissions</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-accent-500/10 transition-transform group-hover:scale-105">
              <Icon name="sliders" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular">{avgPermissions}</span>
            <span className="text-xs font-medium text-slate-500">modules / role</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
            <span>Granular least-privilege scoping</span>
          </div>
        </div>

        {/* Access Model */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-warning-200">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Security Engine</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-500/10 transition-transform group-hover:scale-105">
              <Icon name="lock" className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">Strict RBAC</span>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
            <span>Audit-ready permission validation</span>
          </div>
        </div>
      </div>

      {/* Smart Toolbar (List View Only) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
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

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Icon name="search" className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles or domain tags…"
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

      {/* List / Table View */}
      {filteredRoles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3.5 ring-1 ring-slate-200">
            <Icon name="roles" className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {searchQuery || statusFilter !== 'all' ? 'No matching roles' : 'No roles created yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search keywords or switching the status filter tab.'
              : 'Create security roles to govern permissions and assign them to staff members.'}
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
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-all"
              >
                <Icon name="add" className="h-3.5 w-3.5" />
                <span>Create Role</span>
              </button>
            </PermissionGate>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <Table
            className="rounded-none border-0"
            columns={tableColumns}
            data={filteredRoles}
            getRowKey={(row) => row.id}
            density="comfortable"
          />
        </div>
      )}

      {/* Role Form Drawer */}
      <RoleFormDrawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        role={formRole}
        onSubmit={submitForm}
        isSubmitting={createRole.isSubmitting || updateRole.isSubmitting}
        error={createRole.error || updateRole.error}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteRoleMutation.run(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}" role?`}
        description="This action cannot be undone. If any staff members are currently assigned this role, reassignment will be required."
        confirmLabel="Delete Role"
        tone="danger"
        isSubmitting={deleteRoleMutation.isSubmitting}
      />
    </div>
  )
}
