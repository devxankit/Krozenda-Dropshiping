import { useState } from 'react'
import { Badge, Button, Icon, Table } from '../../../../components/ui'
import { ErrorState, PageSkeleton } from '../feedback'
import { SectionCard } from '../display'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import { RoleFormDrawer } from './RoleFormDrawer'
import {
  useCreateRoleController,
  useDeleteRoleController,
  useRoleListController,
  useUpdateRoleController,
} from '../../controllers/useRoleManagementController'

// Roles are created here first, then picked from a dropdown when creating or
// editing a staff account (StaffFormDrawer) — this panel is that "first
// step". Deleting a role that's still assigned to staff is rejected by the
// backend with a clear message rather than silently orphaning them.
export function RolesPanel() {
  const roles = useRoleListController()
  const [formRole, setFormRole] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const createRole = useCreateRoleController(() => setIsFormOpen(false))
  const updateRole = useUpdateRoleController(() => setIsFormOpen(false))
  const deleteRoleMutation = useDeleteRoleController(() => setDeleteTarget(null))

  if (roles.isLoading) return <PageSkeleton rows={3} />
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

  const columns = [
    { key: 'name', header: 'Role', cellClassName: 'text-xs font-medium text-slate-900' },
    {
      key: 'permissions',
      header: 'Modules granted',
      render: (row) => (
        <span className="tabular text-xs text-ink-muted">{row.permissions.length}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '7rem',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'danger'} size="sm" dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: '__actions',
      header: '',
      width: '6rem',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            title="Edit role"
            onClick={() => openEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete role"
            onClick={() => setDeleteTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            <Icon name="delete" className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <SectionCard
        title="Roles"
        description={`${roles.items.length} role(s) — create one, then assign it to staff from the Staff tab`}
        actions={
          <Button size="control" icon="add" onClick={openCreate}>
            Create role
          </Button>
        }
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={columns}
          data={roles.items}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>

      <RoleFormDrawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        role={formRole}
        onSubmit={submitForm}
        isSubmitting={createRole.isSubmitting || updateRole.isSubmitting}
        error={createRole.error || updateRole.error}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteRoleMutation.run(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}" role?`}
        description="If any staff are still assigned this role, the deletion will be rejected until they're reassigned."
        confirmLabel="Delete"
        isSubmitting={deleteRoleMutation.isSubmitting}
      />
    </>
  )
}
