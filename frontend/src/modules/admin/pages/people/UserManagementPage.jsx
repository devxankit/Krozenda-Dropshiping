import { useState, useMemo } from 'react'
import { Button, Icon, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ChangePasswordDialog } from '../../components/people/ChangePasswordDialog'
import { ChangeRoleDialog } from '../../components/people/ChangeRoleDialog'
import { StaffDetailDrawer } from '../../components/people/StaffDetailDrawer'
import { StaffFormDrawer } from '../../components/people/StaffFormDrawer'
import { USER_MANAGEMENT_COLUMNS } from '../../tableColumns/peopleColumns'
import {
  useCreateStaffController,
  useDeleteStaffController,
  useStaffListController,
  useStaffPasswordController,
  useStaffRoleController,
  useStaffStatusController,
  useUpdateStaffController,
} from '../../controllers/useStaffManagementController'

export function UserManagementPage() {
  const staff = useStaffListController()

  const [detailStaff, setDetailStaff] = useState(null)
  const [formStaff, setFormStaff] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const createStaff = useCreateStaffController(() => setIsFormOpen(false))
  const updateStaff = useUpdateStaffController(() => setIsFormOpen(false))
  const updateStatus = useStaffStatusController()
  const updatePassword = useStaffPasswordController(() => setPasswordTarget(null))
  const updateRole = useStaffRoleController(() => setRoleTarget(null))
  const deleteStaffMutation = useDeleteStaffController(() => setDeleteTarget(null))

  // Metric counts
  const totalCount = staff.items.length
  const activeCount = useMemo(
    () => staff.items.filter((item) => item.isActive).length,
    [staff.items],
  )
  const inactiveCount = totalCount - activeCount
  const adminCount = useMemo(
    () => staff.items.filter((item) => item.role === 'admin').length,
    [staff.items],
  )

  // Real-time filtered list
  const filteredStaff = useMemo(() => {
    return staff.items.filter((item) => {
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false
      if (statusFilter === 'admin' && item.role !== 'admin') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = item.name?.toLowerCase().includes(q)
        const emailMatch = item.email?.toLowerCase().includes(q)
        const mobileMatch = item.mobileNumber?.toLowerCase().includes(q)
        const roleMatch = item.role?.toLowerCase().includes(q)
        return Boolean(nameMatch || emailMatch || mobileMatch || roleMatch)
      }

      return true
    })
  }, [staff.items, statusFilter, searchQuery])

  if (staff.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  if (staff.error) {
    return (
      <PageBody>
        <ErrorState error={staff.error} onRetry={staff.refetch} />
      </PageBody>
    )
  }

  function openCreate() {
    setFormStaff(null)
    setIsFormOpen(true)
  }

  function openEdit(row) {
    setFormStaff(row)
    setIsFormOpen(true)
  }

  function submitForm(values) {
    if (values.id) {
      updateStaff.run(values)
    } else {
      createStaff.run(values)
    }
  }

  const FILTER_TABS = [
    { id: 'all', label: 'All Staff', count: totalCount },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
    { id: 'admin', label: 'Admins', count: adminCount },
  ]

  const columns = [
    ...USER_MANAGEMENT_COLUMNS,
    {
      key: '__actions',
      header: 'Actions',
      width: '12rem',
      align: 'right',
      cellClassName: 'pr-4',
      headerClassName: 'pr-4',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="View Details"
            onClick={() => setDetailStaff(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-brand-50 hover:text-brand-600 hover:scale-105 active:scale-95 focus-visible:outline-none"
          >
            <Icon name="show" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Edit Staff"
            onClick={() => openEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-brand-50 hover:text-brand-600 hover:scale-105 active:scale-95 focus-visible:outline-none"
          >
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Change Password"
            onClick={() => setPasswordTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-warning-50 hover:text-warning-600 hover:scale-105 active:scale-95 focus-visible:outline-none"
          >
            <Icon name="lock" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Change Role"
            onClick={() => setRoleTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-accent-50 hover:text-accent-600 hover:scale-105 active:scale-95 focus-visible:outline-none"
          >
            <Icon name="roles" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete Staff"
            onClick={() => setDeleteTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-danger-50 hover:text-danger-600 hover:scale-105 active:scale-95 focus-visible:outline-none"
          >
            <Icon name="delete" className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title="User Management"
        description="Create and manage staff accounts, monitor panel access, and configure granular permissions."
        actions={
          <Button size="control" icon="add" onClick={openCreate} className="shadow-xs">
            Add staff member
          </Button>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Accounts */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Staff
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <Icon name="users" className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-500">registered</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">All registered staff profiles</p>
        </div>

        {/* Active Now */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Now
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-600 ring-1 ring-success-100">
              <Icon name="check" className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{activeCount}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Authorized to sign in</p>
        </div>

        {/* Administrators */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administrators
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-accent-100">
              <Icon name="roles" className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{adminCount}</span>
            <span className="text-xs text-slate-500">admins</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Full system access privileges</p>
        </div>

        {/* Inactive Accounts */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Suspended / Inactive
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning-600 ring-1 ring-warning-100">
              <Icon name="warning" className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{inactiveCount}</span>
            <span className="text-xs text-slate-500">inactive</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Sign-in access revoked</p>
        </div>
      </div>

      {/* Directory Card with Modern Toolbar */}
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {/* Header Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-8 text-xs text-slate-800 placeholder-slate-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              title="Refresh staff list"
              onClick={() => staff.refetch()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Feedback Note */}
        {(searchQuery || statusFilter !== 'all') && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-600">
            <span>
              Showing <strong className="text-slate-900">{filteredStaff.length}</strong> of{' '}
              <strong className="text-slate-900">{totalCount}</strong> staff members
              {searchQuery && (
                <>
                  {' '}matching &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Table or Empty State */}
        {filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Icon name="search" className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No staff members found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              {searchQuery
                ? `No accounts match "${searchQuery}". Try a different keyword or reset filters.`
                : 'No staff accounts currently match this filter tab.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
              Reset all filters
            </button>
          </div>
        ) : (
          <Table
            className="rounded-none border-0"
            columns={columns}
            data={filteredStaff}
            getRowKey={(row) => row.id}
            onRowClick={(row) => setDetailStaff(row)}
            density="comfortable"
          />
        )}

        {/* Footer Summary */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>
            {filteredStaff.length} {filteredStaff.length === 1 ? 'account' : 'accounts'} listed
          </span>
          <span className="text-slate-400">
            Tip: Click any row to view complete profile details & permissions
          </span>
        </div>
      </div>

      <StaffDetailDrawer
        isOpen={Boolean(detailStaff)}
        onClose={() => setDetailStaff(null)}
        staff={detailStaff}
        onEdit={openEdit}
        onPassword={(target) => setPasswordTarget(target)}
        onPermissions={(target) => setRoleTarget(target)}
        onToggleStatus={(target) => {
          updateStatus.run({ id: target.id, isActive: !target.isActive })
          setDetailStaff((prev) => (prev ? { ...prev, isActive: !prev.isActive } : null))
        }}
      />

      <StaffFormDrawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        staff={formStaff}
        onSubmit={submitForm}
        isSubmitting={createStaff.isSubmitting || updateStaff.isSubmitting}
        error={createStaff.error || updateStaff.error}
      />

      <ChangePasswordDialog
        isOpen={Boolean(passwordTarget)}
        onClose={() => setPasswordTarget(null)}
        staff={passwordTarget}
        onSubmit={updatePassword.run}
        isSubmitting={updatePassword.isSubmitting}
      />

      <ChangeRoleDialog
        isOpen={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        staff={roleTarget}
        onSubmit={updateRole.run}
        isSubmitting={updateRole.isSubmitting}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteStaffMutation.run(deleteTarget.id)}
        title={`Delete ${deleteTarget?.name || 'this staff member'}?`}
        description="They will no longer be able to sign in. This can be reversed by a database administrator, but not from this screen."
        confirmLabel="Delete"
        isSubmitting={deleteStaffMutation.isSubmitting}
      />
    </PageBody>
  )
}

